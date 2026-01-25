import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FireberryClient } from '../../src/client';
import type { QueryResult } from '../../src/types/query';
import { SDKTransport } from '../../src/transport/sdk';
import type { FireberrySDKClient, FireberrySDKAPI, SDKResponseData } from '../../src/types/sdk';

describe('RecordsAPI', () => {
  let client: FireberryClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create client without API key to avoid actual HTTP calls
    client = new FireberryClient({ apiKey: 'test-key' });

    // Mock the query method
    mockQuery = vi.fn();
    mockUpdate = vi.fn();
    mockCreate = vi.fn();

    // @ts-expect-error - Mocking for test
    client.query = mockQuery;
    // @ts-expect-error - Mocking for test
    client.records.update = mockUpdate;
    // @ts-expect-error - Mocking for test
    client.records.create = mockCreate;
  });

  describe('upsert() - Case-Insensitive ID Field Lookup', () => {
    it('should handle ID field with exact casing (lowercase)', async () => {
      // Mock query to return a record with lowercase field name
      const mockQueryResult: QueryResult = {
        records: [
          {
            accountid: 'test-id-123', // lowercase (standard HTTP API format)
            accountname: 'Test Account',
          },
        ],
        totalRecords: 1,
        pageNumber: 1,
        pageSize: 1,
      };

      mockQuery.mockResolvedValue(mockQueryResult);
      mockUpdate.mockResolvedValue({ accountid: 'test-id-123', accountname: 'Updated' });

      const result = await client.records.upsert(
        '1',
        ['accountname'],
        { accountname: 'Test Account', description: 'Updated' },
      );

      expect(result.operationType).toBe('update');
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        'test-id-123',
        { accountname: 'Test Account', description: 'Updated' },
        undefined,
      );
    });

    it('should handle ID field with PascalCase (SDK format)', async () => {
      // Mock query to return a record with PascalCase field name (SDK format)
      const mockQueryResult: QueryResult = {
        records: [
          {
            AccountId: 'test-id-456', // PascalCase (SDK format)
            AccountName: 'Test Account SDK',
          },
        ],
        totalRecords: 1,
        pageNumber: 1,
        pageSize: 1,
      };

      mockQuery.mockResolvedValue(mockQueryResult);
      mockUpdate.mockResolvedValue({ AccountId: 'test-id-456', AccountName: 'Updated' });

      const result = await client.records.upsert(
        '1',
        ['AccountName'],
        { AccountName: 'Test Account SDK', description: 'Updated' },
      );

      expect(result.operationType).toBe('update');
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        'test-id-456',
        { AccountName: 'Test Account SDK', description: 'Updated' },
        undefined,
      );
    });

    it('should handle ID field with camelCase', async () => {
      // Mock query to return a record with camelCase field name
      const mockQueryResult: QueryResult = {
        records: [
          {
            accountId: 'test-id-789', // camelCase
            accountName: 'Test Account Camel',
          },
        ],
        totalRecords: 1,
        pageNumber: 1,
        pageSize: 1,
      };

      mockQuery.mockResolvedValue(mockQueryResult);
      mockUpdate.mockResolvedValue({ accountId: 'test-id-789', accountName: 'Updated' });

      const result = await client.records.upsert(
        '1',
        ['accountName'],
        { accountName: 'Test Account Camel', description: 'Updated' },
      );

      expect(result.operationType).toBe('update');
      expect(mockUpdate).toHaveBeenCalledWith(
        '1',
        'test-id-789',
        { accountName: 'Test Account Camel', description: 'Updated' },
        undefined,
      );
    });

    it('should throw error when ID field is not found', async () => {
      // Mock query to return a record without the ID field
      const mockQueryResult: QueryResult = {
        records: [
          {
            name: 'Test Account',
            description: 'No ID field',
          },
        ],
        totalRecords: 1,
        pageNumber: 1,
        pageSize: 1,
      };

      mockQuery.mockResolvedValue(mockQueryResult);

      await expect(
        client.records.upsert('1', ['name'], { name: 'Test Account' }),
      ).rejects.toThrow('Could not find ID field "accountid" in existing record');
    });

    it('should create when no existing record found', async () => {
      // Mock query to return no records
      const mockQueryResult: QueryResult = {
        records: [],
        totalRecords: 0,
        pageNumber: 1,
        pageSize: 1,
      };

      mockQuery.mockResolvedValue(mockQueryResult);
      mockCreate.mockResolvedValue({ accountid: 'new-id-123', accountname: 'New Account' });

      const result = await client.records.upsert(
        '1',
        ['accountname'],
        { accountname: 'New Account' },
      );

      expect(result.operationType).toBe('create');
      expect(mockCreate).toHaveBeenCalledWith(
        '1',
        { accountname: 'New Account' },
        undefined,
      );
    });
  });
});

describe('SDKTransport - Query Response Parsing', () => {
  let mockSDKClient: FireberrySDKClient;
  let mockQueryFn: ReturnType<typeof vi.fn>;
  let transport: SDKTransport;

  beforeEach(() => {
    mockQueryFn = vi.fn();

    const mockAPI: FireberrySDKAPI = {
      query: mockQueryFn,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockSDKClient = {
      api: mockAPI,
      context: null,
      initializeContext: vi.fn(),
      destroy: vi.fn(),
    };

    transport = new SDKTransport({ sdk: mockSDKClient });
  });

  it('should correctly parse SDK response with Columns and Data structure', async () => {
    // Mock the actual Fireberry SDK response structure (as shown by the user)
    const mockResponse: SDKResponseData = {
      success: true,
      data: {
        Columns: [
          { name: 'Account ID', fieldname: 'accountid' },
          { name: 'Account Name', fieldname: 'accountname' },
        ],
        Data: [
          { accountid: 'test-id-123', accountname: 'Test Account' },
          { accountid: 'test-id-456', accountname: 'Another Account' },
        ],
      },
      isParentReady: true,
      requestId: 'test-request-id',
    };

    mockQueryFn.mockResolvedValue(mockResponse);

    const result = await transport.query({
      objectType: '1',
      fields: '*',
      query: '(accountname = Test)',
    });

    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toEqual({ accountid: 'test-id-123', accountname: 'Test Account' });
    expect(result.records[1]).toEqual({ accountid: 'test-id-456', accountname: 'Another Account' });
  });

  it('should return empty array when Data is empty', async () => {
    // Mock SDK response with empty Data array
    const mockResponse: SDKResponseData = {
      success: true,
      data: {
        Columns: [
          { name: 'Account ID', fieldname: 'accountid' },
        ],
        Data: [],
      },
      isParentReady: true,
      requestId: 'test-request-id',
    };

    mockQueryFn.mockResolvedValue(mockResponse);

    const result = await transport.query({
      objectType: '1',
      fields: '*',
      query: '(accountname = NonExistent)',
    });

    expect(result.records).toHaveLength(0);
    expect(result.records).toEqual([]);
  });

  it('should handle array response format', async () => {
    // Mock SDK response as direct array
    const mockResponse: SDKResponseData = {
      success: true,
      data: [
        { accountid: 'test-id-789', accountname: 'Array Format Account' },
      ],
      isParentReady: true,
      requestId: 'test-request-id',
    };

    mockQueryFn.mockResolvedValue(mockResponse);

    const result = await transport.query({
      objectType: '1',
      fields: '*',
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({ accountid: 'test-id-789', accountname: 'Array Format Account' });
  });

  it('should not treat Columns object as a record', async () => {
    // This is the bug scenario - ensure Columns metadata is not returned as a record
    const mockResponse: SDKResponseData = {
      success: true,
      data: {
        Columns: [
          { name: 'Field', fieldname: 'field' },
        ],
        Data: [],
      },
      isParentReady: true,
      requestId: 'test-request-id',
    };

    mockQueryFn.mockResolvedValue(mockResponse);

    const result = await transport.query({
      objectType: '1',
      fields: '*',
    });

    // Should return empty array, NOT the Columns object
    expect(result.records).toHaveLength(0);
    expect(result.records).not.toContainEqual(
      expect.objectContaining({ Columns: expect.anything() })
    );
  });
});
