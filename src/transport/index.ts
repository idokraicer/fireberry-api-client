/**
 * Transport layer for Fireberry API client
 * Provides abstraction over HTTP and SDK communication methods
 */

export { HTTPTransport } from './http';
export { SDKTransport } from './sdk';
export type {
  Transport,
  TransportRequestOptions,
  HTTPTransportConfig,
  SDKTransportConfig,
  TransportConfig,
} from '../types/transport';
export { isHTTPTransportConfig, isSDKTransportConfig } from '../types/transport';
