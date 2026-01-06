/**
 * Generic record type
 */
export type FireberryRecord = Record<string, unknown>;

/**
 * Options for create operation
 */
export interface CreateOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Options for update operation
 */
export interface UpdateOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Options for delete operation
 */
export interface DeleteOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Options for upsert operation
 */
export interface UpsertOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result of upsert operation
 */
export interface UpsertResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Type of operation performed */
  operationType: 'create' | 'update';
  /** Key fields used for matching */
  upsertKeys: string[];
  /** Values of key fields */
  upsertKeyValues: Record<string, unknown>;
  /** Previous record data (null if created) */
  oldRecord: FireberryRecord | null;
  /** New record data */
  newRecord: FireberryRecord;
}

/**
 * Options for batch create operation
 */
export interface BatchCreateOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Options for batch update operation
 */
export interface BatchUpdateOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Record for batch update (includes id)
 */
export interface BatchUpdateRecord {
  id: string;
  record: FireberryRecord;
}

/**
 * Options for batch delete operation
 */
export interface BatchDeleteOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result of batch operation
 */
export interface BatchResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Response data from API */
  data: unknown[];
  /** Number of records processed */
  count: number;
}

/**
 * Result of batch delete operation
 */
export interface BatchDeleteResult {
  /** Whether the operation was successful */
  success: boolean;
  /** IDs of deleted records */
  ids: string[];
  /** Number of records deleted */
  count: number;
}
