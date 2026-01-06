import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { FireberryClient } from '../../src';

const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

describeIntegration('Cache (Integration)', () => {
  describe('metadata caching', () => {
    it('should cache getObjects response', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // First call - should hit API
      const result1 = await client.metadata.getObjects();
      expect(result1.success).toBe(true);
      expect(result1.objects.length).toBeGreaterThan(0);

      // Second call - should use cache (we can verify by timing or checking getCached)
      const cachedBefore = client.getCached('objects');
      expect(cachedBefore).toBeDefined();

      const result2 = await client.metadata.getObjects();
      expect(result2).toEqual(result1);

      // Clear cache and verify it's gone
      client.cache.clearObjects();
      expect(client.getCached('objects')).toBeUndefined();
    });

    it('should cache getFields response per object type', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // Get fields for Account (1)
      const result1 = await client.metadata.getFields('1');
      expect(result1.success).toBe(true);
      expect(result1.fields.length).toBeGreaterThan(0);

      // Verify it's cached
      expect(client.getCached('fields', '1')).toBeDefined();

      // Get fields for Contact (2) - should be separate cache entry
      const result2 = await client.metadata.getFields('2');
      expect(result2.success).toBe(true);

      // Both should be cached separately
      expect(client.getCached('fields', '1')).toBeDefined();
      expect(client.getCached('fields', '2')).toBeDefined();

      // Clear only Account fields
      client.cache.clearFields('1');
      expect(client.getCached('fields', '1')).toBeUndefined();
      expect(client.getCached('fields', '2')).toBeDefined();
    });

    it('should cache getFieldValues response', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // Get field values for Account statuscode
      const result1 = await client.metadata.getFieldValues('1', 'statuscode');
      expect(result1.success).toBe(true);

      // Verify it's cached
      const cached = client.getCached('fieldValues', '1', 'statuscode');
      expect(cached).toBeDefined();

      // Second call should return same data from cache
      const result2 = await client.metadata.getFieldValues('1', 'statuscode');
      expect(result2).toEqual(result1);

      // Clear and verify
      client.cache.clearFieldValues('1', 'statuscode');
      expect(client.getCached('fieldValues', '1', 'statuscode')).toBeUndefined();
    });
  });

  describe('cache disabled', () => {
    it('should not cache when cacheMetadata is false', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: false,
      });

      await client.metadata.getObjects();
      expect(client.getCached('objects')).toBeUndefined();

      await client.metadata.getFields('1');
      expect(client.getCached('fields', '1')).toBeUndefined();
    });
  });

  describe('cache.clear()', () => {
    it('should clear all cached metadata', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // Populate cache
      await client.metadata.getObjects();
      await client.metadata.getFields('1');
      await client.metadata.getFields('2');
      await client.metadata.getFieldValues('1', 'statuscode');

      // Verify all cached
      expect(client.getCached('objects')).toBeDefined();
      expect(client.getCached('fields', '1')).toBeDefined();
      expect(client.getCached('fields', '2')).toBeDefined();
      expect(client.getCached('fieldValues', '1', 'statuscode')).toBeDefined();

      // Clear all
      client.cache.clear();

      // Verify all cleared
      expect(client.getCached('objects')).toBeUndefined();
      expect(client.getCached('fields', '1')).toBeUndefined();
      expect(client.getCached('fields', '2')).toBeUndefined();
      expect(client.getCached('fieldValues', '1', 'statuscode')).toBeUndefined();
    });
  });

  describe('cache performance', () => {
    it('should be significantly faster on cached calls', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // First call - measures API latency
      const start1 = performance.now();
      await client.metadata.getObjects();
      const duration1 = performance.now() - start1;

      // Second call - should be from cache (nearly instant)
      const start2 = performance.now();
      await client.metadata.getObjects();
      const duration2 = performance.now() - start2;

      // Cached call should be at least 10x faster (usually 100x+)
      // API call typically takes 100-500ms, cache hit < 1ms
      expect(duration2).toBeLessThan(duration1 / 10);
    });

    it('should measure API call savings with multiple cached calls', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // First call - hits API
      await client.metadata.getFields('1');

      // Make 10 more calls - all should be cached
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        await client.metadata.getFields('1');
      }
      const totalDuration = performance.now() - start;

      // 10 cached calls should complete in under 10ms total
      expect(totalDuration).toBeLessThan(10);
    });
  });

  describe('cache with star field expansion', () => {
    it('should cache metadata used for star field expansion', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // Object 117 (Landing Page) has excluded fields, so * query fetches metadata
      const result1 = await client.query({
        objectType: '117',
        fields: '*',
        limit: 1,
      });

      expect(result1.success).toBe(true);

      // Metadata should be cached now
      expect(client.getCached('fields', '117')).toBeDefined();

      // Second query should use cached metadata (faster)
      const start = performance.now();
      await client.query({
        objectType: '117',
        fields: '*',
        limit: 1,
      });
      const duration = performance.now() - start;

      // Should still be reasonably fast since metadata is cached
      // (only the query API call happens, not metadata fetch)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('cache integrity', () => {
    it('should return same data structure on cache hit', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      const result1 = await client.metadata.getFields('1');
      const result2 = await client.metadata.getFields('1');

      // Deep equality check
      expect(result2).toEqual(result1);
      expect(result2.objectTypeId).toBe(result1.objectTypeId);
      expect(result2.fields.length).toBe(result1.fields.length);
      expect(result2.total).toBe(result1.total);
      expect(result2.success).toBe(result1.success);
    });

    it('should preserve field metadata properties in cache', async () => {
      const client = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      const result1 = await client.metadata.getFields('1');
      const result2 = await client.metadata.getFields('1');

      // Check a specific field's properties are preserved
      const field1 = result1.fields.find((f) => f.fieldName === 'accountname');
      const field2 = result2.fields.find((f) => f.fieldName === 'accountname');

      expect(field2).toBeDefined();
      expect(field2?.fieldName).toBe(field1?.fieldName);
      expect(field2?.label).toBe(field1?.label);
      expect(field2?.systemFieldTypeId).toBe(field1?.systemFieldTypeId);
    });
  });
});
