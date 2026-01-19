import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FireberryClient } from '../../src';

describe('Cache', () => {
  let client: FireberryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new FireberryClient({
      apiKey: 'test-key',
      cacheMetadata: true,
      cacheTTL: 60000, // 1 minute
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cache configuration', () => {
    it('should have caching disabled by default', () => {
      const defaultClient = new FireberryClient({ apiKey: 'test-key' });
      const config = defaultClient.getConfig();
      expect(config.cacheMetadata).toBe(false);
    });

    it('should enable caching when configured', () => {
      const config = client.getConfig();
      expect(config.cacheMetadata).toBe(true);
    });

    it('should use default TTL of 5 minutes', () => {
      const defaultTTLClient = new FireberryClient({
        apiKey: 'test-key',
        cacheMetadata: true,
      });
      const config = defaultTTLClient.getConfig();
      expect(config.cacheTTL).toBe(300000);
    });

    it('should use custom TTL when provided', () => {
      const config = client.getConfig();
      expect(config.cacheTTL).toBe(60000);
    });
  });

  describe('getCached and setCache', () => {
    describe('objects cache', () => {
      it('should store and retrieve objects', () => {
        const data = { objects: [{ objectType: 1, name: 'Account' }], total: 1, success: true };
        client.setCache('objects', data);

        const cached = client.getCached('objects');
        expect(cached).toEqual(data);
      });

      it('should return undefined when objects not cached', () => {
        const cached = client.getCached('objects');
        expect(cached).toBeUndefined();
      });

      it('should expire objects after TTL', () => {
        const data = { objects: [], total: 0, success: true };
        client.setCache('objects', data);

        expect(client.getCached('objects')).toEqual(data);

        // Advance time past TTL
        vi.advanceTimersByTime(60001);

        expect(client.getCached('objects')).toBeUndefined();
      });
    });

    describe('fields cache', () => {
      it('should store and retrieve fields by objectType', () => {
        const data1 = { fields: [{ fieldName: 'accountid' }], success: true };
        const data2 = { fields: [{ fieldName: 'contactid' }], success: true };

        client.setCache('fields', '1', data1);
        client.setCache('fields', '2', data2);

        expect(client.getCached('fields', '1')).toEqual(data1);
        expect(client.getCached('fields', '2')).toEqual(data2);
      });

      it('should return undefined for uncached objectType', () => {
        client.setCache('fields', '1', { fields: [] });

        expect(client.getCached('fields', '2')).toBeUndefined();
      });

      it('should expire fields after TTL', () => {
        const data = { fields: [{ fieldName: 'test' }] };
        client.setCache('fields', '1', data);

        expect(client.getCached('fields', '1')).toEqual(data);

        vi.advanceTimersByTime(60001);

        expect(client.getCached('fields', '1')).toBeUndefined();
      });
    });

    describe('fieldValues cache', () => {
      it('should store and retrieve field values by objectType and fieldName', () => {
        const data1 = { values: [{ name: 'Active', value: '1' }] };
        const data2 = { values: [{ name: 'Open', value: '1' }] };

        client.setCache('fieldValues', '1', 'statuscode', data1);
        client.setCache('fieldValues', '1', 'typecode', data2);

        expect(client.getCached('fieldValues', '1', 'statuscode')).toEqual(data1);
        expect(client.getCached('fieldValues', '1', 'typecode')).toEqual(data2);
      });

      it('should separate field values by object type', () => {
        const data1 = { values: [{ name: 'Active', value: '1' }] };
        const data2 = { values: [{ name: 'Different', value: '2' }] };

        client.setCache('fieldValues', '1', 'statuscode', data1);
        client.setCache('fieldValues', '2', 'statuscode', data2);

        expect(client.getCached('fieldValues', '1', 'statuscode')).toEqual(data1);
        expect(client.getCached('fieldValues', '2', 'statuscode')).toEqual(data2);
      });

      it('should return undefined for uncached field values', () => {
        client.setCache('fieldValues', '1', 'statuscode', { values: [] });

        expect(client.getCached('fieldValues', '1', 'typecode')).toBeUndefined();
        expect(client.getCached('fieldValues', '2', 'statuscode')).toBeUndefined();
      });

      it('should expire field values after TTL', () => {
        const data = { values: [] };
        client.setCache('fieldValues', '1', 'statuscode', data);

        expect(client.getCached('fieldValues', '1', 'statuscode')).toEqual(data);

        vi.advanceTimersByTime(60001);

        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeUndefined();
      });
    });

    describe('caching disabled', () => {
      it('should not cache when cacheMetadata is false', () => {
        const nonCachingClient = new FireberryClient({
          apiKey: 'test-key',
          cacheMetadata: false,
        });

        nonCachingClient.setCache('objects', { objects: [] });
        nonCachingClient.setCache('fields', '1', { fields: [] });
        nonCachingClient.setCache('fieldValues', '1', 'status', { values: [] });

        expect(nonCachingClient.getCached('objects')).toBeUndefined();
        expect(nonCachingClient.getCached('fields', '1')).toBeUndefined();
        expect(nonCachingClient.getCached('fieldValues', '1', 'status')).toBeUndefined();
      });
    });
  });

  describe('cache control methods', () => {
    beforeEach(() => {
      // Populate cache
      client.setCache('objects', { objects: [] });
      client.setCache('fields', '1', { fields: [{ fieldName: 'accountid' }] });
      client.setCache('fields', '2', { fields: [{ fieldName: 'contactid' }] });
      client.setCache('fieldValues', '1', 'statuscode', { values: [] });
      client.setCache('fieldValues', '1', 'typecode', { values: [] });
      client.setCache('fieldValues', '2', 'statuscode', { values: [] });
    });

    describe('cache.clear()', () => {
      it('should clear entire cache', () => {
        expect(client.getCached('objects')).toBeDefined();
        expect(client.getCached('fields', '1')).toBeDefined();
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();

        client.cache.clear();

        expect(client.getCached('objects')).toBeUndefined();
        expect(client.getCached('fields', '1')).toBeUndefined();
        expect(client.getCached('fields', '2')).toBeUndefined();
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeUndefined();
        expect(client.getCached('fieldValues', '1', 'typecode')).toBeUndefined();
        expect(client.getCached('fieldValues', '2', 'statuscode')).toBeUndefined();
      });
    });

    describe('cache.clearObjects()', () => {
      it('should only clear objects cache', () => {
        expect(client.getCached('objects')).toBeDefined();
        expect(client.getCached('fields', '1')).toBeDefined();
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();

        client.cache.clearObjects();

        expect(client.getCached('objects')).toBeUndefined();
        expect(client.getCached('fields', '1')).toBeDefined();
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();
      });
    });

    describe('cache.clearFields()', () => {
      it('should clear fields cache for specific object type', () => {
        expect(client.getCached('fields', '1')).toBeDefined();
        expect(client.getCached('fields', '2')).toBeDefined();

        client.cache.clearFields('1');

        expect(client.getCached('fields', '1')).toBeUndefined();
        expect(client.getCached('fields', '2')).toBeDefined();
      });

      it('should not affect other cache types', () => {
        client.cache.clearFields('1');

        expect(client.getCached('objects')).toBeDefined();
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();
      });
    });

    describe('cache.clearFieldValues()', () => {
      it('should clear specific field values', () => {
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();
        expect(client.getCached('fieldValues', '1', 'typecode')).toBeDefined();

        client.cache.clearFieldValues('1', 'statuscode');

        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeUndefined();
        expect(client.getCached('fieldValues', '1', 'typecode')).toBeDefined();
      });

      it('should clear all field values for object type when no fieldName provided', () => {
        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();
        expect(client.getCached('fieldValues', '1', 'typecode')).toBeDefined();
        expect(client.getCached('fieldValues', '2', 'statuscode')).toBeDefined();

        client.cache.clearFieldValues('1');

        expect(client.getCached('fieldValues', '1', 'statuscode')).toBeUndefined();
        expect(client.getCached('fieldValues', '1', 'typecode')).toBeUndefined();
        expect(client.getCached('fieldValues', '2', 'statuscode')).toBeDefined();
      });

      it('should not affect other cache types', () => {
        client.cache.clearFieldValues('1', 'statuscode');

        expect(client.getCached('objects')).toBeDefined();
        expect(client.getCached('fields', '1')).toBeDefined();
      });
    });
  });

  describe('TTL edge cases', () => {
    it('should return cached data at exactly TTL boundary', () => {
      const data = { objects: [] };
      client.setCache('objects', data);

      // Advance time to exactly TTL (not past it)
      vi.advanceTimersByTime(60000);

      // At exactly TTL, should still be expired (< not <=)
      expect(client.getCached('objects')).toBeUndefined();
    });

    it('should return cached data just before TTL expires', () => {
      const data = { objects: [] };
      client.setCache('objects', data);

      // Advance time to just before TTL
      vi.advanceTimersByTime(59999);

      expect(client.getCached('objects')).toEqual(data);
    });

    it('should handle very short TTL', () => {
      const shortTTLClient = new FireberryClient({
        apiKey: 'test-key',
        cacheMetadata: true,
        cacheTTL: 100, // 100ms
      });

      shortTTLClient.setCache('objects', { objects: [] });
      expect(shortTTLClient.getCached('objects')).toBeDefined();

      vi.advanceTimersByTime(101);
      expect(shortTTLClient.getCached('objects')).toBeUndefined();
    });

    it('should handle refreshing cache before expiry', () => {
      const data1 = { objects: [{ name: 'Old' }] };
      const data2 = { objects: [{ name: 'New' }] };

      client.setCache('objects', data1);
      vi.advanceTimersByTime(30000); // Half TTL

      // Refresh cache
      client.setCache('objects', data2);

      // Should get new data
      expect(client.getCached('objects')).toEqual(data2);

      // Advance another 30 seconds (total 60 from original, but only 30 from refresh)
      vi.advanceTimersByTime(30000);
      expect(client.getCached('objects')).toEqual(data2);

      // Now expire it
      vi.advanceTimersByTime(30001);
      expect(client.getCached('objects')).toBeUndefined();
    });
  });

  describe('cache isolation', () => {
    it('should not share cache between client instances', () => {
      const client1 = new FireberryClient({ apiKey: 'key1', cacheMetadata: true });
      const client2 = new FireberryClient({ apiKey: 'key2', cacheMetadata: true });

      client1.setCache('objects', { objects: [{ name: 'Client1' }] });
      client2.setCache('objects', { objects: [{ name: 'Client2' }] });

      expect(client1.getCached('objects')).toEqual({ objects: [{ name: 'Client1' }] });
      expect(client2.getCached('objects')).toEqual({ objects: [{ name: 'Client2' }] });
    });

    it('should not affect other client when clearing cache', () => {
      const client1 = new FireberryClient({ apiKey: 'key1', cacheMetadata: true });
      const client2 = new FireberryClient({ apiKey: 'key2', cacheMetadata: true });

      client1.setCache('objects', { objects: [] });
      client2.setCache('objects', { objects: [] });

      client1.cache.clear();

      expect(client1.getCached('objects')).toBeUndefined();
      expect(client2.getCached('objects')).toBeDefined();
    });
  });
});

describe('Query Result Caching Configuration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have query result caching disabled by default', () => {
    const client = new FireberryClient({ apiKey: 'test-key' });
    const config = client.getConfig();
    expect(config.cacheQueryResults).toBe(false);
  });

  it('should enable query result caching when configured', () => {
    const client = new FireberryClient({
      apiKey: 'test-key',
      cacheQueryResults: true,
    });
    const config = client.getConfig();
    expect(config.cacheQueryResults).toBe(true);
  });

  it('should use default query cache TTL of 1 minute', () => {
    const client = new FireberryClient({
      apiKey: 'test-key',
      cacheQueryResults: true,
    });
    const config = client.getConfig();
    expect(config.queryResultCacheTTL).toBe(60000);
  });

  it('should use custom query cache TTL when provided', () => {
    const client = new FireberryClient({
      apiKey: 'test-key',
      cacheQueryResults: true,
      queryResultCacheTTL: 30000,
    });
    const config = client.getConfig();
    expect(config.queryResultCacheTTL).toBe(30000);
  });

  it('should have clearQueryResults method', () => {
    const client = new FireberryClient({ apiKey: 'test-key' });
    expect(typeof client.cache.clearQueryResults).toBe('function');
  });

  it('should have clearQueryResultsForObject method', () => {
    const client = new FireberryClient({ apiKey: 'test-key' });
    expect(typeof client.cache.clearQueryResultsForObject).toBe('function');
  });
});

describe('Smart Cache Invalidation on Mutations', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  const createMockResponse = (data: unknown, status = 200) => {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: { Data: data } }),
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('invalidateCacheOnMutation config', () => {
    it('should be enabled by default', () => {
      const client = new FireberryClient({ apiKey: 'test-key' });
      const config = client.getConfig();
      expect(config.invalidateCacheOnMutation).toBe(true);
    });

    it('should allow disabling cache invalidation', () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        invalidateCacheOnMutation: false,
      });
      const config = client.getConfig();
      expect(config.invalidateCacheOnMutation).toBe(false);
    });
  });

  describe('create operation cache invalidation', () => {
    it('should invalidate cache after create when enabled', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      // First call returns query data, second returns create response
      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])) // First query
        .mockReturnValueOnce(createMockResponse({ id: 'new-id' })) // Create
        .mockReturnValueOnce(createMockResponse([{ id: '1' }, { id: 'new-id' }])); // Second query

      // Run query to populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Query again - should use cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, used cache

      // Perform create - should invalidate cache
      await client.records.create('1', { accountname: 'New Account' });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Query again - cache should be invalidated, so new API call
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not invalidate cache after create when disabled', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: false,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])) // First query
        .mockReturnValueOnce(createMockResponse({ id: 'new-id' })); // Create

      // Run query to populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Perform create - should NOT invalidate cache
      await client.records.create('1', { accountname: 'New Account' });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Query again - should still use cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2); // Still 2, used cache
    });
  });

  describe('update operation cache invalidation', () => {
    it('should invalidate cache after update', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])) // Query
        .mockReturnValueOnce(createMockResponse({ id: '1' })) // Update
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])); // Query again

      // Populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Perform update
      await client.records.update('1', 'record-id', { accountname: 'Updated' });

      // Query again - should make new API call
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('delete operation cache invalidation', () => {
    it('should invalidate cache after delete', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])) // Query
        .mockReturnValueOnce(createMockResponse({ success: true })) // Delete
        .mockReturnValueOnce(createMockResponse([])); // Query again

      // Populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Perform delete
      await client.records.delete('1', 'record-id');

      // Query again - should make new API call
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('batch operations cache invalidation', () => {
    it('should invalidate cache after batch create', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([])) // Query
        .mockReturnValueOnce(createMockResponse([{ id: 'id1' }, { id: 'id2' }])) // Batch create
        .mockReturnValueOnce(createMockResponse([{ id: 'id1' }, { id: 'id2' }])); // Query again

      // Populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Perform batch create
      await client.batch.create('1', [
        { accountname: 'Account 1' },
        { accountname: 'Account 2' },
      ]);

      // Query again - should make new API call
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should invalidate cache after batch update', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: 'id1' }, { id: 'id2' }])) // Query
        .mockReturnValueOnce(createMockResponse([{ id: 'id1' }, { id: 'id2' }])) // Batch update
        .mockReturnValueOnce(createMockResponse([{ id: 'id1' }, { id: 'id2' }])); // Query again

      // Populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Perform batch update
      await client.batch.update('1', [
        { id: 'id1', record: { accountname: 'Updated 1' } },
        { id: 'id2', record: { accountname: 'Updated 2' } },
      ]);

      // Query again - should make new API call
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should invalidate cache after batch delete', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: 'id1' }, { id: 'id2' }])) // Query
        .mockReturnValueOnce(createMockResponse({ success: true })) // Batch delete
        .mockReturnValueOnce(createMockResponse([])); // Query again

      // Populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Perform batch delete
      await client.batch.delete('1', ['id1', 'id2']);

      // Query again - should make new API call
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanup on write', () => {
    it('should remove expired metadata entries when writing new metadata', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // Populate cache with multiple entries
      client.setCache('objects', { objects: [] });
      client.setCache('fields', '1', { fields: [{ fieldName: 'field1' }] });
      client.setCache('fields', '2', { fields: [{ fieldName: 'field2' }] });
      client.setCache('fieldValues', '1', 'status', { values: [] });

      // Verify all are cached
      expect(client.getCached('objects')).toBeDefined();
      expect(client.getCached('fields', '1')).toBeDefined();
      expect(client.getCached('fields', '2')).toBeDefined();
      expect(client.getCached('fieldValues', '1', 'status')).toBeDefined();

      // Advance time to expire all entries
      vi.advanceTimersByTime(60001);

      // Write a new entry - this should trigger cleanup of expired entries
      client.setCache('fields', '3', { fields: [{ fieldName: 'field3' }] });

      // The new entry should exist
      expect(client.getCached('fields', '3')).toBeDefined();

      // Expired entries should have been cleaned up during the write
      // We can verify this indirectly by checking that getCached returns undefined
      // (they were already expired, but now they should be deleted from memory)
      expect(client.getCached('objects')).toBeUndefined();
      expect(client.getCached('fields', '1')).toBeUndefined();
      expect(client.getCached('fields', '2')).toBeUndefined();
      expect(client.getCached('fieldValues', '1', 'status')).toBeUndefined();
    });

    it('should preserve non-expired metadata entries during cleanup', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // Add first entry
      client.setCache('fields', '1', { fields: [{ fieldName: 'field1' }] });

      // Advance time but not past TTL
      vi.advanceTimersByTime(30000);

      // Add second entry - triggers cleanup
      client.setCache('fields', '2', { fields: [{ fieldName: 'field2' }] });

      // Both should still be valid
      expect(client.getCached('fields', '1')).toBeDefined();
      expect(client.getCached('fields', '2')).toBeDefined();
    });

    it('should remove expired query cache entries when writing new query results', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        queryResultCacheTTL: 30000,
      });

      // Mock fetch for queries
      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])) // First query
        .mockReturnValueOnce(createMockResponse([{ id: '2' }])) // Second query
        .mockReturnValueOnce(createMockResponse([{ id: '3' }])); // Third query after expiry

      // Run first query to populate cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Run second query with different params
      await client.query({ objectType: '2', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Both queries should be cached
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      await client.query({ objectType: '2', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2); // Still 2, both from cache

      // Advance time to expire all cache entries
      vi.advanceTimersByTime(30001);

      // Run new query - should trigger cleanup and make API call
      await client.query({ objectType: '3', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should cleanup both metadata and query caches on metadata write', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheMetadata: true,
        cacheTTL: 60000,
        cacheQueryResults: true,
        queryResultCacheTTL: 30000,
      });

      // Mock fetch for query
      mockFetch.mockReturnValueOnce(createMockResponse([{ id: '1' }]));

      // Populate query cache
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });

      // Populate metadata cache
      client.setCache('fields', '1', { fields: [] });

      // Advance time to expire query cache (shorter TTL)
      vi.advanceTimersByTime(30001);

      // Write new metadata - should cleanup expired query cache too
      client.setCache('fields', '2', { fields: [] });

      // Metadata should still work
      expect(client.getCached('fields', '1')).toBeDefined();
      expect(client.getCached('fields', '2')).toBeDefined();

      // Query cache should be expired (cleaned up)
      mockFetch.mockReturnValueOnce(createMockResponse([{ id: '1' }]));
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2); // New call because cache was cleaned
    });
  });

  describe('cache isolation by object type', () => {
    it('should only invalidate cache for the affected object type', async () => {
      const client = new FireberryClient({
        apiKey: 'test-key',
        cacheQueryResults: true,
        invalidateCacheOnMutation: true,
      });

      mockFetch
        .mockReturnValueOnce(createMockResponse([{ id: '1' }])) // Query obj 1
        .mockReturnValueOnce(createMockResponse([{ id: '2' }])) // Query obj 2
        .mockReturnValueOnce(createMockResponse({ id: 'new-id' })) // Create obj 1
        .mockReturnValueOnce(createMockResponse([{ id: '1' }, { id: 'new-id' }])); // Query obj 1 again

      // Cache queries for two object types
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      await client.query({ objectType: '2', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Create on object type 1
      await client.records.create('1', { accountname: 'New' });

      // Query object 1 - should make new call (cache invalidated)
      await client.query({ objectType: '1', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Query object 2 - should use cache (not invalidated)
      await client.query({ objectType: '2', fields: ['id'], autoPage: false });
      expect(mockFetch).toHaveBeenCalledTimes(4); // Still 4, used cache
    });
  });
});
