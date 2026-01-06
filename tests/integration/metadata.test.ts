import { describe, it, expect, beforeAll } from 'vitest';
import { FireberryClient } from '../../src';

// Skip integration tests if no token is available
const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

describeIntegration('MetadataAPI (Integration)', () => {
  let client: FireberryClient;

  beforeAll(() => {
    client = new FireberryClient({
      apiKey: process.env.FIREBERRY_TOKEN!,
      timeout: 30000,
      retryOn429: true,
      maxRetries: 5,
    });
  });

  describe('getObjects()', () => {
    it('should fetch all objects from Fireberry', async () => {
      const result = await client.metadata.getObjects();

      expect(result.success).toBe(true);
      expect(result.objects).toBeDefined();
      expect(Array.isArray(result.objects)).toBe(true);
      expect(result.total).toBeGreaterThan(0);

      // Should have standard objects like Account (1), Contact (2)
      // objectType can be string or number depending on API response
      const objectTypes = result.objects.map((o) => String(o.objectType));
      expect(objectTypes).toContain('1'); // Account
    });
  });

  describe('getFields()', () => {
    it('should fetch fields for Account object (type 1)', async () => {
      const result = await client.metadata.getFields('1');

      expect(result.success).toBe(true);
      expect(result.objectTypeId).toBe('1');
      expect(result.fields).toBeDefined();
      expect(Array.isArray(result.fields)).toBe(true);
      expect(result.total).toBeGreaterThan(0);

      // Account should have standard fields
      const fieldNames = result.fields.map((f) => f.fieldName);
      expect(fieldNames).toContain('accountid');
      expect(fieldNames).toContain('accountname');
    });

    it('should fetch fields for Contact object (type 2)', async () => {
      const result = await client.metadata.getFields('2');

      expect(result.success).toBe(true);
      expect(result.objectTypeId).toBe('2');

      const fieldNames = result.fields.map((f) => f.fieldName);
      expect(fieldNames).toContain('contactid');
      expect(fieldNames).toContain('fullname');
    });

    it('should include fieldType mapping', async () => {
      const result = await client.metadata.getFields('1');

      // Each field should have a fieldType
      for (const field of result.fields) {
        expect(field.fieldType).toBeDefined();
      }
    });
  });

  describe('getFieldValues()', () => {
    it('should fetch dropdown values for a picklist field', async () => {
      // statuscode is a common dropdown field
      const result = await client.metadata.getFieldValues('1', 'statuscode');

      expect(result.success).toBe(true);
      expect(result.objectTypeId).toBe('1');
      expect(result.fieldName).toBe('statuscode');
      expect(result.values).toBeDefined();
      expect(Array.isArray(result.values)).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache metadata when cacheMetadata is enabled', async () => {
      const cachingClient = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // First call - hits API
      const result1 = await cachingClient.metadata.getObjects();

      // Second call - should use cache (same result)
      const result2 = await cachingClient.metadata.getObjects();

      expect(result1.total).toBe(result2.total);
      expect(result1.objects.length).toBe(result2.objects.length);
    });

    it('should clear cache when cache.clear() is called', async () => {
      const cachingClient = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
      });

      await cachingClient.metadata.getObjects();
      cachingClient.cache.clear();

      // Cache should be cleared, next call hits API again
      const result = await cachingClient.metadata.getObjects();
      expect(result.success).toBe(true);
    });
  });
});
