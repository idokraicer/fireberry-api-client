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
  readonly cache: CacheControl = {
    clear: () => {
      this.cacheStore.objects = undefined;
      this.cacheStore.fields.clear();
      this.cacheStore.fieldValues.clear();
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
  };

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
   * Executes a query against the Fireberry API
   */
  async query(options: QueryOptions): Promise<QueryResult> {
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
      autoPage = false,
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

    // Add query parameters
    const params = new URLSearchParams();
    params.set('tokenid', this.config.apiKey);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
    }
    url += `?${params.toString()}`;

    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/json',
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
