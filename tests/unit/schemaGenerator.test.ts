import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FireberryClient } from '../../src';
import { generateSchema, schemaBuilder, SchemaBuilder } from '../../src/utils/schemaGenerator';
import { FIELD_TYPE_IDS } from '../../src/constants/fieldTypes';

// Mock fetch at module level
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Metadata API responses use { success: true, data: [...] }
const createMetadataResponse = (data: unknown, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({ success: true, data }),
  });
};

const mockObjects = [
  { objectType: 1, name: 'Account', systemName: 'Account' },
  { objectType: 2, name: 'Contact', systemName: 'Contact' },
  { objectType: 1000, name: 'Custom Object', systemName: 'CustomObject1000' },
];

const mockAccountFields = [
  { fieldName: 'accountid', label: 'Account ID', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
  { fieldName: 'accountname', label: 'Account Name', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text', required: true },
  { fieldName: 'revenue', label: 'Revenue', systemFieldTypeId: FIELD_TYPE_IDS.NUMERIC, fieldType: 'Numeric' },
  { fieldName: 'statuscode', label: 'Status', systemFieldTypeId: FIELD_TYPE_IDS.DROPDOWN, fieldType: 'Dropdown' },
  { fieldName: 'primarycontactid', label: 'Primary Contact', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, fieldType: 'Lookup', relatedObjectType: 2 },
  { fieldName: 'createdon', label: 'Created On', systemFieldTypeId: FIELD_TYPE_IDS.DATE, fieldType: 'Date' },
  { fieldName: 'modifiedon', label: 'Modified On', systemFieldTypeId: FIELD_TYPE_IDS.DATETIME, fieldType: 'DateTime' },
  { fieldName: 'email', label: 'Email', systemFieldTypeId: FIELD_TYPE_IDS.EMAIL, fieldType: 'Email' },
  { fieldName: 'website', label: 'Website', systemFieldTypeId: FIELD_TYPE_IDS.URL, fieldType: 'URL' },
  { fieldName: 'phone', label: 'Phone', systemFieldTypeId: FIELD_TYPE_IDS.TELEPHONE, fieldType: 'Telephone' },
  { fieldName: 'description', label: 'Description', systemFieldTypeId: FIELD_TYPE_IDS.LONG_TEXT, fieldType: 'Long Text' },
  { fieldName: 'notes', label: 'Notes', systemFieldTypeId: FIELD_TYPE_IDS.HTML, fieldType: 'HTML' },
];

const mockContactFields = [
  { fieldName: 'contactid', label: 'Contact ID', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
  { fieldName: 'fullname', label: 'Full Name', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text', required: true },
  { fieldName: 'accountid', label: 'Account', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, fieldType: 'Lookup', relatedObjectType: 1 },
];

describe('Schema Generator', () => {
  let client: FireberryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FireberryClient({ apiKey: 'test-key' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSchema', () => {
    it('should generate TypeScript interfaces for all objects', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects)) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)) // getFields for Account
        .mockReturnValueOnce(createMetadataResponse(mockContactFields)) // getFields for Contact
        .mockReturnValueOnce(createMetadataResponse([])); // getFields for CustomObject1000

      const result = await generateSchema(client);

      expect(result.objects).toHaveLength(3);
      expect(result.typescript).toContain('export interface Account');
      expect(result.typescript).toContain('export interface Contact');
      expect(result.typescript).toContain('export interface CustomObject1000');
      expect(result.metadata.totalObjects).toBe(3);
    });

    it('should include field types in comments by default', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1] });

      expect(result.typescript).toContain('@type Text');
      expect(result.typescript).toContain('@type Numeric');
      expect(result.typescript).toContain('@type Dropdown');
      expect(result.typescript).toContain('@type Lookup');
    });

    it('should include lookup relation info by default', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1] });

      expect(result.typescript).toContain('@relatedObjectType 2');
    });

    it('should mark required fields without optional modifier', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1] });

      // Required field should not have ?
      expect(result.typescript).toMatch(/accountname:\s*string;/);
      // Optional fields should have ?
      expect(result.typescript).toMatch(/accountid\?:\s*string;/);
    });

    it('should filter objects with include option', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects)) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields for Account only

      const result = await generateSchema(client, { include: [1] });

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].name).toBe('Account');
      expect(result.typescript).toContain('export interface Account');
      expect(result.typescript).not.toContain('export interface Contact');
    });

    it('should filter objects with exclude option', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects)) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)) // Account
        .mockReturnValueOnce(createMetadataResponse(mockContactFields)); // Contact

      const result = await generateSchema(client, { exclude: [1000] });

      expect(result.objects).toHaveLength(2);
      expect(result.typescript).not.toContain('CustomObject1000');
    });

    it('should add prefix to interface names', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1], prefix: 'FB' });

      expect(result.objects[0].interfaceName).toBe('FBAccount');
      expect(result.typescript).toContain('export interface FBAccount');
    });

    it('should add suffix to interface names', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1], suffix: 'Entity' });

      expect(result.objects[0].interfaceName).toBe('AccountEntity');
      expect(result.typescript).toContain('export interface AccountEntity');
    });

    it('should generate readonly interfaces when option is set', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1], readonly: true });

      expect(result.typescript).toContain('readonly accountid');
      expect(result.typescript).toContain('readonly accountname');
    });

    it('should omit comments when includeComments is false', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1], includeComments: false });

      expect(result.typescript).not.toContain('Account Name');
      expect(result.typescript).not.toContain('Primary Contact');
    });

    it('should omit field types when includeFieldTypes is false', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1], includeFieldTypes: false });

      expect(result.typescript).not.toContain('@type');
    });

    it('should omit lookup info when includeLookupInfo is false', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1], includeLookupInfo: false });

      expect(result.typescript).not.toContain('@relatedObjectType');
    });

    it('should map field types to TypeScript types correctly', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1] });

      // Numeric -> number
      expect(result.typescript).toMatch(/revenue\?:\s*number;/);
      // Dropdown -> string | number
      expect(result.typescript).toMatch(/statuscode\?:\s*string \| number;/);
      // Lookup -> string
      expect(result.typescript).toMatch(/primarycontactid\?:\s*string;/);
      // Date/DateTime -> string
      expect(result.typescript).toMatch(/createdon\?:\s*string;/);
      expect(result.typescript).toMatch(/modifiedon\?:\s*string;/);
      // Text types -> string
      expect(result.typescript).toMatch(/email\?:\s*string;/);
      expect(result.typescript).toMatch(/website\?:\s*string;/);
      expect(result.typescript).toMatch(/phone\?:\s*string;/);
      expect(result.typescript).toMatch(/description\?:\s*string;/);
      expect(result.typescript).toMatch(/notes\?:\s*string;/);
    });

    it('should include metadata in result', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1] });

      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.totalObjects).toBe(1);
      expect(result.metadata.totalFields).toBe(mockAccountFields.length);
    });

    it('should include header with generation info', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // getObjects
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields)); // getFields

      const result = await generateSchema(client, { include: [1] });

      expect(result.typescript).toContain('Fireberry Schema Types');
      expect(result.typescript).toContain('Auto-generated by fireberry-api-client');
      expect(result.typescript).toContain('Generated at:');
    });

    it('should handle objects with special characters in names', async () => {
      const specialObject = { objectType: 999, name: 'Test Object!', systemName: 'Test-Object_123' };
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([specialObject]))
        .mockReturnValueOnce(createMetadataResponse([]));

      const result = await generateSchema(client);

      expect(result.typescript).toContain('export interface TestObject_123');
    });

    it('should handle objects starting with numbers', async () => {
      const numericObject = { objectType: 999, name: '123 Object', systemName: '123Object' };
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([numericObject]))
        .mockReturnValueOnce(createMetadataResponse([]));

      const result = await generateSchema(client);

      // Should prefix with underscore
      expect(result.typescript).toContain('export interface _123Object');
    });
  });

  describe('schemaBuilder', () => {
    it('should return a SchemaBuilder instance', () => {
      const builder = schemaBuilder(client);
      expect(builder).toBeInstanceOf(SchemaBuilder);
    });

    it('should support fluent chaining', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await schemaBuilder(client)
        .include([1])
        .exclude([])
        .withComments()
        .withFieldTypes()
        .withLookupInfo()
        .withPrefix('Test')
        .withSuffix('Type')
        .asReadonly()
        .generate();

      expect(result.objects[0].interfaceName).toBe('TestAccountType');
      expect(result.typescript).toContain('readonly ');
    });

    it('should allow disabling comments', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await schemaBuilder(client)
        .include([1])
        .withComments(false)
        .generate();

      // Should still have interface comments but not field label comments
      expect(result.typescript).toContain('Account (Object Type: 1)');
      expect(result.typescript).not.toContain('Account Name');
    });

    it('should allow disabling field types', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await schemaBuilder(client)
        .include([1])
        .withFieldTypes(false)
        .generate();

      expect(result.typescript).not.toContain('@type');
    });

    it('should allow disabling lookup info', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await schemaBuilder(client)
        .include([1])
        .withLookupInfo(false)
        .generate();

      expect(result.typescript).not.toContain('@relatedObjectType');
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockReturnValueOnce(createMetadataResponse(mockObjects));

      // Should not throw but should return empty/partial results
      const result = await schemaBuilder(client)
        .withSignal(controller.signal)
        .generate();

      // The signal was already aborted, so should have no processed objects
      expect(result.objects).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects list', async () => {
      mockFetch.mockReturnValueOnce(createMetadataResponse([]));

      const result = await generateSchema(client);

      expect(result.objects).toHaveLength(0);
      expect(result.metadata.totalObjects).toBe(0);
      expect(result.metadata.totalFields).toBe(0);
    });

    it('should handle objects with no fields', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse([]));

      const result = await generateSchema(client, { include: [1] });

      expect(result.objects[0].fieldCount).toBe(0);
      expect(result.typescript).toContain('export interface Account {');
      expect(result.typescript).toContain('}');
    });

    it('should handle fields with unknown type IDs', async () => {
      const unknownTypeField = [
        { fieldName: 'customfield', label: 'Custom', systemFieldTypeId: 9999, fieldType: 'Unknown' },
      ];
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(unknownTypeField));

      const result = await generateSchema(client, { include: [1] });

      // Unknown types should default to string
      expect(result.typescript).toMatch(/customfield\?:\s*string;/);
    });

    it('should handle string object type IDs', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await generateSchema(client, { include: ['1'] }); // String instead of number

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].name).toBe('Account');
    });
  });
});
