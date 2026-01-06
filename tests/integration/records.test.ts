import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FireberryClient } from '../../src';

const describeIntegration = process.env.FIREBERRY_TOKEN ? describe : describe.skip;

describeIntegration('RecordsAPI (Integration)', () => {
  let client: FireberryClient;
  let createdAccountId: string | null = null;

  beforeAll(() => {
    client = new FireberryClient({
      apiKey: process.env.FIREBERRY_TOKEN!,
      timeout: 30000,
      retryOn429: true,
      maxRetries: 5,
    });
  });

  afterAll(async () => {
    // Cleanup: delete any test account we created
    if (createdAccountId) {
      try {
        await client.records.delete('1', createdAccountId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('records.create()', () => {
    it('should create a new account', async () => {
      const testName = `Test Account ${Date.now()}`;

      const result = await client.records.create('1', {
        accountname: testName,
      });

      expect(result).toBeDefined();
      expect(result.accountid || result.id).toBeDefined();

      // Store for cleanup
      createdAccountId = String(result.accountid || result.id);
    });
  });

  describe('records.update()', () => {
    it('should update an existing account', async () => {
      // Skip if we don't have a created account
      if (!createdAccountId) {
        return;
      }

      const updatedName = `Updated Account ${Date.now()}`;

      const result = await client.records.update('1', createdAccountId, {
        accountname: updatedName,
      });

      expect(result).toBeDefined();
    });
  });

  describe('records.delete()', () => {
    it('should delete an account', async () => {
      // Create a new account to delete
      const testName = `Delete Test ${Date.now()}`;

      const created = await client.records.create('1', {
        accountname: testName,
      });

      const recordId = String(created.accountid || created.id);

      const result = await client.records.delete('1', recordId);

      expect(result.success).toBe(true);
      expect(result.id).toBe(recordId);
    });
  });

  describe('records.upsert()', () => {
    it('should create a new record when no match exists', async () => {
      const uniqueName = `Upsert Test ${Date.now()}`;

      const result = await client.records.upsert(
        '1',
        ['accountname'],
        { accountname: uniqueName },
      );

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('create');
      expect(result.newRecord).toBeDefined();

      // Cleanup
      const newId = String(result.newRecord?.accountid || result.newRecord?.id);
      if (newId) {
        await client.records.delete('1', newId);
      }
    });

    it('should update existing record when match exists', async () => {
      // First create a record
      const testName = `Upsert Update Test ${Date.now()}`;

      const created = await client.records.create('1', {
        accountname: testName,
      });

      const createdId = String(created.accountid || created.id);

      // Now upsert with same key - should update
      const result = await client.records.upsert(
        '1',
        ['accountname'],
        { accountname: testName, description: 'Updated via upsert' },
      );

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('update');
      expect(result.oldRecord).toBeDefined();

      // Cleanup
      await client.records.delete('1', createdId);
    });
  });
});
