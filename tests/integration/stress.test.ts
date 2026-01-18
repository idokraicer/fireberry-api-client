import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FireberryClient } from '../../src';

const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

// Helper to extract IDs from batch response
function extractIds(data: unknown[]): string[] {
  const ids: string[] = [];
  for (const item of data) {
    const r = item as Record<string, unknown>;
    if (r.id) {
      ids.push(String(r.id));
    }
  }
  return ids;
}

describeIntegration('Stress Tests (Integration)', () => {
  let client: FireberryClient;
  const createdIds: string[] = [];
  const OBJECT_TYPE = '1'; // Account

  beforeAll(() => {
    client = new FireberryClient({
      apiKey: process.env.FIREBERRY_TOKEN!,
      timeout: 60000, // Longer timeout for stress tests
      retryOn429: true,
      maxRetries: 120,
      retryDelay: 1000,
    });
  });

  afterAll(async () => {
    // Cleanup: batch delete all created records
    if (createdIds.length > 0) {
      console.log(`\nCleaning up ${createdIds.length} records...`);
      const startCleanup = performance.now();

      try {
        // Delete in batches to avoid overwhelming the API
        const batchSize = 100;
        for (let i = 0; i < createdIds.length; i += batchSize) {
          const batch = createdIds.slice(i, i + batchSize);
          await client.batch.delete(OBJECT_TYPE, batch);
        }
      } catch (error) {
        console.error('Cleanup error:', error);
        // Fallback: try individual deletes
        for (const id of createdIds) {
          try {
            await client.records.delete(OBJECT_TYPE, id);
          } catch {
            // Ignore individual delete errors
          }
        }
      }

      const cleanupDuration = performance.now() - startCleanup;
      console.log(`Cleanup completed in ${(cleanupDuration / 1000).toFixed(2)}s`);
    }
  }, 300000); // 5 minute timeout for cleanup

  describe('Query Stress Test (100 records)', () => {
    const RECORD_COUNT = 100;
    const testPrefix = `StressQuery_${Date.now()}`;

    it('should create 100 records for query test', async () => {
      console.log(`\nCreating ${RECORD_COUNT} records for query stress test...`);
      const startCreate = performance.now();

      // Create in batches of 20 (API limit)
      const batchSize = 20;
      for (let i = 0; i < RECORD_COUNT; i += batchSize) {
        const records = Array.from({ length: Math.min(batchSize, RECORD_COUNT - i) }, (_, j) => ({
          accountname: `${testPrefix}_${i + j}`,
        }));

        const result = await client.batch.create(OBJECT_TYPE, records);
        expect(result.success).toBe(true);

        const ids = extractIds(result.data);
        createdIds.push(...ids);
      }

      const createDuration = performance.now() - startCreate;
      console.log(`Created ${RECORD_COUNT} records in ${(createDuration / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${(RECORD_COUNT / (createDuration / 1000)).toFixed(2)} records/sec`);

      expect(createdIds.length).toBe(RECORD_COUNT);
    }, 60000); // 1 minute timeout

    it('should query all records with autoPage', async () => {
      console.log(`\nQuerying ${RECORD_COUNT} records with autoPage...`);
      const startQuery = performance.now();

      const result = await client.query({
        objectType: OBJECT_TYPE,
        fields: ['accountid', 'accountname', 'createdon'],
        query: `(accountname start-with ${testPrefix})`,
        autoPage: true,
      });

      const queryDuration = performance.now() - startQuery;
      console.log(`Queried ${result.records.length} records in ${(queryDuration / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${(result.records.length / (queryDuration / 1000)).toFixed(2)} records/sec`);

      expect(result.success).toBe(true);
      expect(result.records.length).toBe(RECORD_COUNT);
    }, 30000);

    it('should query with pagination', async () => {
      console.log(`\nQuerying with pagination (50 per page)...`);

      // Page 1
      const startPage1 = performance.now();
      const page1 = await client.query({
        objectType: OBJECT_TYPE,
        fields: ['accountid', 'accountname'],
        query: `(accountname start-with ${testPrefix})`,
        page: 1,
        pageSize: 50,
        autoPage: false,
      });
      const page1Duration = performance.now() - startPage1;

      expect(page1.success).toBe(true);
      expect(page1.records.length).toBe(50);
      console.log(`  Page 1: ${page1.records.length} records in ${page1Duration.toFixed(0)}ms`);

      // Page 2
      const startPage2 = performance.now();
      const page2 = await client.query({
        objectType: OBJECT_TYPE,
        fields: ['accountid', 'accountname'],
        query: `(accountname start-with ${testPrefix})`,
        page: 2,
        pageSize: 50,
        autoPage: false,
      });
      const page2Duration = performance.now() - startPage2;

      expect(page2.success).toBe(true);
      expect(page2.records.length).toBe(50);
      console.log(`  Page 2: ${page2.records.length} records in ${page2Duration.toFixed(0)}ms`);
    }, 30000);

    it('should query with limit', async () => {
      console.log(`\nQuerying with limit of 25...`);
      const start = performance.now();

      const result = await client.query({
        objectType: OBJECT_TYPE,
        fields: ['accountid', 'accountname'],
        query: `(accountname start-with ${testPrefix})`,
        limit: 25,
      });

      const duration = performance.now() - start;
      console.log(`  Got ${result.records.length} records in ${duration.toFixed(0)}ms`);

      expect(result.success).toBe(true);
      expect(result.records.length).toBe(25);
    }, 30000);
  });

  describe('Batch Stress Test (200 records)', () => {
    const RECORD_COUNT = 200;
    const testPrefix = `StressBatch_${Date.now()}`;
    let batchCreatedIds: string[] = [];

    afterAll(async () => {
      // Cleanup batch test records
      if (batchCreatedIds.length > 0) {
        console.log(`\nCleaning up ${batchCreatedIds.length} batch test records...`);
        const startCleanup = performance.now();

        try {
          await client.batch.delete(OBJECT_TYPE, batchCreatedIds);
        } catch (error) {
          console.error('Batch cleanup error:', error);
        }

        const cleanupDuration = performance.now() - startCleanup;
        console.log(`Batch cleanup completed in ${(cleanupDuration / 1000).toFixed(2)}s`);
      }
    }, 120000); // 2 minute timeout for cleanup

    it('should batch create 200 records (10 batches of 20)', async () => {
      console.log(`\nBatch creating ${RECORD_COUNT} records in 10 batches...`);
      const startCreate = performance.now();

      // Create in batches of 20 (API limit) with explicit loop for reliability
      const batchSize = 20;
      for (let i = 0; i < RECORD_COUNT; i += batchSize) {
        const records = Array.from({ length: Math.min(batchSize, RECORD_COUNT - i) }, (_, j) => ({
          accountname: `${testPrefix}_${i + j}`,
        }));

        const result = await client.batch.create(OBJECT_TYPE, records);
        expect(result.success).toBe(true);

        const ids = extractIds(result.data);
        batchCreatedIds.push(...ids);
      }

      const createDuration = performance.now() - startCreate;
      console.log(`Created ${batchCreatedIds.length} records in ${(createDuration / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${(batchCreatedIds.length / (createDuration / 1000)).toFixed(2)} records/sec`);
      console.log(`  Batches: ${Math.ceil(RECORD_COUNT / 20)}`);

      expect(batchCreatedIds.length).toBe(RECORD_COUNT);
    }, 120000); // 2 minute timeout

    it('should batch update 200 records', async () => {
      if (batchCreatedIds.length === 0) {
        console.log('Skipping update test - no records created');
        return;
      }

      console.log(`\nBatch updating ${batchCreatedIds.length} records...`);
      const startUpdate = performance.now();

      const updates = batchCreatedIds.map((id, i) => ({
        id,
        record: { accountname: `${testPrefix}_updated_${i}` },
      }));

      const result = await client.batch.update(OBJECT_TYPE, updates);

      const updateDuration = performance.now() - startUpdate;
      console.log(`Updated ${result.count} records in ${(updateDuration / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${(result.count / (updateDuration / 1000)).toFixed(2)} records/sec`);

      expect(result.success).toBe(true);
      expect(result.count).toBe(batchCreatedIds.length);
    }, 120000); // 2 minute timeout

    it('should query all 200 batch-created records', async () => {
      if (batchCreatedIds.length === 0) {
        console.log('Skipping query test - no records created');
        return;
      }

      console.log(`\nQuerying all ${batchCreatedIds.length} records with autoPage...`);
      const startQuery = performance.now();

      const result = await client.query({
        objectType: OBJECT_TYPE,
        fields: ['accountid', 'accountname'],
        query: `(accountname start-with ${testPrefix})`,
        autoPage: true,
      });

      const queryDuration = performance.now() - startQuery;
      console.log(`Queried ${result.records.length} records in ${(queryDuration / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${(result.records.length / (queryDuration / 1000)).toFixed(2)} records/sec`);
      console.log(`  Pages fetched: ${Math.ceil(result.records.length / 500)}`);

      expect(result.success).toBe(true);
      expect(result.records.length).toBe(batchCreatedIds.length);
    }, 60000); // 1 minute timeout

    it('should batch delete 200 records', async () => {
      if (batchCreatedIds.length === 0) {
        console.log('Skipping delete test - no records created');
        return;
      }

      console.log(`\nBatch deleting ${batchCreatedIds.length} records...`);
      const startDelete = performance.now();

      const result = await client.batch.delete(OBJECT_TYPE, batchCreatedIds);

      const deleteDuration = performance.now() - startDelete;
      console.log(`Deleted ${result.count} records in ${(deleteDuration / 1000).toFixed(2)}s`);
      console.log(`  Rate: ${(result.count / (deleteDuration / 1000)).toFixed(2)} records/sec`);

      expect(result.success).toBe(true);
      expect(result.count).toBe(batchCreatedIds.length);

      // Clear the array since we've deleted them
      batchCreatedIds = [];
    }, 120000); // 2 minute timeout
  });
});
