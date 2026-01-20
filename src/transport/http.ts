/**
 * HTTP Transport implementation for Fireberry API
 * Uses direct HTTP requests with API key authentication
 */

import type {
  Transport,
  TransportRequestOptions,
  HTTPTransportConfig,
} from '../types/transport';
import type { QueryOptions, QueryResult } from '../types/query';
import type { FireberryRecord } from '../types/records';
import {
  FireberryError,
  FireberryErrorCode,
  createErrorFromResponse,
  createNetworkError,
} from '../errors';
import { wait } from '../utils/helpers';

/**
 * HTTP transport for API key-based communication
 */
export class HTTPTransport implements Transport {
  private readonly config: Required<HTTPTransportConfig>;

  constructor(config: HTTPTransportConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.fireberry.com',
      timeout: config.timeout || 30000,
      retryOn429: config.retryOn429 ?? true,
      maxRetries: config.maxRetries || 120,
      retryDelay: config.retryDelay || 1000,
    };
  }

  getType(): 'http' {
    return 'http';
  }

  async request<T = unknown>(options: TransportRequestOptions): Promise<T> {
    const { method, endpoint, query: queryParams, body, headers: customHeaders, signal } = options;

    // Build URL
    let url = `${this.config.baseUrl}${endpoint}`;

    // Add query parameters if any
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      url += `?${params.toString()}`;
    }

    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/json',
      tokenid: this.config.apiKey,
      ...customHeaders,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Execute with retry logic
    return this.executeWithRetry<T>(url, fetchOptions);
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    const {
      objectType,
      fields,
      query,
      sortBy = 'modifiedon',
      sortType = 'desc',
      limit,
      page = 1,
      pageSize = 500,
      showRealValue = true,
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
        sortBy,
        sortType,
        showRealValue,
        limit,
        signal,
      });
    }

    // Single page query
    const body = {
      objecttype: objectType,
      fields: fieldsStr,
      query: query || '',
      sort_by: sortBy,
      sort_type: sortType,
      page_size: Math.min(pageSize, limit || 500),
      page_number: page,
      show_real_value: showRealValue ? 1 : 0,
    };

    const response = await this.request<{ data?: { Data?: Record<string, unknown>[] } }>({
      method: 'POST',
      endpoint: '/api/query',
      body,
      signal,
    });

    const records = response.data?.Data || [];

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
    const response = await this.request<{
      success: boolean;
      record: FireberryRecord;
      _id?: string;
    }>({
      method: 'POST',
      endpoint: `/api/v2/record/${objectType}`,
      body: data,
      signal,
    });

    return response.record;
  }

  async updateRecord(
    objectType: string,
    recordId: string,
    data: FireberryRecord,
    signal?: AbortSignal
  ): Promise<FireberryRecord> {
    const response = await this.request<{
      success: boolean;
      record: FireberryRecord;
      _id?: string;
    }>({
      method: 'PUT',
      endpoint: `/api/v2/record/${objectType}/${recordId}`,
      body: data,
      signal,
    });

    return response.record;
  }

  async deleteRecord(
    objectType: string,
    recordId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; id: string }> {
    // Note: Delete uses /api/record (not /api/v2/record)
    await this.request({
      method: 'DELETE',
      endpoint: `/api/record/${objectType}/${recordId}`,
      signal,
    });

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
    const response = await this.request<{ data?: unknown[] }>({
      method: 'POST',
      endpoint: `/api/v3/record/${objectType}/batch/create`,
      body: { data: records },
      signal,
    });

    const data = response.data || [];
    const dataArray = Array.isArray(data) ? data : [data];

    return {
      success: true,
      data: dataArray,
      count: dataArray.length,
    };
  }

  async batchUpdate(
    objectType: string,
    records: Array<{ id: string; record: FireberryRecord }>,
    signal?: AbortSignal
  ): Promise<{ success: boolean; data: unknown[]; count: number }> {
    const response = await this.request<{ data?: unknown[] }>({
      method: 'POST',
      endpoint: `/api/v3/record/${objectType}/batch/update`,
      body: { data: records },
      signal,
    });

    const data = response.data || [];
    const dataArray = Array.isArray(data) ? data : [data];

    return {
      success: true,
      data: dataArray,
      count: dataArray.length,
    };
  }

  async batchDelete(
    objectType: string,
    recordIds: string[],
    signal?: AbortSignal
  ): Promise<{ success: boolean; ids: string[]; count: number }> {
    await this.request({
      method: 'POST',
      endpoint: `/api/v3/record/${objectType}/batch/delete`,
      body: { data: recordIds },
      signal,
    });

    return {
      success: true,
      ids: recordIds,
      count: recordIds.length,
    };
  }

  /**
   * Fetches all pages of a query
   */
  private async queryAllPages(options: {
    objectType: string;
    fields: string;
    query?: string;
    sortBy: string;
    sortType: string;
    showRealValue: boolean;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<QueryResult> {
    const { objectType, fields, query, sortBy, sortType, showRealValue, limit, signal } = options;
    const maxPageSize = 500;
    const allRecords: Record<string, unknown>[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      const body = {
        objecttype: objectType,
        fields,
        query: query || '',
        sort_by: sortBy,
        sort_type: sortType,
        page_size: maxPageSize,
        page_number: currentPage,
        show_real_value: showRealValue ? 1 : 0,
      };

      const response = await this.request<{ data?: { Data?: Record<string, unknown>[] } }>({
        method: 'POST',
        endpoint: '/api/query',
        body,
        signal,
      });

      const pageData = response.data?.Data || [];
      allRecords.push(...pageData);

      // Check if we've reached the limit
      if (limit && allRecords.length >= limit) {
        allRecords.splice(limit);
        break;
      }

      // Check if there are more pages
      if (pageData.length < maxPageSize) {
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

  /**
   * Executes a fetch request with retry logic for 429 errors
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<T> {
    try {
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, this.config.timeout);

      // Combine signals if external signal provided
      const combinedSignal = options.signal
        ? this.combineSignals([options.signal, timeoutController.signal])
        : timeoutController.signal;

      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429 && this.config.retryOn429) {
        if (retryCount < this.config.maxRetries) {
          // Wait before retrying
          await wait(this.config.retryDelay);
          return this.executeWithRetry<T>(url, options, retryCount + 1);
        }
        throw new FireberryError('Rate limit exceeded after max retries', {
          code: FireberryErrorCode.RATE_LIMITED,
          statusCode: 429,
          context: { retryCount },
        });
      }

      // Parse response
      let body: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        throw createErrorFromResponse(response, body);
      }

      return body as T;
    } catch (error) {
      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        throw createNetworkError(error);
      }

      // Re-throw FireberryError
      if (error instanceof FireberryError) {
        throw error;
      }

      // Wrap other errors
      throw createNetworkError(error as Error);
    }
  }

  /**
   * Combines multiple abort signals into one
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }
}
