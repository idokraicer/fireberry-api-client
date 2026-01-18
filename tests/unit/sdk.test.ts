import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SDKQueryBuilder,
  createSDKQueryBuilder,
  EnhancedSDK,
  type FireberrySDKClient,
  type FireberrySDKAPI,
  type SDKResponseData,
  type SDKContext,
} from '../../src/sdk';

// Mock SDK API
function createMockSDKAPI(): FireberrySDKAPI {
  return {
    query: vi.fn().mockResolvedValue({
      success: true,
      data: { records: [] },
      isParentReady: true,
      requestId: 'test-request-id',
    }),
    create: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'new-record-id' },
      isParentReady: true,
      requestId: 'test-request-id',
    }),
    update: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'updated-record-id' },
      isParentReady: true,
      requestId: 'test-request-id',
    }),
    delete: vi.fn().mockResolvedValue({
      success: true,
      data: {},
      isParentReady: true,
      requestId: 'test-request-id',
    }),
  };
}

// Mock SDK Client
function createMockSDKClient(context?: SDKContext | null): FireberrySDKClient {
  const api = createMockSDKAPI();
  // If context is explicitly null, use null; otherwise use default or provided context
  const resolvedContext = context === null
    ? null
    : context ?? {
        user: { id: 'user-123', fullName: 'Test User' },
        record: { id: 'record-456', type: 1 },
      };

  const client: FireberrySDKClient = {
    api,
    context: resolvedContext,
    initializeContext: vi.fn().mockImplementation(async function() { return client; }),
    destroy: vi.fn(),
  };
  return client;
}

describe('SDK Adapter', () => {
  describe('SDKQueryBuilder', () => {
    let mockAPI: FireberrySDKAPI;

    beforeEach(() => {
      mockAPI = createMockSDKAPI();
    });

    describe('basic query building', () => {
      it('should create a query builder for an object type', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        expect(builder).toBeInstanceOf(SDKQueryBuilder);
      });

      it('should build query payload with selected fields', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder
          .select('accountid', 'accountname', 'statuscode')
          .toQueryPayload();

        expect(payload.fields).toBe('accountid,accountname,statuscode');
        expect(payload.query).toBe('');
      });

      it('should default to * when no fields selected', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder.toQueryPayload();

        expect(payload.fields).toBe('*');
      });

      it('should build query with where conditions', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('statuscode').equals('1');
        const payload = builder.toQueryPayload();

        expect(payload.query).toBe('(statuscode = 1)');
      });

      it('should chain multiple conditions with and()', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder
          .where('statuscode').equals('1');
        builder.and();
        builder.where('ownerid').equals('user-123');
        const payload = builder.toQueryPayload();

        expect(payload.query).toBe('(statuscode = 1) and (ownerid = user-123)');
      });

      it('should chain multiple conditions with or()', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('statuscode').equals('1');
        builder.or();
        builder.where('statuscode').equals('2');
        const payload = builder.toQueryPayload();

        expect(payload.query).toBe('(statuscode = 1) or (statuscode = 2)');
      });
    });

    describe('pagination', () => {
      it('should set page size', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder.pageSize(50).toQueryPayload();

        expect(payload.page_size).toBe(50);
      });

      it('should set page number', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder.page(2).toQueryPayload();

        expect(payload.page_number).toBe(2);
      });

      it('should not include page_number for page 1', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder.page(1).toQueryPayload();

        expect(payload.page_number).toBeUndefined();
      });

      it('should combine pagination options', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder
          .pageSize(25)
          .page(3)
          .toQueryPayload();

        expect(payload.page_size).toBe(25);
        expect(payload.page_number).toBe(3);
      });
    });

    describe('selectWithLabels', () => {
      it('should add label fields for dropdown/lookup fields', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder
          .selectWithLabels('statuscode', 'ownerid')
          .toQueryPayload();

        // statuscode -> status, ownerid -> ownername
        expect(payload.fields).toContain('statuscode');
        expect(payload.fields).toContain('status');
        expect(payload.fields).toContain('ownerid');
        expect(payload.fields).toContain('ownername');
      });

      it('should not duplicate fields', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        const payload = builder
          .select('accountid')
          .selectWithLabels('accountid', 'statuscode')
          .toQueryPayload();

        const fields = payload.fields.split(',');
        const accountidCount = fields.filter(f => f === 'accountid').length;
        expect(accountidCount).toBe(1);
      });
    });

    describe('execute', () => {
      it('should call SDK query method with correct payload', async () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        await builder
          .select('accountid', 'accountname')
          .where('statuscode').equals('1')
          .pageSize(50)
          .execute();

        expect(mockAPI.query).toHaveBeenCalledWith(1, {
          fields: 'accountid,accountname',
          query: '(statuscode = 1)',
          page_size: 50,
        });
      });

      it('should return SDK response', async () => {
        const mockResponse: SDKResponseData = {
          success: true,
          data: { records: [{ accountid: '123', accountname: 'Test' }] },
          isParentReady: true,
          requestId: 'req-123',
        };
        (mockAPI.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const builder = new SDKQueryBuilder(mockAPI, 1);
        const result = await builder.select('accountid').execute();

        expect(result).toEqual(mockResponse);
      });
    });

    describe('query operators', () => {
      it('should support equals', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').equals('value');
        expect(builder.toQueryPayload().query).toBe('(field = value)');
      });

      it('should support notEquals', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').notEquals('value');
        expect(builder.toQueryPayload().query).toBe('(field != value)');
      });

      it('should support lessThan', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').lessThan(100);
        expect(builder.toQueryPayload().query).toBe('(field < 100)');
      });

      it('should support greaterThan', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').greaterThan(100);
        expect(builder.toQueryPayload().query).toBe('(field > 100)');
      });

      it('should support lessThanOrEqual', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').lessThanOrEqual(100);
        expect(builder.toQueryPayload().query).toBe('(field <= 100)');
      });

      it('should support greaterThanOrEqual', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').greaterThanOrEqual(100);
        expect(builder.toQueryPayload().query).toBe('(field >= 100)');
      });

      it('should support contains', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').contains('value');
        expect(builder.toQueryPayload().query).toBe('(field start-with %value)');
      });

      it('should support notContains', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').notContains('value');
        expect(builder.toQueryPayload().query).toBe('(field not-start-with %value)');
      });

      it('should support startsWith', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').startsWith('prefix');
        expect(builder.toQueryPayload().query).toBe('(field start-with prefix)');
      });

      it('should support notStartsWith', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').notStartsWith('prefix');
        expect(builder.toQueryPayload().query).toBe('(field not-start-with prefix)');
      });

      it('should support isNull', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').isNull();
        expect(builder.toQueryPayload().query).toBe('(field is-null)');
      });

      it('should support isNotNull', () => {
        const builder = new SDKQueryBuilder(mockAPI, 1);
        builder.where('field').isNotNull();
        expect(builder.toQueryPayload().query).toBe('(field is-not-null)');
      });
    });
  });

  describe('createSDKQueryBuilder', () => {
    it('should create a query builder factory from SDK client', () => {
      const mockClient = createMockSDKClient();
      const queryBuilder = createSDKQueryBuilder(mockClient);

      expect(typeof queryBuilder).toBe('function');
    });

    it('should create SDKQueryBuilder instances', () => {
      const mockClient = createMockSDKClient();
      const queryBuilder = createSDKQueryBuilder(mockClient);

      const builder = queryBuilder(1);
      expect(builder).toBeInstanceOf(SDKQueryBuilder);
    });

    it('should accept SDK API directly', () => {
      const mockAPI = createMockSDKAPI();
      const queryBuilder = createSDKQueryBuilder(mockAPI as unknown as FireberrySDKClient);

      const builder = queryBuilder(1);
      expect(builder).toBeInstanceOf(SDKQueryBuilder);
    });

    it('should execute queries through the SDK', async () => {
      const mockClient = createMockSDKClient();
      const queryBuilder = createSDKQueryBuilder(mockClient);

      await queryBuilder(1)
        .select('accountid')
        .where('statuscode').equals('1')
        .execute();

      expect(mockClient.api.query).toHaveBeenCalled();
    });
  });

  describe('EnhancedSDK', () => {
    describe('creation', () => {
      it('should create wrapper from SDK client', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced).toBeInstanceOf(EnhancedSDK);
      });
    });

    describe('context access', () => {
      it('should expose user ID from context', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.userId).toBe('user-123');
      });

      it('should expose user full name from context', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.userFullName).toBe('Test User');
      });

      it('should expose record ID from context', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.recordId).toBe('record-456');
      });

      it('should expose record type from context', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.recordType).toBe(1);
      });

      it('should handle null context gracefully', () => {
        const mockClient = createMockSDKClient(null);
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.userId).toBeUndefined();
        expect(enhanced.recordId).toBeUndefined();
      });
    });

    describe('query method', () => {
      it('should create SDKQueryBuilder for object type', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        const builder = enhanced.query(1);
        expect(builder).toBeInstanceOf(SDKQueryBuilder);
      });

      it('should execute queries through SDK API', async () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        await enhanced
          .query(1)
          .select('accountid')
          .execute();

        expect(mockClient.api.query).toHaveBeenCalled();
      });
    });

    describe('utility methods', () => {
      it('should get ID field for object type', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.getIdField(1)).toBe('accountid');
        expect(enhanced.getIdField(2)).toBe('contactid');
        expect(enhanced.getIdField(1000)).toBe('customobject1000id');
      });

      it('should get name field for object type', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.getNameField(1)).toBe('accountname');
        expect(enhanced.getNameField(2)).toBe('fullname');
        expect(enhanced.getNameField(14)).toBe('productname');
      });

      it('should get label field for dropdown/lookup', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.getLabelField('statuscode', 1)).toBe('status');
        expect(enhanced.getLabelField('ownerid', 1)).toBe('ownername');
      });

      it('should expand fields with labels', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        const expanded = enhanced.expandFieldsWithLabels(['statuscode', 'ownerid'], 1);

        expect(expanded).toContain('statuscode');
        expect(expanded).toContain('status');
        expect(expanded).toContain('ownerid');
        expect(expanded).toContain('ownername');
      });

      it('should not duplicate fields when expanding', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        const expanded = enhanced.expandFieldsWithLabels(['statuscode', 'statuscode'], 1);
        const statusCount = expanded.filter(f => f === 'statuscode').length;

        expect(statusCount).toBe(1);
      });

      it('should get excluded fields for star query', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        const excluded = enhanced.getExcludedFields(7); // Note object
        expect(excluded).toContain('deletedon');
        expect(excluded).toContain('deletedby');
      });
    });

    describe('CRUD operations', () => {
      it('should create records', async () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        await enhanced.create(1, { accountname: 'Test Account' });

        expect(mockClient.api.create).toHaveBeenCalledWith(1, { accountname: 'Test Account' });
      });

      it('should update records', async () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        await enhanced.update(1, 'record-id', { accountname: 'Updated' });

        expect(mockClient.api.update).toHaveBeenCalledWith(1, 'record-id', { accountname: 'Updated' });
      });

      it('should delete records', async () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        await enhanced.delete(1, 'record-id');

        expect(mockClient.api.delete).toHaveBeenCalledWith(1, 'record-id');
      });
    });

    describe('cleanup', () => {
      it('should call destroy on underlying SDK', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        enhanced.destroy();

        expect(mockClient.destroy).toHaveBeenCalled();
      });
    });

    describe('direct API access', () => {
      it('should expose underlying API', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.api).toBe(mockClient.api);
      });

      it('should expose context', () => {
        const mockClient = createMockSDKClient();
        const enhanced = EnhancedSDK.create(mockClient);

        expect(enhanced.context).toBe(mockClient.context);
      });
    });
  });

  describe('QueryBuilder.toSDKPayload', () => {
    // Test the toSDKPayload method added to the base QueryBuilder
    it('should be importable from main package', async () => {
      const { QueryBuilder } = await import('../../src/utils/queryBuilder');

      const builder = new QueryBuilder();
      const payload = builder
        .select('field1', 'field2')
        .where('status').equals('1')
        .limit(50)
        .page(2)
        .toSDKPayload();

      expect(payload.fields).toBe('field1,field2');
      expect(payload.query).toBe('(status = 1)');
      expect(payload.page_size).toBe(50);
      expect(payload.page_number).toBe(2);
    });

    it('should not include page_number for page 1', async () => {
      const { QueryBuilder } = await import('../../src/utils/queryBuilder');

      const builder = new QueryBuilder();
      const payload = builder
        .select('field1')
        .page(1)
        .toSDKPayload();

      expect(payload.page_number).toBeUndefined();
    });
  });
});

describe('SDK Adapter Integration', () => {
  describe('full query workflow', () => {
    it('should execute complete query workflow', async () => {
      const mockRecords = [
        { accountid: '1', accountname: 'Acme Corp', statuscode: '1', status: 'Active' },
        { accountid: '2', accountname: 'Beta Inc', statuscode: '1', status: 'Active' },
      ];

      const mockAPI = createMockSDKAPI();
      (mockAPI.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { records: mockRecords },
        isParentReady: true,
        requestId: 'req-123',
      });

      const mockClient: FireberrySDKClient = {
        api: mockAPI,
        context: {
          user: { id: 'user-1', fullName: 'John Doe' },
          record: { id: 'rec-1', type: 1 },
        },
        initializeContext: vi.fn(),
        destroy: vi.fn(),
      };

      const enhanced = EnhancedSDK.create(mockClient);

      // Query using the enhanced SDK
      const result = await enhanced
        .query(1)
        .selectWithLabels('accountid', 'accountname', 'statuscode')
        .where('statuscode').equals('1')
        .pageSize(100)
        .execute();

      expect(result.success).toBe(true);
      expect(result.data.records).toEqual(mockRecords);

      // Verify the API was called correctly
      expect(mockAPI.query).toHaveBeenCalledWith(1, expect.objectContaining({
        query: '(statuscode = 1)',
        page_size: 100,
      }));
    });

    it('should support complex queries with multiple conditions', async () => {
      const mockAPI = createMockSDKAPI();
      const mockClient = createMockSDKClient();
      (mockClient as { api: FireberrySDKAPI }).api = mockAPI;

      const enhanced = EnhancedSDK.create(mockClient);

      await enhanced
        .query(1)
        .select('accountid', 'accountname')
        .where('statuscode').equals('1');

      // Get the builder and continue
      const builder = enhanced.query(1)
        .select('accountid', 'accountname');

      builder.where('statuscode').equals('1');
      builder.and();
      builder.where('ownerid').equals(enhanced.userId!);
      builder.and();
      builder.where('accountname').contains('Corp');

      await builder.execute();

      expect(mockAPI.query).toHaveBeenCalledWith(1, expect.objectContaining({
        query: '(statuscode = 1) and (ownerid = user-123) and (accountname start-with %Corp)',
      }));
    });
  });

  describe('CRUD workflow', () => {
    it('should support full CRUD cycle', async () => {
      const mockClient = createMockSDKClient();
      const enhanced = EnhancedSDK.create(mockClient);

      // Create
      await enhanced.create(1, { accountname: 'New Corp' });
      expect(mockClient.api.create).toHaveBeenCalledWith(1, { accountname: 'New Corp' });

      // Update
      await enhanced.update(1, 'new-id', { accountname: 'Updated Corp' });
      expect(mockClient.api.update).toHaveBeenCalledWith(1, 'new-id', { accountname: 'Updated Corp' });

      // Delete
      await enhanced.delete(1, 'new-id');
      expect(mockClient.api.delete).toHaveBeenCalledWith(1, 'new-id');
    });
  });

  describe('context-aware queries', () => {
    it('should use context in queries', async () => {
      const mockClient = createMockSDKClient();
      const enhanced = EnhancedSDK.create(mockClient);

      // Query records owned by current user
      const builder = enhanced.query(1)
        .select('accountid', 'accountname');
      builder.where('ownerid').equals(enhanced.userId!);
      await builder.execute();

      expect(mockClient.api.query).toHaveBeenCalledWith(1, expect.objectContaining({
        query: '(ownerid = user-123)',
      }));
    });

    it('should use record type from context', async () => {
      const mockClient = createMockSDKClient();
      const enhanced = EnhancedSDK.create(mockClient);

      // Query using current record's type
      const objectType = enhanced.recordType!;
      await enhanced.query(objectType).select('*').execute();

      expect(mockClient.api.query).toHaveBeenCalledWith(1, expect.anything());
    });
  });
});
