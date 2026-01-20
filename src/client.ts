import type {
  FireberryClientConfig,
  RequestOptions,
  CacheControl,
} from './types/client';
import type { QueryOptions, QueryResult } from './types/query';
import type { Transport } from './types/transport';
import {
  FireberryError,
  FireberryErrorCode,
} from './errors';
import { QueryBuilder } from './utils/queryBuilder';
import { createTransport, createMetadataTransport, isMetadataAvailable } from './utils/transport';
import { HTTPTransport } from './transport/http';

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
  private readonly config: FireberryClientConfig;
  private readonly normalizedConfig: {
    baseUrl: string;
    timeout: number;
    retryOn429: boolean;
    maxRetries: number;
    retryDelay: number;
    cacheMetadata: boolean;
    cacheTTL: number;
    cacheQueryResults: boolean;
    queryResultCacheTTL: number;
    invalidateCacheOnMutation: boolean;
  };
  private readonly cacheStore: CacheStore;
  private readonly inFlightQueries: Map<string, Promise<QueryResult>> = new Map();
  private readonly queryCache: Map<string, QueryCache> = new Map();
  private readonly transport: Transport;
  private readonly metadataTransport: HTTPTransport | null;

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
    // Store original config
    this.config = config;

    // Create normalized config for settings
    this.normalizedConfig = {
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

    // Create transport layer
    this.transport = createTransport(config);
    this.metadataTransport = createMetadataTransport(config);

    // Initialize API modules
    this.metadata = new MetadataAPI(this);
    this.records = new RecordsAPI(this);
    this.batch = new BatchAPI(this);
    this.fields = new FieldsAPI(this);
    this.files = new FilesAPI(this);
  }

  /**
   * Gets the client configuration with all defaults applied
   */
  getConfig(): Readonly<FireberryClientConfig & {
    baseUrl: string;
    timeout: number;
    retryOn429: boolean;
    maxRetries: number;
    retryDelay: number;
    cacheMetadata: boolean;
    cacheTTL: number;
    cacheQueryResults: boolean;
    queryResultCacheTTL: number;
    invalidateCacheOnMutation: boolean;
  }> {
    return {
      ...this.config,
      ...this.normalizedConfig,
    };
  }

  /**
   * Gets the transport instance (for internal use by API modules)
   * @internal
   */
  getTransport(): Transport {
    return this.transport;
  }

  /**
   * Gets the metadata transport instance (for internal use by MetadataAPI)
   * Returns null if metadata is not available (SDK-only mode without API key)
   * @internal
   */
  getMetadataTransport(): HTTPTransport | null {
    return this.metadataTransport;
  }

  /**
   * Checks if metadata operations are available
   */
  isMetadataAvailable(): boolean {
    return isMetadataAvailable(this.config);
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
    if (this.normalizedConfig.invalidateCacheOnMutation) {
      this.cache.clearQueryResultsForObject(objectType);
    }
  }

  /**
   * Cleans up expired cache entries (called on write to prevent memory leaks)
   */
  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();

    // Clean query cache
    if (this.normalizedConfig.cacheQueryResults) {
      for (const [key, entry] of this.queryCache) {
        if (now - entry.timestamp >= this.normalizedConfig.queryResultCacheTTL) {
          this.queryCache.delete(key);
        }
      }
    }

    // Clean metadata caches
    if (this.normalizedConfig.cacheMetadata) {
      // Clean objects cache
      if (this.cacheStore.objects && now - this.cacheStore.objects.timestamp >= this.normalizedConfig.cacheTTL) {
        this.cacheStore.objects = undefined;
      }

      // Clean fields cache
      for (const [key, entry] of this.cacheStore.fields) {
        if (now - entry.timestamp >= this.normalizedConfig.cacheTTL) {
          this.cacheStore.fields.delete(key);
        }
      }

      // Clean fieldValues cache
      for (const [key, entry] of this.cacheStore.fieldValues) {
        if (now - entry.timestamp >= this.normalizedConfig.cacheTTL) {
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
    if (!this.normalizedConfig.cacheMetadata) {
      return undefined;
    }

    const now = Date.now();

    if (type === 'objects') {
      const cached = this.cacheStore.objects;
      if (cached && now - cached.timestamp < this.normalizedConfig.cacheTTL) {
        return cached.data as T;
      }
    } else if (type === 'fields' && objectType) {
      const cached = this.cacheStore.fields.get(objectType);
      if (cached && now - cached.timestamp < this.normalizedConfig.cacheTTL) {
        return cached.data as T;
      }
    } else if (type === 'fieldValues' && objectType && fieldName) {
      const key = `${objectType}:${fieldName}`;
      const cached = this.cacheStore.fieldValues.get(key);
      if (cached && now - cached.timestamp < this.normalizedConfig.cacheTTL) {
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
    if (!this.normalizedConfig.cacheMetadata) {
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
    if (this.normalizedConfig.cacheQueryResults) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.normalizedConfig.queryResultCacheTTL) {
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
      if (this.normalizedConfig.cacheQueryResults) {
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

    // Use transport to execute the query
    return this.transport.query({
      ...options,
      fields: fieldsStr,
    });
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
   * @deprecated Use getTransport() or getMetadataTransport() for new code
   * @internal This method is kept for backwards compatibility with API modules
   */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    // Delegate to metadata transport if available (for metadata operations)
    // Otherwise use the main transport
    const transport = this.metadataTransport || this.transport;

    // For HTTP transport, delegate directly
    if (transport instanceof HTTPTransport) {
      return transport.request<T>(options);
    }

    // For SDK transport, throw error since raw requests aren't supported
    throw new FireberryError(
      'Raw request() is not supported in SDK mode. Use specific methods like query(), createRecord(), etc.',
      {
        code: FireberryErrorCode.INVALID_REQUEST,
      }
    );
  }
}
