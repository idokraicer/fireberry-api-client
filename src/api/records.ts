import type { FireberryClient } from '../client';
import type {
  FireberryRecord,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  UpsertOptions,
  UpsertResult,
} from '../types/records';
import { getObjectIdFieldName } from '../constants/objectIds';

/**
 * Records API for CRUD operations on Fireberry records
 */
export class RecordsAPI {
  constructor(private readonly client: FireberryClient) {}

  /**
   * Creates a new record in Fireberry
   *
   * @param objectType - The object type ID (e.g., '1' for Account)
   * @param data - Record data to create
   * @param options - Optional settings
   * @returns Created record data
   *
   * @example
   * ```typescript
   * const result = await client.records.create('1', {
   *   accountname: 'New Account',
   *   emailaddress1: 'contact@example.com',
   * });
   * ```
   */
  async create(
    objectType: string | number,
    data: FireberryRecord,
    options?: CreateOptions,
  ): Promise<FireberryRecord> {
    const response = await this.client.request<{
      success: boolean;
      record: FireberryRecord;
      _id?: string;
    }>({
      method: 'POST',
      endpoint: `/api/v2/record/${objectType}`,
      body: data,
      signal: options?.signal,
    });

    return response.record;
  }

  /**
   * Updates an existing record in Fireberry
   *
   * @param objectType - The object type ID
   * @param recordId - The record ID to update
   * @param data - Record data to update
   * @param options - Optional settings
   * @returns Updated record data
   *
   * @example
   * ```typescript
   * const result = await client.records.update('1', 'abc123', {
   *   accountname: 'Updated Account Name',
   * });
   * ```
   */
  async update(
    objectType: string | number,
    recordId: string,
    data: FireberryRecord,
    options?: UpdateOptions,
  ): Promise<FireberryRecord> {
    const response = await this.client.request<{
      success: boolean;
      record: FireberryRecord;
      _id?: string;
    }>({
      method: 'PUT',
      endpoint: `/api/v2/record/${objectType}/${recordId}`,
      body: data,
      signal: options?.signal,
    });

    return response.record;
  }

  /**
   * Deletes a record from Fireberry
   *
   * @param objectType - The object type ID
   * @param recordId - The record ID to delete
   * @param options - Optional settings
   * @returns Success status
   *
   * @example
   * ```typescript
   * await client.records.delete('1', 'abc123');
   * ```
   */
  async delete(
    objectType: string | number,
    recordId: string,
    options?: DeleteOptions,
  ): Promise<{ success: boolean; id: string }> {
    // Note: Delete uses /api/record (not /api/v2/record)
    await this.client.request({
      method: 'DELETE',
      endpoint: `/api/record/${objectType}/${recordId}`,
      signal: options?.signal,
    });

    return {
      success: true,
      id: recordId,
    };
  }

  /**
   * Upserts a record (creates if not exists, updates if exists)
   *
   * @param objectType - The object type ID
   * @param keyFields - Fields to use for matching existing records
   * @param data - Record data to upsert
   * @param options - Optional settings
   * @returns Upsert result with operation type and record data
   *
   * @example
   * ```typescript
   * const result = await client.records.upsert('1', ['emailaddress1'], {
   *   accountname: 'Acme Corp',
   *   emailaddress1: 'contact@acme.com',
   * });
   * console.log(result.operationType); // 'create' or 'update'
   * ```
   */
  async upsert(
    objectType: string | number,
    keyFields: string[],
    data: FireberryRecord,
    options?: UpsertOptions,
  ): Promise<UpsertResult> {
    const objectTypeStr = String(objectType);

    // Build key values from data
    const upsertKeyValues: Record<string, unknown> = {};
    for (const key of keyFields) {
      if (!(key in data)) {
        throw new Error(`Missing value for upsert key field: ${key}`);
      }
      upsertKeyValues[key] = data[key];
    }

    // Build query to check if record exists
    const queryConditions = keyFields.map((key) => `(${key} = ${data[key]})`);
    const queryString = queryConditions.join(' and ');

    // Query for existing record
    const queryResult = await this.client.query({
      objectType: objectTypeStr,
      fields: '*',
      query: queryString,
      limit: 1,
      showRealValue: true,
      signal: options?.signal,
    });

    const existingRecords = queryResult.records as FireberryRecord[];

    if (existingRecords.length > 0) {
      // Record exists - UPDATE
      const existingRecord = existingRecords[0];
      const idFieldName = getObjectIdFieldName(objectTypeStr);
      const recordId = String(existingRecord[idFieldName]);

      const updatedRecord = await this.update(objectTypeStr, recordId, data, options);

      return {
        success: true,
        operationType: 'update',
        upsertKeys: keyFields,
        upsertKeyValues,
        oldRecord: existingRecord,
        newRecord: updatedRecord,
      };
    } else {
      // Record doesn't exist - CREATE
      const createdRecord = await this.create(objectTypeStr, data, options);

      return {
        success: true,
        operationType: 'create',
        upsertKeys: keyFields,
        upsertKeyValues,
        oldRecord: null,
        newRecord: createdRecord,
      };
    }
  }
}
