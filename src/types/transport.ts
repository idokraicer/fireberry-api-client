/**
 * Transport layer types for abstracting communication with Fireberry
 * Supports both HTTP API and SDK iframe messaging
 */

import type { QueryOptions, QueryResult } from './query';
import type { FireberryRecord } from './records';
import type { FireberrySDKClient } from './sdk';

/**
 * Generic transport request options
 */
export interface TransportRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Transport interface that both HTTP and SDK implementations must follow
 */
export interface Transport {
  /**
   * Execute a raw request through this transport
   */
  request<T = unknown>(options: TransportRequestOptions): Promise<T>;

  /**
   * Execute a query operation
   */
  query(options: QueryOptions): Promise<QueryResult>;

  /**
   * Create a record
   */
  createRecord(objectType: string, data: FireberryRecord, signal?: AbortSignal): Promise<FireberryRecord>;

  /**
   * Update a record
   */
  updateRecord(
    objectType: string,
    recordId: string,
    data: FireberryRecord,
    signal?: AbortSignal
  ): Promise<FireberryRecord>;

  /**
   * Delete a record
   */
  deleteRecord(
    objectType: string,
    recordId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; id: string }>;

  /**
   * Batch create records
   */
  batchCreate(
    objectType: string,
    records: FireberryRecord[],
    signal?: AbortSignal
  ): Promise<{ success: boolean; data: unknown[]; count: number }>;

  /**
   * Batch update records
   */
  batchUpdate(
    objectType: string,
    records: Array<{ id: string; record: FireberryRecord }>,
    signal?: AbortSignal
  ): Promise<{ success: boolean; data: unknown[]; count: number }>;

  /**
   * Batch delete records
   */
  batchDelete(
    objectType: string,
    recordIds: string[],
    signal?: AbortSignal
  ): Promise<{ success: boolean; ids: string[]; count: number }>;

  /**
   * Get the transport type
   */
  getType(): 'http' | 'sdk';
}

/**
 * Configuration for HTTP transport
 */
export interface HTTPTransportConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryOn429?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Configuration for SDK transport
 */
export interface SDKTransportConfig {
  sdk: FireberrySDKClient;
}

/**
 * Union type for transport configuration
 */
export type TransportConfig = HTTPTransportConfig | SDKTransportConfig;

/**
 * Type guard to check if config is HTTP transport config
 */
export function isHTTPTransportConfig(config: TransportConfig): config is HTTPTransportConfig {
  return 'apiKey' in config;
}

/**
 * Type guard to check if config is SDK transport config
 */
export function isSDKTransportConfig(config: TransportConfig): config is SDKTransportConfig {
  return 'sdk' in config;
}
