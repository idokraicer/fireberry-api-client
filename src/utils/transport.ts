/**
 * Utility functions for creating and managing transport instances
 */

import type { FireberryClientConfig } from '../types/client';
import type { Transport } from '../types/transport';
import { HTTPTransport } from '../transport/http';
import { SDKTransport } from '../transport/sdk';
import { FireberryError, FireberryErrorCode } from '../errors';

/**
 * Creates the appropriate transport based on client configuration
 * Priority: SDK > HTTP
 * If both are provided, SDK is used for CRUD operations
 */
export function createTransport(config: FireberryClientConfig): Transport {
  // SDK mode (with or without API key)
  if (config.sdk) {
    return new SDKTransport({ sdk: config.sdk });
  }

  // API key mode
  if (config.apiKey) {
    return new HTTPTransport({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryOn429: config.retryOn429,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
    });
  }

  // Neither provided
  throw new FireberryError(
    'Either apiKey or sdk must be provided in FireberryClientConfig',
    {
      code: FireberryErrorCode.INVALID_REQUEST,
    }
  );
}

/**
 * Creates HTTP transport for metadata operations when using SDK mode
 * Returns null if no API key is available
 */
export function createMetadataTransport(config: FireberryClientConfig): HTTPTransport | null {
  if (!config.apiKey) {
    return null;
  }

  return new HTTPTransport({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeout: config.timeout,
    retryOn429: config.retryOn429,
    maxRetries: config.maxRetries,
    retryDelay: config.retryDelay,
  });
}

/**
 * Checks if metadata operations are available
 */
export function isMetadataAvailable(config: FireberryClientConfig): boolean {
  // Metadata requires HTTP transport (API key)
  return Boolean(config.apiKey);
}

/**
 * Gets the connection mode based on configuration
 */
export function getConnectionMode(config: FireberryClientConfig): 'sdk' | 'api' | 'hybrid' {
  if (config.sdk && config.apiKey) {
    return 'hybrid';
  }
  if (config.sdk) {
    return 'sdk';
  }
  return 'api';
}
