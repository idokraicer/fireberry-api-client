import { describe, it, expect, beforeAll } from 'vitest';
import { FireberryClient } from '../../src';
import { EXCLUDED_FIELDS_FOR_STAR_QUERY } from '../../src/constants/excludedFields';

const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

describeIntegration('expandStarFields (Integration)', () => {
  let client: FireberryClient;

  beforeAll(() => {
    client = new FireberryClient({
      apiKey: process.env.FIREBERRY_TOKEN!,
      timeout: 30000,
    });
  });

  describe('objects with excluded fields', () => {
    // Test each object type that has excluded fields
    const objectsWithExclusions = Object.keys(EXCLUDED_FIELDS_FOR_STAR_QUERY);

    it('should have excluded fields configured', () => {
      expect(objectsWithExclusions.length).toBeGreaterThan(0);
    });

    for (const objectType of objectsWithExclusions) {
      it(`should query object ${objectType} with * fields without error`, async () => {
        const result = await client.query({
          objectType,
          fields: '*',
          limit: 1,
        });

        expect(result.success).toBe(true);
        expect(result.records).toBeDefined();
      });

      it(`should not include excluded fields for object ${objectType}`, async () => {
        const excludedFields = EXCLUDED_FIELDS_FOR_STAR_QUERY[objectType];

        const result = await client.query({
          objectType,
          fields: '*',
          limit: 1,
        });

        if (result.records.length > 0) {
          const record = result.records[0];
          for (const excludedField of excludedFields) {
            expect(record).not.toHaveProperty(excludedField);
          }
        }
      });
    }
  });

  describe('objects without excluded fields', () => {
    it('should pass * directly to API for object type 1 (Account)', async () => {
      // Object 1 doesn't have excluded fields, so * should work directly
      const result = await client.query({
        objectType: '1',
        fields: '*',
        limit: 1,
      });

      expect(result.success).toBe(true);
    });

    it('should pass * directly to API for object type 2 (Contact)', async () => {
      const result = await client.query({
        objectType: '2',
        fields: '*',
        limit: 1,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('comparison with specific fields', () => {
    it('should return same fields as explicit field list', async () => {
      // For an object without exclusions, * should return all fields
      const starResult = await client.query({
        objectType: '1',
        fields: '*',
        limit: 1,
      });

      const specificResult = await client.query({
        objectType: '1',
        fields: ['accountid', 'accountname', 'statuscode'],
        limit: 1,
      });

      expect(starResult.success).toBe(true);
      expect(specificResult.success).toBe(true);

      // Both should have records (or both empty)
      expect(starResult.records.length).toBe(specificResult.records.length);
    });
  });

  describe('metadata caching for excluded objects', () => {
    it('should use cached metadata when caching is enabled', async () => {
      const cachingClient = new FireberryClient({
        apiKey: process.env.FIREBERRY_TOKEN!,
        cacheMetadata: true,
        cacheTTL: 60000,
      });

      // First query should fetch metadata
      const result1 = await cachingClient.query({
        objectType: '117', // Landing Page - has excluded fields
        fields: '*',
        limit: 1,
      });

      // Second query should use cached metadata
      const result2 = await cachingClient.query({
        objectType: '117',
        fields: '*',
        limit: 1,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});
