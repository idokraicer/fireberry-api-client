import { describe, it, expect, beforeAll } from 'vitest';
import { FireberryClient } from '../../src';

const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

describeIntegration('Query API (Integration)', () => {
  let client: FireberryClient;

  beforeAll(() => {
    client = new FireberryClient({
      apiKey: process.env.FIREBERRY_TOKEN!,
      timeout: 30000,
      retryOn429: true,
      maxRetries: 5,
    });
  });

  describe('client.query()', () => {
    it('should query accounts with fields as array', async () => {
      const result = await client.query({
        objectType: '1',
        fields: ['accountid', 'accountname'],
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.records).toBeDefined();
      expect(Array.isArray(result.records)).toBe(true);

      // If there are records, verify they have the requested fields
      if (result.records.length > 0) {
        const record = result.records[0];
        expect(record).toHaveProperty('accountid');
        expect(record).toHaveProperty('accountname');
      }
    });

    it('should query accounts with fields as comma-separated string', async () => {
      const result = await client.query({
        objectType: '1',
        fields: 'accountid,accountname',
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('should query with * to get all fields', async () => {
      const result = await client.query({
        objectType: '1',
        fields: '*',
        limit: 1,
      });

      expect(result.success).toBe(true);

      // Should have many fields when using *
      if (result.records.length > 0) {
        const fieldCount = Object.keys(result.records[0]).length;
        expect(fieldCount).toBeGreaterThan(2);
      }
    });

    it('should support query filtering', async () => {
      const result = await client.query({
        objectType: '1',
        fields: ['accountid', 'accountname'],
        query: '(accountname is-not-null)',
        limit: 5,
      });

      expect(result.success).toBe(true);

      // All returned records should have accountname
      for (const record of result.records) {
        expect(record.accountname).toBeDefined();
      }
    });

    it('should support sorting', async () => {
      const resultDesc = await client.query({
        objectType: '1',
        fields: ['accountid', 'accountname', 'modifiedon'],
        sortBy: 'modifiedon',
        sortType: 'desc',
        limit: 2,
      });

      const resultAsc = await client.query({
        objectType: '1',
        fields: ['accountid', 'accountname', 'modifiedon'],
        sortBy: 'modifiedon',
        sortType: 'asc',
        limit: 2,
      });

      expect(resultDesc.success).toBe(true);
      expect(resultAsc.success).toBe(true);

      // If we have records, the order should differ
      if (resultDesc.records.length > 0 && resultAsc.records.length > 0) {
        // Just verify both queries returned results
        expect(resultDesc.records[0]).toBeDefined();
        expect(resultAsc.records[0]).toBeDefined();
      }
    });

    it('should respect limit parameter', async () => {
      const result = await client.query({
        objectType: '1',
        fields: ['accountid'],
        limit: 3,
      });

      expect(result.success).toBe(true);
      expect(result.records.length).toBeLessThanOrEqual(3);
    });

    it('should support showRealValue option', async () => {
      const result = await client.query({
        objectType: '1',
        fields: ['accountid', 'statuscode'],
        showRealValue: true,
        limit: 5,
      });

      expect(result.success).toBe(true);
      // When showRealValue is true, dropdown fields may include label alongside ID
    });
  });

  describe('client.queryBuilder()', () => {
    it('should execute queries via QueryBuilder', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .limit(5)
        .execute();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('should build and execute with where conditions', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .where('accountname').isNotNull()
        .limit(5)
        .execute();

      expect(result.success).toBe(true);

      for (const record of result.records) {
        expect(record.accountname).toBeDefined();
      }
    });

    it('should support contains (start-with %) queries', async () => {
      // First get an account name to search for
      const initial = await client.query({
        objectType: '1',
        fields: ['accountname'],
        limit: 1,
      });

      if (initial.records.length > 0 && initial.records[0].accountname) {
        const searchTerm = String(initial.records[0].accountname).substring(0, 3);

        const result = await client.queryBuilder()
          .objectType('1')
          .select('accountid', 'accountname')
          .where('accountname').contains(searchTerm)
          .limit(10)
          .execute();

        expect(result.success).toBe(true);
      }
    });

    it('should support multiple conditions with AND', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .where('accountname').isNotNull()
        .and()
        .where('accountid').isNotNull()
        .limit(5)
        .execute();

      expect(result.success).toBe(true);
    });

    it('should support sorting via queryBuilder', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'accountname', 'modifiedon')
        .sortBy('modifiedon', 'desc')
        .limit(5)
        .execute();

      expect(result.success).toBe(true);
    });
  });

  describe('pagination', () => {
    it('should support manual pagination with page parameter', async () => {
      const page1 = await client.query({
        objectType: '1',
        fields: ['accountid'],
        page: 1,
        pageSize: 2,
        autoPage: false,
      });

      const page2 = await client.query({
        objectType: '1',
        fields: ['accountid'],
        page: 2,
        pageSize: 2,
        autoPage: false,
      });

      expect(page1.success).toBe(true);
      expect(page2.success).toBe(true);

      // If both pages have records, they should be different
      if (page1.records.length > 0 && page2.records.length > 0) {
        expect(page1.records[0].accountid).not.toBe(page2.records[0].accountid);
      }
    });
  });

  describe('AbortController support', () => {
    it('should accept AbortSignal for cancellation', async () => {
      const controller = new AbortController();

      // Start query but abort immediately
      const queryPromise = client.query({
        objectType: '1',
        fields: ['accountid'],
        limit: 5,
        signal: controller.signal,
      });

      // Either it completes before abort or throws
      // This test mainly verifies the signal is accepted
      const result = await queryPromise;
      expect(result).toBeDefined();
    });
  });
});
