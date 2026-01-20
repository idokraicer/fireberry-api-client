import type { FireberryClient } from '../client';
import type {
  FireberryRecord,
  BatchCreateOptions,
  BatchUpdateOptions,
  BatchUpdateRecord,
  BatchDeleteOptions,
  BatchResult,
  BatchDeleteResult,
} from '../types/records';
import { chunkArray } from '../utils/helpers';

/** Maximum records per batch API call */
const BATCH_SIZE = 20;

/**
 * Batch API for bulk operations on Fireberry records
 * Automatically chunks large datasets into API-compatible batches of 20
 */
export class BatchAPI {
  constructor(private readonly client: FireberryClient) {}

  /**
   * Creates multiple records in batch
   * Automatically chunks into batches of 20 records
   *
   * @param objectType - The object type ID
   * @param records - Array of records to create
   * @param options - Optional settings
   * @returns Batch result with all created records
   *
   * @example
   * ```typescript
   * const result = await client.batch.create('1', [
   *   { accountname: 'Account 1' },
   *   { accountname: 'Account 2' },
   * ]);
   * console.log(result.count); // 2
   * ```
   */
  async create(
    objectType: string | number,
    records: FireberryRecord[],
    options?: BatchCreateOptions,
  ): Promise<BatchResult> {
    const objectTypeStr = String(objectType);
    const transport = this.client.getTransport();
    const batches = chunkArray(records, BATCH_SIZE);
    const allResponses: unknown[] = [];

    for (const batch of batches) {
      // Check for abort
      if (options?.signal?.aborted) {
        break;
      }

      const result = await transport.batchCreate(objectTypeStr, batch, options?.signal);
      allResponses.push(...result.data);
    }

    // Smart cache invalidation
    this.client.invalidateCacheForMutation(objectTypeStr);

    return {
      success: true,
      data: allResponses,
      count: allResponses.length,
    };
  }

  /**
   * Updates multiple records in batch
   * Automatically chunks into batches of 20 records
   *
   * @param objectType - The object type ID
   * @param records - Array of records with ID and data to update
   * @param options - Optional settings
   * @returns Batch result with all updated records
   *
   * @example
   * ```typescript
   * const result = await client.batch.update('1', [
   *   { id: 'abc123', record: { accountname: 'Updated 1' } },
   *   { id: 'def456', record: { accountname: 'Updated 2' } },
   * ]);
   * ```
   */
  async update(
    objectType: string | number,
    records: BatchUpdateRecord[],
    options?: BatchUpdateOptions,
  ): Promise<BatchResult> {
    const objectTypeStr = String(objectType);
    const transport = this.client.getTransport();
    const batches = chunkArray(records, BATCH_SIZE);
    const allResponses: unknown[] = [];

    for (const batch of batches) {
      // Check for abort
      if (options?.signal?.aborted) {
        break;
      }

      const result = await transport.batchUpdate(objectTypeStr, batch, options?.signal);
      allResponses.push(...result.data);
    }

    // Smart cache invalidation
    this.client.invalidateCacheForMutation(objectTypeStr);

    return {
      success: true,
      data: allResponses,
      count: allResponses.length,
    };
  }

  /**
   * Deletes multiple records in batch
   * Automatically chunks into batches of 20 records
   *
   * @param objectType - The object type ID
   * @param recordIds - Array of record IDs to delete
   * @param options - Optional settings
   * @returns Batch delete result with deleted IDs
   *
   * @example
   * ```typescript
   * const result = await client.batch.delete('1', ['abc123', 'def456']);
   * console.log(result.ids); // ['abc123', 'def456']
   * ```
   */
  async delete(
    objectType: string | number,
    recordIds: string[],
    options?: BatchDeleteOptions,
  ): Promise<BatchDeleteResult> {
    const objectTypeStr = String(objectType);
    const transport = this.client.getTransport();
    const batches = chunkArray(recordIds, BATCH_SIZE);
    const allDeletedIds: string[] = [];

    for (const batch of batches) {
      // Check for abort
      if (options?.signal?.aborted) {
        break;
      }

      const result = await transport.batchDelete(objectTypeStr, batch, options?.signal);
      allDeletedIds.push(...result.ids);
    }

    // Smart cache invalidation
    this.client.invalidateCacheForMutation(objectTypeStr);

    return {
      success: true,
      ids: allDeletedIds,
      count: allDeletedIds.length,
    };
  }
}
