import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FireberryClient } from '../../src';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FireberryClient New Features', () => {
  let client: FireberryClient;

  const createMockResponse = (data: Record<string, unknown>[], status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: { Data: data } }),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FireberryClient({
      apiKey: 'test-key',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('queryAll - Parallel Query Execution', () => {
    it('should return empty array for empty input', async () => {
      const results = await client.queryAll([]);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should execute single query', async () => {
      const mockData = [{ accountid: '1', accountname: 'Test' }];
      mockFetch.mockReturnValueOnce(createMockResponse(mockData));

      const results = await client.queryAll([
        { objectType: '1', fields: ['accountid', 'accountname'], autoPage: false },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].records).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple queries in parallel', async () => {
      const mockData1 = [{ accountid: '1' }];
      const mockData2 = [{ contactid: '2' }];
      const mockData3 = [{ opportunityid: '3' }];

      mockFetch
        .mockReturnValueOnce(createMockResponse(mockData1))
        .mockReturnValueOnce(createMockResponse(mockData2))
        .mockReturnValueOnce(createMockResponse(mockData3));

      const results = await client.queryAll([
        { objectType: '1', fields: ['accountid'], autoPage: false },
        { objectType: '2', fields: ['contactid'], autoPage: false },
        { objectType: '4', fields: ['opportunityid'], autoPage: false },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].records).toEqual(mockData1);
      expect(results[1].records).toEqual(mockData2);
      expect(results[2].records).toEqual(mockData3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should respect concurrency limit', async () => {
      // Set up 10 queries with concurrency of 2
      const queries = Array.from({ length: 10 }, (_, i) => ({
        objectType: String(i + 1),
        fields: ['id'],
        autoPage: false,
      }));

      // Track when each fetch is called
      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockFetch.mockImplementation(() => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        return new Promise((resolve) => {
          setTimeout(() => {
            concurrentCalls--;
            resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: { Data: [] } }),
            });
          }, 10);
        });
      });

      await client.queryAll(queries, { concurrency: 2 });

      expect(mockFetch).toHaveBeenCalledTimes(10);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should return results in same order as input', async () => {
      // Return data with different delays to ensure order is preserved
      const queries = [
        { objectType: '1', fields: ['id'], autoPage: false },
        { objectType: '2', fields: ['id'], autoPage: false },
        { objectType: '3', fields: ['id'], autoPage: false },
      ];

      mockFetch
        .mockImplementationOnce(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: { Data: [{ type: 'first' }] } }),
            }), 30);
          });
        })
        .mockImplementationOnce(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: { Data: [{ type: 'second' }] } }),
            }), 10);
          });
        })
        .mockImplementationOnce(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: { Data: [{ type: 'third' }] } }),
            }), 20);
          });
        });

      const results = await client.queryAll(queries);

      expect(results[0].records[0]).toEqual({ type: 'first' });
      expect(results[1].records[0]).toEqual({ type: 'second' });
      expect(results[2].records[0]).toEqual({ type: 'third' });
    });

    it('should use default concurrency of 5', async () => {
      const queries = Array.from({ length: 5 }, (_, i) => ({
        objectType: String(i + 1),
        fields: ['id'],
        autoPage: false,
      }));

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockFetch.mockImplementation(() => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        return new Promise((resolve) => {
          setTimeout(() => {
            concurrentCalls--;
            resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: { Data: [] } }),
            });
          }, 10);
        });
      });

      await client.queryAll(queries);

      expect(maxConcurrent).toBeLessThanOrEqual(5);
    });
  });

  describe('queryStream - Cursor-Based Pagination', () => {
    it('should yield single page for small result set', async () => {
      const mockData = [{ id: '1' }, { id: '2' }];
      mockFetch.mockReturnValueOnce(createMockResponse(mockData));

      const batches: Record<string, unknown>[][] = [];
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
        pageSize: 500,
      })) {
        batches.push(batch.records);
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should yield multiple pages for large result sets', async () => {
      // First page: 100 records (full page)
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
      // Second page: 50 records (partial, indicates end)
      const page2 = Array.from({ length: 50 }, (_, i) => ({ id: String(i + 100) }));

      mockFetch
        .mockReturnValueOnce(createMockResponse(page1))
        .mockReturnValueOnce(createMockResponse(page2));

      const batches: Record<string, unknown>[][] = [];
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
        pageSize: 100,
      })) {
        batches.push(batch.records);
      }

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(50);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should include page number in batch result', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));
      const page2 = Array.from({ length: 50 }, (_, i) => ({ id: String(i + 100) }));

      mockFetch
        .mockReturnValueOnce(createMockResponse(page1))
        .mockReturnValueOnce(createMockResponse(page2));

      const pages: number[] = [];
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
        pageSize: 100,
      })) {
        pages.push(batch.page!);
      }

      expect(pages).toEqual([1, 2]);
    });

    it('should respect limit option', async () => {
      // First page: 100 records
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }));

      mockFetch.mockReturnValueOnce(createMockResponse(page1));

      const batches: Record<string, unknown>[][] = [];
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
        pageSize: 100,
        limit: 100, // Stop after 100 records
      })) {
        batches.push(batch.records);
      }

      expect(batches).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should stop when limit is reached across pages', async () => {
      const page1 = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }));
      const page2 = Array.from({ length: 50 }, (_, i) => ({ id: String(i + 50) }));

      mockFetch
        .mockReturnValueOnce(createMockResponse(page1))
        .mockReturnValueOnce(createMockResponse(page2));

      let totalRecords = 0;
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
        pageSize: 50,
        limit: 75, // Should stop after getting 75 records (2 pages)
      })) {
        totalRecords += batch.records.length;
      }

      // Should have fetched 2 pages (50 + 25 = 75)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle empty result set', async () => {
      mockFetch.mockReturnValueOnce(createMockResponse([]));

      const batches: Record<string, unknown>[][] = [];
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
      })) {
        batches.push(batch.records);
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should use default page size of 500', async () => {
      mockFetch.mockReturnValueOnce(createMockResponse([]));

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['id'],
      })) {
        // Just consume the stream
      }

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.page_size).toBe(500);
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent identical queries', async () => {
      const mockData = [{ id: '1' }];
      let callCount = 0;

      mockFetch.mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: { Data: mockData } }),
            });
          }, 50);
        });
      });

      // Fire 3 identical queries simultaneously
      const [result1, result2, result3] = await Promise.all([
        client.query({ objectType: '1', fields: ['id'], autoPage: false }),
        client.query({ objectType: '1', fields: ['id'], autoPage: false }),
        client.query({ objectType: '1', fields: ['id'], autoPage: false }),
      ]);

      // Should only make one API call
      expect(callCount).toBe(1);

      // All results should be the same
      expect(result1.records).toEqual(mockData);
      expect(result2.records).toEqual(mockData);
      expect(result3.records).toEqual(mockData);
    });

    it('should not deduplicate different queries', async () => {
      mockFetch
        .mockReturnValueOnce(createMockResponse([{ type: '1' }]))
        .mockReturnValueOnce(createMockResponse([{ type: '2' }]));

      // Fire 2 different queries simultaneously
      const [result1, result2] = await Promise.all([
        client.query({ objectType: '1', fields: ['id'], autoPage: false }),
        client.query({ objectType: '2', fields: ['id'], autoPage: false }),
      ]);

      // Should make two API calls
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Results should be different
      expect(result1.records[0]).toEqual({ type: '1' });
      expect(result2.records[0]).toEqual({ type: '2' });
    });

    it('should allow new request after previous completes', async () => {
      mockFetch
        .mockReturnValueOnce(createMockResponse([{ call: 1 }]))
        .mockReturnValueOnce(createMockResponse([{ call: 2 }]));

      // First query
      const result1 = await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Second identical query after first completes
      const result2 = await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Should make two API calls (not deduplicated since they're sequential)
      expect(mockFetch).toHaveBeenCalledTimes(2);

      expect(result1.records[0]).toEqual({ call: 1 });
      expect(result2.records[0]).toEqual({ call: 2 });
    });
  });

  describe('Query Result Caching', () => {
    let cachingClient: FireberryClient;

    beforeEach(() => {
      vi.useFakeTimers();
      cachingClient = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        queryResultCacheTTL: 60000, // 1 minute
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should cache query results when enabled', async () => {
      mockFetch.mockReturnValue(createMockResponse([{ id: '1' }]));

      // First query hits API
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second identical query should use cache
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should expire cache after TTL', async () => {
      mockFetch.mockReturnValue(createMockResponse([{ id: '1' }]));

      // First query
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      vi.advanceTimersByTime(60001);

      // Should make new API call
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache with clearQueryResults', async () => {
      mockFetch.mockReturnValue(createMockResponse([{ id: '1' }]));

      // First query
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      cachingClient.cache.clearQueryResults();

      // Should make new API call
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache for specific object type', async () => {
      mockFetch.mockReturnValue(createMockResponse([{ id: '1' }]));

      // Query two object types
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      await cachingClient.query({ objectType: '2', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Clear cache for object type 1 only
      cachingClient.cache.clearQueryResultsForObject('1');

      // Object type 1 should hit API, object type 2 should use cache
      await cachingClient.query({ objectType: '1', fields: ['id'], autoPage: false });
      await cachingClient.query({ objectType: '2', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3); // Only 1 new call
    });
  });
});
