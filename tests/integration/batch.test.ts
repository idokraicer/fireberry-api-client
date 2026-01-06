import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FireberryClient } from '../../src';

const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

// Helper to extract IDs from batch response
// Batch API returns { id, success, message } objects, not full records
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

describeIntegration('BatchAPI (Integration)', () => {
  let client: FireberryClient;
  const createdIds: string[] = [];

  beforeAll(() => {
    client = new FireberryClient({
      apiKey: process.env.FIREBERRY_TOKEN!,
      timeout: 30000,
      retryOn429: true,
      maxRetries: 5,
    });
  });

  afterAll(async () => {
    // Cleanup: delete all created records using individual deletes (more reliable)
    for (const id of createdIds) {
      try {
        await client.records.delete('1', id);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('batch.create()', () => {
    it('should create multiple records in batch', async () => {
      const records = [
        { accountname: `Batch Create Test 1 ${Date.now()}` },
        { accountname: `Batch Create Test 2 ${Date.now()}` },
        { accountname: `Batch Create Test 3 ${Date.now()}` },
      ];

      const result = await client.batch.create('1', records);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);

      // Batch API returns { id, success, message } objects
      expect(Array.isArray(result.data)).toBe(true);
      const ids = extractIds(result.data);
      expect(ids.length).toBe(3);

      // Store created IDs for cleanup
      createdIds.push(...ids);
    });

    it('should handle empty array', async () => {
      const result = await client.batch.create('1', []);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('batch.update()', () => {
    it('should update multiple records in batch', async () => {
      // First create records to update
      const createRecords = [
        { accountname: `Batch Update Test 1 ${Date.now()}` },
        { accountname: `Batch Update Test 2 ${Date.now()}` },
      ];

      const createResult = await client.batch.create('1', createRecords);
      const idsToUpdate = extractIds(createResult.data);
      createdIds.push(...idsToUpdate);

      expect(idsToUpdate.length).toBe(2);

      // Now update them
      const updateRecords = idsToUpdate.map((id, index) => ({
        id,
        record: { accountname: `Updated Batch ${index} ${Date.now()}` },
      }));

      const updateResult = await client.batch.update('1', updateRecords);

      expect(updateResult.success).toBe(true);
      expect(updateResult.count).toBe(2);
    });
  });

  describe('batch.delete()', () => {
    it('should delete multiple records in batch', async () => {
      // First create records to delete
      const createRecords = [
        { accountname: `Batch Delete Test 1 ${Date.now()}` },
        { accountname: `Batch Delete Test 2 ${Date.now()}` },
      ];

      const createResult = await client.batch.create('1', createRecords);
      const idsToDelete = extractIds(createResult.data);

      expect(idsToDelete.length).toBe(2);

      const deleteResult = await client.batch.delete('1', idsToDelete);

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.ids).toEqual(idsToDelete);
      expect(deleteResult.count).toBe(idsToDelete.length);
    });

    it('should handle empty array', async () => {
      const result = await client.batch.delete('1', []);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('chunking', () => {
    it('should auto-chunk large batches (>20 records)', async () => {
      // Create 25 records to test chunking
      const records = Array.from({ length: 25 }, (_, i) => ({
        accountname: `Chunk Test ${i} ${Date.now()}`,
      }));

      const result = await client.batch.create('1', records);

      expect(result.success).toBe(true);
      expect(result.count).toBe(25);

      // Store for cleanup
      const ids = extractIds(result.data);
      createdIds.push(...ids);
    });
  });
});
