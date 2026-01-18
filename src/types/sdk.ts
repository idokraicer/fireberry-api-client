/**
 * Type definitions for @fireberry/sdk compatibility
 * These types mirror the Fireberry SDK's API for seamless integration
 */

/**
 * Query payload expected by the Fireberry SDK
 */
export interface SDKQueryPayload {
  /** Comma-separated field names to return */
  fields: string;
  /** Query filter string */
  query: string;
  /** Number of records per page */
  page_size?: number;
  /** Page number (1-based) */
  page_number?: number;
}

/**
 * Response error from SDK
 */
export interface SDKResponseError {
  data: Record<string, unknown> & { Message?: string };
  status: number;
  statusText: string;
}

/**
 * Response data from SDK operations
 */
export interface SDKResponseData<T = Record<string, unknown>> {
  type?: string;
  success: boolean;
  data: T & { requestId?: string };
  error?: SDKResponseError;
  isParentReady: boolean;
  requestId: string;
}

/**
 * Record details from SDK context
 */
export interface SDKRecordDetails {
  type?: number;
  id?: string;
}

/**
 * User details from SDK context
 */
export interface SDKUserDetails {
  fullName?: string;
  id?: string;
}

/**
 * SDK context information
 */
export interface SDKContext {
  user: SDKUserDetails;
  record: SDKRecordDetails;
}

/**
 * Generic payload type for create/update operations
 */
export type SDKPayload = Record<string, unknown>;

/**
 * Fireberry SDK API interface
 * Matches the API surface of @fireberry/sdk
 */
export interface FireberrySDKAPI<TData = Record<string, unknown>> {
  /** Query records with filtering and pagination */
  query: (
    objectType: string | number,
    payload: SDKQueryPayload
  ) => Promise<SDKResponseData<TData>>;

  /** Create a new record */
  create: <T extends SDKPayload>(
    objectType: string | number,
    payload: T
  ) => Promise<SDKResponseData<TData>>;

  /** Delete a record by ID */
  delete: (
    objectType: string | number,
    recordId: string
  ) => Promise<SDKResponseData<TData>>;

  /** Update an existing record */
  update: <T extends SDKPayload>(
    objectType: string | number,
    recordId: string,
    payload: T
  ) => Promise<SDKResponseData<TData>>;
}

/**
 * Fireberry SDK Client interface
 * Matches the structure of FireberryClientSDK from @fireberry/sdk
 */
export interface FireberrySDKClient<TData = Record<string, unknown>> {
  /** Access to CRUD API methods */
  readonly api: FireberrySDKAPI<TData>;

  /** Current context (record and user info) - null if not initialized */
  readonly context: SDKContext | null;

  /** Initialize context from parent Fireberry window */
  initializeContext(): Promise<FireberrySDKClient<TData>>;

  /** Clean up event listeners and pending requests */
  destroy(): void;
}
