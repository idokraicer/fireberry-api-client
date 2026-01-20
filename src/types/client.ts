import type { FireberrySDKClient } from './sdk';

/**
 * Configuration options for FireberryClient
 * Supports two modes:
 * 1. API Key mode: Provide apiKey for direct HTTP API access
 * 2. SDK mode: Provide sdk for iframe messaging (CRUD only, metadata requires apiKey)
 * 3. Hybrid mode: Provide both sdk and apiKey (SDK for CRUD, API for metadata)
 */
export interface FireberryClientConfig {
  /**
   * Fireberry API key (required for API mode, optional for SDK mode)
   * If using SDK mode without apiKey, metadata operations will not be available
   */
  apiKey?: string;

  /**
   * Fireberry SDK client instance (optional)
   * When provided, CRUD operations will use SDK iframe messaging instead of HTTP
   */
  sdk?: FireberrySDKClient;

  /** Base URL for API requests (default: https://api.fireberry.com) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to retry on 429 rate limit errors (default: true) */
  retryOn429?: boolean;
  /** Maximum number of retries for 429 errors (default: 120) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Enable in-memory metadata cache (default: false) */
  cacheMetadata?: boolean;
  /** Metadata cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTTL?: number;
  /** Enable query result caching (default: false) */
  cacheQueryResults?: boolean;
  /** Query result cache TTL in milliseconds (default: 60000 = 1 minute) */
  queryResultCacheTTL?: number;
  /**
   * Automatically invalidate query cache when mutations occur (default: true)
   * When enabled, create/update/delete operations will automatically clear
   * the query result cache for the affected object type.
   */
  invalidateCacheOnMutation?: boolean;
}

/**
 * Options for HTTP requests
 */
export interface RequestOptions {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** API endpoint path */
  endpoint: string;
  /** Query parameters */
  query?: Record<string, string | number | boolean>;
  /** Request body */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Cache control interface
 */
export interface CacheControl {
  /** Clear entire cache */
  clear(): void;
  /** Clear fields cache for an object type */
  clearFields(objectType: string): void;
  /** Clear field values cache for a specific field */
  clearFieldValues(objectType: string, fieldName: string): void;
  /** Clear objects cache */
  clearObjects(): void;
}
