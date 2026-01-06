/**
 * Configuration options for FireberryClient
 */
export interface FireberryClientConfig {
  /** Fireberry API key */
  apiKey: string;
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
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  cacheTTL?: number;
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
