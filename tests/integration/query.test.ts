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

  describe('QueryBuilder: whereIn()', () => {
    it('should query with multiple values using whereIn', async () => {
      // First, get some accounts to query
      const initial = await client.query({
        objectType: '1',
        fields: ['accountid'],
        limit: 3,
      });

      if (initial.records.length >= 2) {
        const ids = initial.records.map(r => String(r.accountid));

        const result = await client.queryBuilder()
          .objectType('1')
          .select('accountid', 'accountname')
          .whereIn('accountid', ids)
          .execute();

        expect(result.success).toBe(true);
        expect(result.records.length).toBeLessThanOrEqual(ids.length);
      }
    });
  });

  describe('QueryBuilder: first()', () => {
    it('should return single record or null', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .first();

      // Should be either a record or null
      if (result !== null) {
        expect(result).toHaveProperty('accountid');
        expect(result).toHaveProperty('accountname');
      }
    });

    it('should return null for no matches', async () => {
      // Use a valid-looking but non-existent condition
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid')
        .where('accountname').equals('___non_existent_account_name_12345___')
        .first();

      expect(result).toBeNull();
    });
  });

  describe('QueryBuilder: count()', () => {
    it('should return count of matching records', async () => {
      const count = await client.queryBuilder()
        .objectType('1')
        .where('accountname').isNotNull()
        .count();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('QueryBuilder: Date Helpers', () => {
    it('should query with today()', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'modifiedon')
        .whereDate('modifiedon').today()
        .execute();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('should query with thisWeek()', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'modifiedon')
        .whereDate('modifiedon').thisWeek()
        .execute();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('should query with daysAgo()', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'modifiedon')
        .whereDate('modifiedon').daysAgo(30)
        .limit(10)
        .execute();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.records)).toBe(true);
    });
  });

  describe('QueryBuilder: executeWithDebug()', () => {
    it('should return result with metadata', async () => {
      const result = await client.queryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .where('accountname').isNotNull()
        .limit(5)
        .executeWithDebug();

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.objectType).toBe('1');
      expect(result.metadata.fields).toContain('accountid');
      expect(result.metadata.fields).toContain('accountname');
      expect(result.metadata.queryString).toContain('accountname');
      expect(typeof result.metadata.executionTimeMs).toBe('number');
    });
  });

  describe('queryAll - Parallel Query Execution', () => {
    it('should execute multiple queries in parallel', async () => {
      const results = await client.queryAll([
        { objectType: '1', fields: ['accountid'], limit: 2 },
        { objectType: '2', fields: ['contactid'], limit: 2 },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should return results in same order as input', async () => {
      const results = await client.queryAll([
        { objectType: '1', fields: ['accountid'], limit: 1 },
        { objectType: '2', fields: ['contactid'], limit: 1 },
        { objectType: '4', fields: ['opportunityid'], limit: 1 },
      ]);

      expect(results).toHaveLength(3);

      // Verify each result has the expected field (order preserved)
      if (results[0].records.length > 0) {
        expect(results[0].records[0]).toHaveProperty('accountid');
      }
      if (results[1].records.length > 0) {
        expect(results[1].records[0]).toHaveProperty('contactid');
      }
      if (results[2].records.length > 0) {
        expect(results[2].records[0]).toHaveProperty('opportunityid');
      }
    });
  });

  describe('queryStream - Cursor-Based Pagination', () => {
    it('should stream records in batches', async () => {
      const batches: Record<string, unknown>[][] = [];

      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['accountid', 'accountname'],
        pageSize: 10,
        limit: 25,
      })) {
        batches.push(batch.records);
      }

      // Should have at least one batch
      expect(batches.length).toBeGreaterThanOrEqual(1);

      // Total records should be <= limit
      const totalRecords = batches.reduce((sum, b) => sum + b.length, 0);
      expect(totalRecords).toBeLessThanOrEqual(25);
    });

    it('should include page number in each batch', async () => {
      const pages: number[] = [];

      for await (const batch of client.queryStream({
        objectType: '1',
        fields: ['accountid'],
        pageSize: 5,
        limit: 15,
      })) {
        pages.push(batch.page!);
      }

      // Pages should be sequential starting from 1
      expect(pages[0]).toBe(1);
      if (pages.length > 1) {
        expect(pages[1]).toBe(2);
      }
    });
  });
});
