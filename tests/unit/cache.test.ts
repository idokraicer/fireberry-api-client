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
