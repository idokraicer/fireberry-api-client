import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FireberryClient } from '../../src';
import { erdBuilder, generateFireberryERD, ERDBuilder } from '../../src/utils/erdGenerator';
import { FIELD_TYPE_IDS } from '../../src/constants/fieldTypes';

describe('ERD Generator', () => {
  let client: FireberryClient;
  let mockFetch: ReturnType<typeof vi.fn>;

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
    { objectType: 4, name: 'Opportunity', systemName: 'Opportunity' },
  ];

  const mockAccountFields = [
    { fieldName: 'accountid', label: 'Account ID', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
    { fieldName: 'accountname', label: 'Account Name', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
    { fieldName: 'statuscode', label: 'Status', systemFieldTypeId: FIELD_TYPE_IDS.DROPDOWN, fieldType: 'Dropdown' },
    { fieldName: 'primarycontactid', label: 'Primary Contact', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, fieldType: 'Lookup', relatedObjectType: 2 },
    { fieldName: 'createdon', label: 'Created On', systemFieldTypeId: FIELD_TYPE_IDS.DATE, fieldType: 'Date' },
    { fieldName: 'revenue', label: 'Revenue', systemFieldTypeId: FIELD_TYPE_IDS.NUMERIC, fieldType: 'Numeric' },
  ];

  const mockContactFields = [
    { fieldName: 'contactid', label: 'Contact ID', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
    { fieldName: 'fullname', label: 'Full Name', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
    { fieldName: 'accountid', label: 'Account', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, fieldType: 'Lookup', relatedObjectType: 1 },
    { fieldName: 'email', label: 'Email', systemFieldTypeId: FIELD_TYPE_IDS.EMAIL, fieldType: 'Email' },
  ];

  const mockOpportunityFields = [
    { fieldName: 'opportunityid', label: 'Opportunity ID', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
    { fieldName: 'name', label: 'Name', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, fieldType: 'Text' },
    { fieldName: 'accountid', label: 'Account', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, fieldType: 'Lookup', relatedObjectType: 1 },
    { fieldName: 'primarycontactid', label: 'Primary Contact', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, fieldType: 'Lookup', relatedObjectType: 2 },
  ];

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = new FireberryClient({ apiKey: 'test-key' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('erdBuilder', () => {
    it('should return an ERDBuilder instance', () => {
      const builder = erdBuilder(client);
      expect(builder).toBeInstanceOf(ERDBuilder);
    });

    it('should support fluent chaining', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client)
        .include([1])
        .exclude([])
        .settings({
          includeFields: true,
          showFieldTypes: true,
        })
        .generate();

      expect(result.objects).toHaveLength(1);
      expect(result.mermaid).toContain('erDiagram');
    });

    it('should generate ERD with correct Mermaid syntax', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client)
        .include([1])
        .settings({ includeFrontmatter: false })
        .generate();

      expect(result.mermaid).toMatch(/^erDiagram/);
      expect(result.mermaid).toContain('Account {');
      expect(result.mermaid).toContain('}');
    });
  });

  describe('generateFireberryERD', () => {
    it('should generate ERD for all objects by default', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields))
        .mockReturnValueOnce(createMetadataResponse(mockContactFields))
        .mockReturnValueOnce(createMetadataResponse(mockOpportunityFields));

      const result = await generateFireberryERD(client);

      expect(result.objects).toHaveLength(3);
      expect(result.mermaid).toContain('Account');
      expect(result.mermaid).toContain('Contact');
      expect(result.mermaid).toContain('Opportunity');
    });

    it('should filter objects with include option', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await generateFireberryERD(client, { include: [1] });

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].systemName).toBe('Account');
    });

    it('should filter objects with exclude option', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields))
        .mockReturnValueOnce(createMetadataResponse(mockContactFields));

      const result = await generateFireberryERD(client, { exclude: [4] });

      expect(result.objects).toHaveLength(2);
      expect(result.objects.map((o) => o.systemName)).not.toContain('Opportunity');
    });

    it('should detect relationships between objects', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields))
        .mockReturnValueOnce(createMetadataResponse(mockContactFields))
        .mockReturnValueOnce(createMetadataResponse(mockOpportunityFields));

      const result = await generateFireberryERD(client);

      expect(result.relationships.length).toBeGreaterThan(0);
      // Account -> Contact relationship (primarycontactid)
      expect(result.relationships).toContainEqual(
        expect.objectContaining({
          from: 'Account',
          to: 'Contact',
          field: 'primarycontactid',
        }),
      );
      // Contact -> Account relationship (accountid)
      expect(result.relationships).toContainEqual(
        expect.objectContaining({
          from: 'Contact',
          to: 'Account',
          field: 'accountid',
        }),
      );
    });

    it('should include relationship lines in Mermaid output', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0], mockObjects[1]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields))
        .mockReturnValueOnce(createMetadataResponse(mockContactFields));

      const result = await generateFireberryERD(client, { include: [1, 2] });

      // Check for relationship syntax: entity }o--|| entity : "field"
      expect(result.mermaid).toMatch(/\}o--\|\|/);
      expect(result.mermaid).toContain(': "primarycontactid"');
      expect(result.mermaid).toContain(': "accountid"');
    });
  });

  describe('ERD Settings', () => {
    describe('includeFields', () => {
      it('should include fields when true (default)', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFields: true, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('accountname');
        expect(result.mermaid).toContain('statuscode');
      });

      it('should show empty entities when false', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFields: false, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('Account {');
        expect(result.mermaid).toContain('}');
        expect(result.mermaid).not.toContain('accountname');
      });
    });

    describe('showFieldTypes', () => {
      it('should show field types when true (default)', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ showFieldTypes: true, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('text accountname');
        expect(result.mermaid).toContain('dropdown statuscode');
        expect(result.mermaid).toContain('lookup primarycontactid');
        expect(result.mermaid).toContain('number revenue');
        expect(result.mermaid).toContain('date createdon');
      });

      it('should omit field types when false', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ showFieldTypes: false, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).not.toMatch(/\btext\b/);
        expect(result.mermaid).not.toMatch(/\bdropdown\b/);
      });
    });

    describe('onlyRelationshipFields', () => {
      it('should show all fields when false (default)', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ onlyRelationshipFields: false, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('accountname');
        expect(result.mermaid).toContain('statuscode');
        expect(result.mermaid).toContain('primarycontactid');
      });

      it('should only show lookup fields when true', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ onlyRelationshipFields: true, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('primarycontactid');
        expect(result.mermaid).not.toContain('accountname');
        expect(result.mermaid).not.toContain('statuscode');
      });
    });

    describe('maxFieldsPerEntity', () => {
      it('should show all fields when 0 (unlimited)', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ maxFieldsPerEntity: 0, includeFrontmatter: false })
          .generate();

        // Should show all 6 fields
        expect(result.mermaid).toContain('accountid');
        expect(result.mermaid).toContain('accountname');
        expect(result.mermaid).toContain('statuscode');
        expect(result.mermaid).toContain('primarycontactid');
        expect(result.mermaid).toContain('createdon');
        expect(result.mermaid).toContain('revenue');
      });

      it('should limit fields and show indicator when exceeded', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ maxFieldsPerEntity: 3, includeFrontmatter: false })
          .generate();

        // Should show "and X more" indicator
        expect(result.mermaid).toContain('_and_3_more');
      });
    });

    describe('includeFieldLabels', () => {
      it('should not include labels by default', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFieldLabels: false, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).not.toContain('"Account Name"');
      });

      it('should include labels when true', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFieldLabels: true, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('"Account Name"');
        expect(result.mermaid).toContain('"Primary Contact"');
      });
    });

    describe('title', () => {
      it('should use default title when not specified', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFrontmatter: true })
          .generate();

        expect(result.mermaid).toContain('title: Fireberry ERD');
      });

      it('should use custom title when specified', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ title: 'My Custom ERD', includeFrontmatter: true })
          .generate();

        expect(result.mermaid).toContain('title: My Custom ERD');
      });
    });

    describe('includeFrontmatter', () => {
      it('should include frontmatter by default', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFrontmatter: true })
          .generate();

        expect(result.mermaid).toMatch(/^---/);
        expect(result.mermaid).toContain('title:');
      });

      it('should omit frontmatter when false', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ includeFrontmatter: false })
          .generate();

        expect(result.mermaid).not.toMatch(/^---/);
        expect(result.mermaid).toMatch(/^erDiagram/);
      });
    });

    describe('useDisplayNames', () => {
      it('should use system names by default', async () => {
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ useDisplayNames: false, includeFrontmatter: false })
          .generate();

        expect(result.mermaid).toContain('Account {');
      });

      it('should warn when using display names with unicode', async () => {
        const hebrewObject = { objectType: 1, name: 'חשבון', systemName: 'Account' };
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([hebrewObject]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ useDisplayNames: true, includeFrontmatter: false })
          .generate();

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Unicode');
        expect(result.warnings[0]).toContain('Hebrew');
      });

      it('should not warn when using system names', async () => {
        const hebrewObject = { objectType: 1, name: 'חשבון', systemName: 'Account' };
        mockFetch
          .mockReturnValueOnce(createMetadataResponse([hebrewObject]))
          .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

        const result = await erdBuilder(client)
          .include([1])
          .settings({ useDisplayNames: false, includeFrontmatter: false })
          .generate();

        expect(result.warnings).toHaveLength(0);
      });
    });
  });

  describe('Result Structure', () => {
    it('should include objects array with correct structure', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client).include([1]).generate();

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0]).toEqual({
        objectType: 1,
        name: 'Account',
        systemName: 'Account',
        fieldCount: mockAccountFields.length,
      });
    });

    it('should include relationships array with correct structure', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0], mockObjects[1]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields))
        .mockReturnValueOnce(createMetadataResponse(mockContactFields));

      const result = await erdBuilder(client).include([1, 2]).generate();

      expect(result.relationships.length).toBeGreaterThan(0);
      expect(result.relationships[0]).toHaveProperty('from');
      expect(result.relationships[0]).toHaveProperty('to');
      expect(result.relationships[0]).toHaveProperty('field');
      expect(result.relationships[0]).toHaveProperty('cardinality');
    });

    it('should include metadata with generation info', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client).include([1]).generate();

      expect(result.metadata).toHaveProperty('generatedAt');
      expect(result.metadata.totalObjects).toBe(1);
      expect(result.metadata.totalRelationships).toBeDefined();
    });

    it('should include warnings array', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client).include([1]).generate();

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Field Key Indicators', () => {
    it('should mark lookup fields as FK', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client)
        .include([1])
        .settings({ includeFrontmatter: false })
        .generate();

      expect(result.mermaid).toContain('FK');
    });
  });

  describe('Field Sorting', () => {
    it('should sort fields: name field first, then PK, then lookups', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client)
        .include([1])
        .settings({ includeFrontmatter: false, maxFieldsPerEntity: 0 })
        .generate();

      const lines = result.mermaid.split('\n');
      const fieldLines = lines.filter((l) => l.trim().startsWith('text') || l.trim().startsWith('lookup') || l.trim().startsWith('dropdown') || l.trim().startsWith('number') || l.trim().startsWith('date'));

      // accountname should be first (name field), then accountid (PK), then lookups
      const accountnameIndex = fieldLines.findIndex((l) => l.includes('accountname'));
      const accountidIndex = fieldLines.findIndex((l) => l.includes('accountid'));
      const primarycontactidIndex = fieldLines.findIndex((l) => l.includes('primarycontactid'));

      expect(accountnameIndex).toBeLessThan(primarycontactidIndex);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects list', async () => {
      mockFetch.mockReturnValueOnce(createMetadataResponse([]));

      const result = await generateFireberryERD(client);

      expect(result.objects).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
      expect(result.mermaid).toContain('erDiagram');
    });

    it('should handle objects with no fields', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]]))
        .mockReturnValueOnce(createMetadataResponse([]));

      const result = await erdBuilder(client)
        .include([1])
        .settings({ includeFrontmatter: false })
        .generate();

      expect(result.mermaid).toContain('Account {');
      expect(result.mermaid).toContain('}');
    });

    it('should handle relationships to objects not in include list', async () => {
      // Account has lookup to Contact, but Contact is not included
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([mockObjects[0]])) // Only Account
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await erdBuilder(client).include([1]).generate();

      // Should not include relationship to Contact since it's not in the diagram
      expect(result.relationships).toHaveLength(0);
    });

    it('should sanitize special characters in names', async () => {
      const specialObject = { objectType: 999, name: 'Test-Object!', systemName: 'Test-Object_123' };
      const specialFields = [
        { fieldName: 'field-name!', label: 'Field', systemFieldTypeId: 1 },
      ];
      mockFetch
        .mockReturnValueOnce(createMetadataResponse([specialObject]))
        .mockReturnValueOnce(createMetadataResponse(specialFields));

      const result = await generateFireberryERD(client, {
        settings: { includeFrontmatter: false },
      });

      // Should sanitize to valid Mermaid identifiers
      expect(result.mermaid).toContain('Test_Object_123');
      expect(result.mermaid).toContain('field_name_');
    });

    it('should handle string object type IDs', async () => {
      mockFetch
        .mockReturnValueOnce(createMetadataResponse(mockObjects))
        .mockReturnValueOnce(createMetadataResponse(mockAccountFields));

      const result = await generateFireberryERD(client, { include: ['1'] }); // String instead of number

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].systemName).toBe('Account');
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockReturnValueOnce(createMetadataResponse(mockObjects));

      const result = await erdBuilder(client)
        .withSignal(controller.signal)
        .generate();

      expect(result.objects).toHaveLength(0);
    });
  });
});
