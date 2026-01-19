import type {
  FireberryClientConfig,
  RequestOptions,
  CacheControl,
} from './types/client';
import type { QueryOptions, QueryResult } from './types/query';
import {
  FireberryError,
  FireberryErrorCode,
  createErrorFromResponse,
  createNetworkError,
} from './errors';
import { wait } from './utils/helpers';
import { QueryBuilder } from './utils/queryBuilder';

// Import API modules
import { MetadataAPI } from './api/metadata';
import { RecordsAPI } from './api/records';
import { BatchAPI } from './api/batch';
import { FieldsAPI } from './api/fields';
import { FilesAPI } from './api/files';

/**
 * Internal cache store for metadata
 */
interface CacheStore {
  objects?: { data: unknown; timestamp: number };
  fields: Map<string, { data: unknown; timestamp: number }>;
  fieldValues: Map<string, { data: unknown; timestamp: number }>;
}

/**
 * Internal cache store for query results
 */
interface QueryCache {
  data: QueryResult;
  timestamp: number;
}

/**
 * Generates a cache key from query options for deduplication
 */
function generateQueryCacheKey(options: QueryOptions): string {
  const parts = [
    options.objectType,
    Array.isArray(options.fields) ? options.fields.join(',') : options.fields || '*',
    options.query || '',
    options.sortBy || 'modifiedon',
    options.sortType || 'desc',
    options.limit?.toString() || '',
    options.page?.toString() || '1',
    options.pageSize?.toString() || '500',
    options.showRealValue !== false ? '1' : '0',
    options.autoPage !== false ? '1' : '0',
  ];
  return parts.join('|');
}

/**
 * FireberryClient - Main client for interacting with the Fireberry CRM API
 *
 * @example
 * ```typescript
 * const client = new FireberryClient({
 *   apiKey: 'your-api-key',
 *   retryOn429: true,
 *   maxRetries: 120,
 * });
 *
 * // Query records
 * const result = await client.query({
 *   objectType: '1',
 *   fields: ['accountid', 'name'],
 *   query: '(statuscode = 1)',
 * });
 *
 * // Use query builder
 * const result = await client.queryBuilder()
 *   .objectType('1')
 *   .select('accountid', 'name')
 *   .where('statuscode').equals('1')
 *   .execute();
 * ```
 */
export class FireberryClient {
  private readonly config: Required<FireberryClientConfig>;
  private readonly cacheStore: CacheStore;
  private readonly inFlightQueries: Map<string, Promise<QueryResult>> = new Map();
  private readonly queryCache: Map<string, QueryCache> = new Map();

  /** Metadata API operations */
  readonly metadata: MetadataAPI;
  /** Records CRUD operations */
  readonly records: RecordsAPI;
  /** Batch operations */
  readonly batch: BatchAPI;
  /** Field management operations */
  readonly fields: FieldsAPI;
  /** File operations */
  readonly files: FilesAPI;

  /**
   * Creates a new FireberryClient instance
   */
  constructor(config: FireberryClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.fireberry.com',
      timeout: config.timeout || 30000,
      retryOn429: config.retryOn429 ?? true,
      maxRetries: config.maxRetries || 120,
      retryDelay: config.retryDelay || 1000,
      cacheMetadata: config.cacheMetadata || false,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes default
      cacheQueryResults: config.cacheQueryResults || false,
      queryResultCacheTTL: config.queryResultCacheTTL || 60000, // 1 minute default
      invalidateCacheOnMutation: config.invalidateCacheOnMutation ?? true, // Smart cache invalidation enabled by default
    };

    // Initialize cache store
    this.cacheStore = {
      fields: new Map(),
      fieldValues: new Map(),
    };

    // Initialize API modules
    this.metadata = new MetadataAPI(this);
    this.records = new RecordsAPI(this);
    this.batch = new BatchAPI(this);
    this.fields = new FieldsAPI(this);
    this.files = new FilesAPI(this);
  }

  /**
   * Gets the client configuration
   */
  getConfig(): Readonly<Required<FireberryClientConfig>> {
    return this.config;
  }

  /**
   * Cache control methods
   */
  readonly cache: CacheControl & {
    /** Clear all query result cache */
    clearQueryResults: () => void;
    /** Clear query results for a specific object type */
    clearQueryResultsForObject: (objectType: string) => void;
  } = {
    clear: () => {
      this.cacheStore.objects = undefined;
      this.cacheStore.fields.clear();
      this.cacheStore.fieldValues.clear();
      this.queryCache.clear();
    },
    clearObjects: () => {
      this.cacheStore.objects = undefined;
    },
    clearFields: (objectType: string) => {
      this.cacheStore.fields.delete(objectType);
    },
    clearFieldValues: (objectType: string, fieldName?: string) => {
      if (fieldName) {
        this.cacheStore.fieldValues.delete(`${objectType}:${fieldName}`);
      } else {
        // Clear all field values for this object type
        for (const key of this.cacheStore.fieldValues.keys()) {
          if (key.startsWith(`${objectType}:`)) {
            this.cacheStore.fieldValues.delete(key);
          }
        }
      }
    },
    clearQueryResults: () => {
      this.queryCache.clear();
    },
    clearQueryResultsForObject: (objectType: string) => {
      // Clear all query results for this object type
      for (const key of this.queryCache.keys()) {
        if (key.startsWith(`${objectType}|`)) {
          this.queryCache.delete(key);
        }
      }
    },
  };

  /**
   * Invalidates the query cache for an object type after a mutation.
   * Called automatically by RecordsAPI and BatchAPI when mutations occur.
   * Only takes effect if `invalidateCacheOnMutation` is enabled (default: true).
   *
   * @param objectType - The object type that was mutated
   * @internal
   */
  invalidateCacheForMutation(objectType: string): void {
    if (this.config.invalidateCacheOnMutation) {
      this.cache.clearQueryResultsForObject(objectType);
    }
  }

  /**
   * Cleans up expired cache entries (called on write to prevent memory leaks)
   */
  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();

    // Clean query cache
    if (this.config.cacheQueryResults) {
      for (const [key, entry] of this.queryCache) {
        if (now - entry.timestamp >= this.config.queryResultCacheTTL) {
          this.queryCache.delete(key);
        }
      }
    }

    // Clean metadata caches
    if (this.config.cacheMetadata) {
      // Clean objects cache
      if (this.cacheStore.objects && now - this.cacheStore.objects.timestamp >= this.config.cacheTTL) {
        this.cacheStore.objects = undefined;
      }

      // Clean fields cache
      for (const [key, entry] of this.cacheStore.fields) {
        if (now - entry.timestamp >= this.config.cacheTTL) {
          this.cacheStore.fields.delete(key);
        }
      }

      // Clean fieldValues cache
      for (const [key, entry] of this.cacheStore.fieldValues) {
        if (now - entry.timestamp >= this.config.cacheTTL) {
          this.cacheStore.fieldValues.delete(key);
        }
      }
    }
  }

  /**
   * Gets cached data if valid, or undefined if not cached or expired
   */
  getCached<T>(type: 'objects'): T | undefined;
  getCached<T>(type: 'fields', objectType: string): T | undefined;
  getCached<T>(type: 'fieldValues', objectType: string, fieldName: string): T | undefined;
  getCached<T>(
    type: 'objects' | 'fields' | 'fieldValues',
    objectType?: string,
    fieldName?: string,
  ): T | undefined {
    if (!this.config.cacheMetadata) {
      return undefined;
    }

    const now = Date.now();

    if (type === 'objects') {
      const cached = this.cacheStore.objects;
      if (cached && now - cached.timestamp < this.config.cacheTTL) {
        return cached.data as T;
      }
    } else if (type === 'fields' && objectType) {
      const cached = this.cacheStore.fields.get(objectType);
      if (cached && now - cached.timestamp < this.config.cacheTTL) {
        return cached.data as T;
      }
    } else if (type === 'fieldValues' && objectType && fieldName) {
      const key = `${objectType}:${fieldName}`;
      const cached = this.cacheStore.fieldValues.get(key);
      if (cached && now - cached.timestamp < this.config.cacheTTL) {
        return cached.data as T;
      }
    }

    return undefined;
  }

  /**
   * Sets cached data
   */
  setCache(type: 'objects', data: unknown): void;
  setCache(type: 'fields', objectType: string, data: unknown): void;
  setCache(type: 'fieldValues', objectType: string, fieldName: string, data: unknown): void;
  setCache(
    type: 'objects' | 'fields' | 'fieldValues',
    objectTypeOrData?: string | unknown,
    fieldNameOrData?: string | unknown,
    data?: unknown,
  ): void {
    if (!this.config.cacheMetadata) {
      return;
    }

    // Cleanup expired entries on write
    this.cleanupExpiredCacheEntries();

    const now = Date.now();

    if (type === 'objects') {
      this.cacheStore.objects = { data: objectTypeOrData, timestamp: now };
    } else if (type === 'fields' && typeof objectTypeOrData === 'string') {
      this.cacheStore.fields.set(objectTypeOrData, {
        data: fieldNameOrData,
        timestamp: now,
      });
    } else if (
      type === 'fieldValues' &&
      typeof objectTypeOrData === 'string' &&
      typeof fieldNameOrData === 'string'
    ) {
      const key = `${objectTypeOrData}:${fieldNameOrData}`;
      this.cacheStore.fieldValues.set(key, { data, timestamp: now });
    }
  }

  /**
   * Creates a new QueryBuilder instance
   */
  queryBuilder(): QueryBuilder {
    return new QueryBuilder(this);
  }

  /**
   * Executes multiple queries in parallel
   * Respects rate limits by chunking concurrent requests
   *
   * @param queries - Array of query options to execute
   * @param options - Parallel execution options
   * @returns Array of query results in the same order as input queries
   *
   * @example
   * ```typescript
   * const results = await client.queryAll([
   *   { objectType: '1', fields: ['accountid', 'name'] },
   *   { objectType: '2', fields: ['contactid', 'fullname'] },
   *   { objectType: '4', fields: ['opportunityid', 'name'] },
   * ]);
   * ```
   */
  async queryAll(
    queries: QueryOptions[],
    options: { concurrency?: number; signal?: AbortSignal } = {},
  ): Promise<QueryResult[]> {
    const { concurrency = 5, signal } = options;

    if (queries.length === 0) {
      return [];
    }

    const results: QueryResult[] = new Array(queries.length);

    // Process in chunks to respect rate limits
    for (let i = 0; i < queries.length; i += concurrency) {
      // Check for abort
      if (signal?.aborted) {
        throw new FireberryError('Query aborted', {
          code: FireberryErrorCode.NETWORK_ERROR,
        });
      }

      const chunk = queries.slice(i, i + concurrency);
      const chunkPromises = chunk.map((queryOpts, chunkIndex) => {
        // Pass signal to individual queries if provided
        const queryWithSignal = signal ? { ...queryOpts, signal } : queryOpts;
        return this.query(queryWithSignal).then((result) => {
          results[i + chunkIndex] = result;
        });
      });

      await Promise.all(chunkPromises);
    }

    return results;
  }

  /**
   * Streams query results using an async iterator (cursor-based pagination)
   * Yields batches of records, allowing processing of large datasets without loading all into memory
   *
   * @param options - Query options (autoPage is ignored, pagination is handled by the iterator)
   * @yields Batches of records as QueryResult objects
   *
   * @example
   * ```typescript
   * // Process records in batches
   * for await (const batch of client.queryStream({
   *   objectType: '1',
   *   fields: ['accountid', 'name'],
   *   pageSize: 100,
   * })) {
   *   console.log(`Processing ${batch.records.length} records...`);
   *   for (const record of batch.records) {
   *     // Process each record
   *   }
   * }
   *
   * // Collect all records from stream
   * const allRecords: Record<string, unknown>[] = [];
   * for await (const batch of client.queryStream({ objectType: '1', fields: '*' })) {
   *   allRecords.push(...batch.records);
   * }
   * ```
   */
  async *queryStream(
    options: Omit<QueryOptions, 'autoPage'>,
  ): AsyncGenerator<QueryResult, void, undefined> {
    const { objectType, fields, query, sortBy = 'modifiedon', sortType = 'desc', limit, pageSize = 500, showRealValue = true, signal } = options;

    // Normalize fields to string
    let fieldsStr: string;
    if (Array.isArray(fields)) {
      fieldsStr = fields.join(',');
    } else if (typeof fields === 'string') {
      fieldsStr = fields;
    } else {
      fieldsStr = '*';
    }

    // Handle '*' expansion for object types with excluded fields
    if (fieldsStr === '*') {
      fieldsStr = await this.expandStarFields(objectType, signal);
    }

    let currentPage = 1;
    let totalFetched = 0;
    let hasMore = true;

    while (hasMore) {
      // Check for abort
      if (signal?.aborted) {
        return;
      }

      // Calculate page size for this request
      const requestPageSize = limit
        ? Math.min(pageSize, limit - totalFetched)
        : pageSize;

      if (requestPageSize <= 0) {
        return;
      }

      const body = {
        objecttype: objectType,
        fields: fieldsStr,
        query: query || '',
        sort_by: sortBy,
        sort_type: sortType,
        page_size: requestPageSize,
        page_number: currentPage,
        show_real_value: showRealValue ? 1 : 0,
      };

      const response = await this.request<{ data?: { Data?: Record<string, unknown>[] } }>({
        method: 'POST',
        endpoint: '/api/query',
        body,
        signal,
      });

      const records = response.data?.Data || [];
      totalFetched += records.length;

      yield {
        records,
        total: records.length,
        success: true,
        page: currentPage,
      };

      // Check if there are more pages
      if (records.length < requestPageSize || (limit && totalFetched >= limit)) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }
  }

  /**
   * Executes a query against the Fireberry API
   * Automatically deduplicates concurrent identical requests
   * Optionally caches results (if cacheQueryResults is enabled)
   */
  async query(options: QueryOptions): Promise<QueryResult> {
    // Generate cache key for deduplication and caching
    const cacheKey = generateQueryCacheKey(options);

    // Check query result cache first
    if (this.config.cacheQueryResults) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.queryResultCacheTTL) {
        return cached.data;
      }
    }

    // Check for in-flight request with same parameters
    const inFlight = this.inFlightQueries.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    // Execute query and track it
    const queryPromise = this.executeQuery(options);

    // Store in-flight promise
    this.inFlightQueries.set(cacheKey, queryPromise);

    try {
      const result = await queryPromise;

      // Store in cache if caching is enabled
      if (this.config.cacheQueryResults) {
        // Cleanup expired entries on write
        this.cleanupExpiredCacheEntries();
        this.queryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } finally {
      // Remove from in-flight map when done
      this.inFlightQueries.delete(cacheKey);
    }
  }

  /**
   * Internal query execution (without deduplication)
   */
  private async executeQuery(options: QueryOptions): Promise<QueryResult> {
    const {
      objectType,
      fields,
      query,
      sortBy = 'modifiedon',
      sortType = 'desc',
      limit,
      page = 1,
      pageSize = 500,
      showRealValue = true,
      autoPage = true,
      signal,
    } = options;

    // Normalize fields to string
    let fieldsStr: string;
    if (Array.isArray(fields)) {
      fieldsStr = fields.join(',');
    } else if (typeof fields === 'string') {
      fieldsStr = fields;
    } else {
      fieldsStr = '*';
    }

    // Handle '*' expansion for object types with excluded fields
    if (fieldsStr === '*') {
      fieldsStr = await this.expandStarFields(objectType, signal);
    }

    // If autoPage is true, fetch all pages
    if (autoPage) {
      return this.queryAllPages({
        objectType,
        fields: fieldsStr,
        query,
        sortBy,
        sortType,
        showRealValue,
        limit,
        signal,
      });
    }

    // Single page query
    const body = {
      objecttype: objectType,
      fields: fieldsStr,
      query: query || '',
      sort_by: sortBy,
      sort_type: sortType,
      page_size: Math.min(pageSize, limit || 500),
      page_number: page,
      show_real_value: showRealValue ? 1 : 0,
    };

    const response = await this.request<{ data?: { Data?: Record<string, unknown>[] } }>({
      method: 'POST',
      endpoint: '/api/query',
      body,
      signal,
    });

    const records = response.data?.Data || [];

    return {
      records,
      total: records.length,
      success: true,
    };
  }

  /**
   * Fetches all pages of a query
   */
  private async queryAllPages(options: {
    objectType: string;
    fields: string;
    query?: string;
    sortBy: string;
    sortType: string;
    showRealValue: boolean;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<QueryResult> {
    const { objectType, fields, query, sortBy, sortType, showRealValue, limit, signal } = options;
    const maxPageSize = 500;
    const allRecords: Record<string, unknown>[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      const body = {
        objecttype: objectType,
        fields,
        query: query || '',
        sort_by: sortBy,
        sort_type: sortType,
        page_size: maxPageSize,
        page_number: currentPage,
        show_real_value: showRealValue ? 1 : 0,
      };

      const response = await this.request<{ data?: { Data?: Record<string, unknown>[] } }>({
        method: 'POST',
        endpoint: '/api/query',
        body,
        signal,
      });

      const pageData = response.data?.Data || [];
      allRecords.push(...pageData);

      // Check if we've reached the limit
      if (limit && allRecords.length >= limit) {
        allRecords.splice(limit);
        break;
      }

      // Check if there are more pages
      if (pageData.length < maxPageSize) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    return {
      records: allRecords,
      total: allRecords.length,
      success: true,
    };
  }

  /**
   * Expands '*' fields to actual field names, excluding problematic fields for specific object types
   */
  private async expandStarFields(objectType: string, signal?: AbortSignal): Promise<string> {
    const { getExcludedFieldsForStarQuery } = await import('./constants/excludedFields');
    const excludedFields = getExcludedFieldsForStarQuery(objectType);

    // If no excluded fields for this object type, just return '*'
    if (excludedFields.length === 0) {
      return '*';
    }

    // Fetch metadata to get all field names
    const fieldsResult = await this.metadata.getFields(objectType, signal);
    const allFieldNames = fieldsResult.fields.map((f) => f.fieldName);

    // Filter out excluded fields
    const filteredFields = allFieldNames.filter(
      (fieldName) => !excludedFields.includes(fieldName),
    );

    return filteredFields.join(',');
  }

  /**
   * Makes a raw API request to the Fireberry API
   */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const {
      method,
      endpoint,
      query: queryParams,
      body,
      headers: customHeaders,
      signal,
    } = options;

    // Build URL
    let url = `${this.config.baseUrl}${endpoint}`;

    // Add query parameters if any
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      url += `?${params.toString()}`;
    }

    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/json',
      tokenid: this.config.apiKey,
      ...customHeaders,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Execute with retry logic
    return this.executeWithRetry<T>(url, fetchOptions);
  }

  /**
   * Executes a fetch request with retry logic for 429 errors
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<T> {
    try {
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, this.config.timeout);

      // Combine signals if external signal provided
      const combinedSignal = options.signal
        ? this.combineSignals([options.signal, timeoutController.signal])
        : timeoutController.signal;

      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429 && this.config.retryOn429) {
        if (retryCount < this.config.maxRetries) {
          // Wait before retrying
          await wait(this.config.retryDelay);
          return this.executeWithRetry<T>(url, options, retryCount + 1);
        }
        throw new FireberryError('Rate limit exceeded after max retries', {
          code: FireberryErrorCode.RATE_LIMITED,
          statusCode: 429,
          context: { retryCount },
        });
      }

      // Parse response
      let body: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        throw createErrorFromResponse(response, body);
      }

      return body as T;
    } catch (error) {
      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw createNetworkError(error);
      }

      // Re-throw FireberryError
      if (error instanceof FireberryError) {
        throw error;
      }

      // Wrap other errors
      throw createNetworkError(error as Error);
    }
  }

  /**
   * Combines multiple abort signals into one
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }
}
