/**
 * SDK Transport implementation for Fireberry SDK
 * Uses iframe messaging through the @fireberry/sdk package
 */

import type {
  Transport,
  TransportRequestOptions,
  SDKTransportConfig,
} from '../types/transport';
import type { QueryOptions, QueryResult } from '../types/query';
import type { FireberryRecord } from '../types/records';
import type { FireberrySDKClient, SDKQueryPayload } from '../types/sdk';
import { FireberryError, FireberryErrorCode } from '../errors';
import { chunkArray } from '../utils/helpers';

/** Maximum records per batch operation */
const BATCH_SIZE = 20;

/**
 * SDK transport for iframe messaging-based communication
 */
export class SDKTransport implements Transport {
  private readonly sdk: FireberrySDKClient;

  constructor(config: SDKTransportConfig) {
    this.sdk = config.sdk;
  }

  getType(): 'sdk' {
    return 'sdk';
  }

  async request<T = unknown>(_options: TransportRequestOptions): Promise<T> {
    throw new FireberryError(
      'Raw request() is not supported in SDK mode. Use specific methods like query(), createRecord(), etc.',
      {
        code: FireberryErrorCode.INVALID_REQUEST,
      }
    );
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    const {
      objectType,
      fields,
      query,
      limit,
      page = 1,
      pageSize = 500,
      autoPage = true,
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
        limit,
        pageSize,
        signal,
      });
    }

    // Single page query
    const payload: SDKQueryPayload = {
      fields: fieldsStr,
      query: query || '',
      page_size: Math.min(pageSize, limit || 500),
      page_number: page,
    };

    const response = await this.sdk.api.query(objectType, payload);

    if (!response.success && response.error) {
      throw new FireberryError(
        response.error.data?.Message || response.error.statusText || 'SDK query failed',
        {
          code: FireberryErrorCode.SERVER_ERROR,
          statusCode: response.error.status,
          context: { response },
        }
      );
    }

    // SDK returns data differently than HTTP API
    // We need to normalize the response
    const records = Array.isArray(response.data) ? response.data : [response.data];

    return {
      records,
      total: records.length,
      success: true,
    };
  }

  async createRecord(
    objectType: string,
    data: FireberryRecord,
    signal?: AbortSignal
  ): Promise<FireberryRecord> {
    // Check for abort
    if (signal?.aborted) {
      throw new FireberryError('Request aborted', {
        code: FireberryErrorCode.NETWORK_ERROR,
      });
    }

    const response = await this.sdk.api.create(objectType, data);

    if (!response.success && response.error) {
      throw new FireberryError(
        response.error.data?.Message || response.error.statusText || 'SDK create failed',
        {
          code: FireberryErrorCode.SERVER_ERROR,
          statusCode: response.error.status,
          context: { response },
        }
      );
    }

    return response.data as FireberryRecord;
  }

  async updateRecord(
    objectType: string,
    recordId: string,
    data: FireberryRecord,
    signal?: AbortSignal
  ): Promise<FireberryRecord> {
    // Check for abort
    if (signal?.aborted) {
      throw new FireberryError('Request aborted', {
        code: FireberryErrorCode.NETWORK_ERROR,
      });
    }

    const response = await this.sdk.api.update(objectType, recordId, data);

    if (!response.success && response.error) {
      throw new FireberryError(
        response.error.data?.Message || response.error.statusText || 'SDK update failed',
        {
          code: FireberryErrorCode.SERVER_ERROR,
          statusCode: response.error.status,
          context: { response },
        }
      );
    }

    return response.data as FireberryRecord;
  }

  async deleteRecord(
    objectType: string,
    recordId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; id: string }> {
    // Check for abort
    if (signal?.aborted) {
      throw new FireberryError('Request aborted', {
        code: FireberryErrorCode.NETWORK_ERROR,
      });
    }

    const response = await this.sdk.api.delete(objectType, recordId);

    if (!response.success && response.error) {
      throw new FireberryError(
        response.error.data?.Message || response.error.statusText || 'SDK delete failed',
        {
          code: FireberryErrorCode.SERVER_ERROR,
          statusCode: response.error.status,
          context: { response },
        }
      );
    }

    return {
      success: true,
      id: recordId,
    };
  }

  async batchCreate(
    objectType: string,
    records: FireberryRecord[],
    signal?: AbortSignal
  ): Promise<{ success: boolean; data: unknown[]; count: number }> {
    const batches = chunkArray(records, BATCH_SIZE);
    const allResponses: unknown[] = [];

    for (const batch of batches) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      // SDK doesn't have native batch operations, so we create records one by one
      // This is less efficient but maintains consistency
      const batchPromises = batch.map((record) => this.createRecord(objectType, record, signal));
      const batchResults = await Promise.all(batchPromises);
      allResponses.push(...batchResults);
    }

    return {
      success: true,
      data: allResponses,
      count: allResponses.length,
    };
  }

  async batchUpdate(
    objectType: string,
    records: Array<{ id: string; record: FireberryRecord }>,
    signal?: AbortSignal
  ): Promise<{ success: boolean; data: unknown[]; count: number }> {
    const batches = chunkArray(records, BATCH_SIZE);
    const allResponses: unknown[] = [];

    for (const batch of batches) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      // SDK doesn't have native batch operations, so we update records one by one
      const batchPromises = batch.map((item) =>
        this.updateRecord(objectType, item.id, item.record, signal)
      );
      const batchResults = await Promise.all(batchPromises);
      allResponses.push(...batchResults);
    }

    return {
      success: true,
      data: allResponses,
      count: allResponses.length,
    };
  }

  async batchDelete(
    objectType: string,
    recordIds: string[],
    signal?: AbortSignal
  ): Promise<{ success: boolean; ids: string[]; count: number }> {
    const batches = chunkArray(recordIds, BATCH_SIZE);
    const allDeletedIds: string[] = [];

    for (const batch of batches) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      // SDK doesn't have native batch operations, so we delete records one by one
      const batchPromises = batch.map((id) => this.deleteRecord(objectType, id, signal));
      await Promise.all(batchPromises);
      allDeletedIds.push(...batch);
    }

    return {
      success: true,
      ids: allDeletedIds,
      count: allDeletedIds.length,
    };
  }

  /**
   * Fetches all pages of a query using SDK
   */
  private async queryAllPages(options: {
    objectType: string;
    fields: string;
    query?: string;
    limit?: number;
    pageSize?: number;
    signal?: AbortSignal;
  }): Promise<QueryResult> {
    const { objectType, fields, query, limit, pageSize = 500, signal } = options;
    const maxPageSize = 500;
    const allRecords: Record<string, unknown>[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      const payload: SDKQueryPayload = {
        fields,
        query: query || '',
        page_size: Math.min(maxPageSize, pageSize),
        page_number: currentPage,
      };

      const response = await this.sdk.api.query(objectType, payload);

      if (!response.success && response.error) {
        throw new FireberryError(
          response.error.data?.Message || response.error.statusText || 'SDK query failed',
          {
            code: FireberryErrorCode.SERVER_ERROR,
            statusCode: response.error.status,
            context: { response },
          }
        );
      }

      const pageData = Array.isArray(response.data) ? response.data : [response.data];

      // Filter out empty/invalid records
      const validRecords = pageData.filter(
        (record) => record && typeof record === 'object'
      ) as Record<string, unknown>[];

      allRecords.push(...validRecords);

      // Check if we've reached the limit
      if (limit && allRecords.length >= limit) {
        allRecords.splice(limit);
        break;
      }

      // Check if there are more pages
      if (validRecords.length < maxPageSize) {
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
}
