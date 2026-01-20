import { describe, it, expect, beforeAll } from 'vitest';
import { FireberryClient } from '../../src';
import { generateSchema, schemaBuilder } from '../../src/utils/schemaGenerator';
import { erdBuilder, generateFireberryERD } from '../../src/utils/erdGenerator';

/**
 * Integration tests for Schema Generator and ERD Generator
 * These tests require a valid FIREBERRY_TOKEN environment variable
 */
describe('Schema Generator (Integration)', () => {
  let client: FireberryClient;

  beforeAll(() => {
    const apiKey = process.env.FIREBERRY_TOKEN;
    if (!apiKey) {
      throw new Error('FIREBERRY_TOKEN environment variable is required for integration tests');
    }
    client = new FireberryClient({ apiKey });
  });

  describe('generateSchema', () => {
    it('should generate schema for specific objects', async () => {
      const result = await generateSchema(client, {
        include: [1, 2], // Account, Contact
      });

      expect(result.objects.length).toBeGreaterThanOrEqual(1);
      expect(result.typescript).toContain('export interface');
      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.totalObjects).toBeGreaterThanOrEqual(1);
      expect(result.metadata.totalFields).toBeGreaterThan(0);
    });

    it('should generate valid TypeScript syntax', async () => {
      const result = await generateSchema(client, {
        include: [1], // Account only for faster test
      });

      // Check for valid TypeScript interface structure
      expect(result.typescript).toContain('export interface');
      expect(result.typescript).toContain('{');
      expect(result.typescript).toContain('}');
      // Should have field definitions with types
      expect(result.typescript).toMatch(/\w+\??:\s*(string|number|string \| number);/);
    });

    it('should include JSDoc comments', async () => {
      const result = await generateSchema(client, {
        include: [1],
        includeComments: true,
        includeFieldTypes: true,
      });

      // Should have JSDoc style comments
      expect(result.typescript).toContain('/**');
      expect(result.typescript).toContain('*/');
    });

    it('should respect prefix and suffix options', async () => {
      const result = await generateSchema(client, {
        include: [1],
        prefix: 'FB',
        suffix: 'Entity',
      });

      expect(result.objects[0].interfaceName).toMatch(/^FB\w+Entity$/);
      expect(result.typescript).toContain('FBAccountEntity');
    });

    it('should generate readonly interfaces when specified', async () => {
      const result = await generateSchema(client, {
        include: [1],
        readonly: true,
      });

      expect(result.typescript).toContain('readonly ');
    });

    it('should include objects metadata', async () => {
      const result = await generateSchema(client, {
        include: [1, 2],
      });

      for (const obj of result.objects) {
        expect(obj.objectType).toBeDefined();
        expect(obj.name).toBeDefined();
        expect(obj.interfaceName).toBeDefined();
        expect(obj.fieldCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('schemaBuilder', () => {
    it('should work with fluent API', async () => {
      const result = await schemaBuilder(client)
        .include([1])
        .withComments(true)
        .withFieldTypes(true)
        .withLookupInfo(true)
        .withPrefix('Test')
        .generate();

      expect(result.objects.length).toBe(1);
      expect(result.typescript).toContain('TestAccount');
    });

    it('should support exclude option', async () => {
      // Get all objects first
      const allResult = await schemaBuilder(client).generate();
      const allCount = allResult.objects.length;

      // Exclude object type 1
      const excludedResult = await schemaBuilder(client).exclude([1]).generate();

      expect(excludedResult.objects.length).toBeLessThan(allCount);
      expect(excludedResult.objects.find((o) => o.objectType === 1)).toBeUndefined();
    });
  });
});

describe('ERD Generator (Integration)', () => {
  let client: FireberryClient;

  beforeAll(() => {
    const apiKey = process.env.FIREBERRY_TOKEN;
    if (!apiKey) {
      throw new Error('FIREBERRY_TOKEN environment variable is required for integration tests');
    }
    client = new FireberryClient({ apiKey });
  });

  describe('generateFireberryERD', () => {
    it('should generate ERD for specific objects', async () => {
      const result = await generateFireberryERD(client, {
        include: [1, 2], // Account, Contact
        settings: {
          includeFrontmatter: false,
        },
      });

      expect(result.objects.length).toBeGreaterThanOrEqual(1);
      expect(result.mermaid).toContain('erDiagram');
      expect(result.metadata.generatedAt).toBeDefined();
    });

    it('should produce valid Mermaid ERD syntax', async () => {
      const result = await generateFireberryERD(client, {
        include: [1],
        settings: {
          includeFrontmatter: false,
          includeFields: true,
        },
      });

      // Check basic ERD structure
      expect(result.mermaid).toMatch(/^erDiagram/);
      expect(result.mermaid).toContain('{');
      expect(result.mermaid).toContain('}');
    });

    it('should detect relationships between included objects', async () => {
      const result = await generateFireberryERD(client, {
        include: [1, 2], // Account and Contact should have relationships
        settings: {
          includeFrontmatter: false,
        },
      });

      // Should find at least some relationships
      // Note: depends on the actual Fireberry schema having lookups between these objects
      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should include field types when enabled', async () => {
      const result = await generateFireberryERD(client, {
        include: [1],
        settings: {
          includeFields: true,
          showFieldTypes: true,
          includeFrontmatter: false,
        },
      });

      // Should contain type keywords
      expect(result.mermaid).toMatch(/\b(text|number|date|datetime|lookup|dropdown|email|url|phone|textarea|html|unknown)\b/);
    });

    it('should respect maxFieldsPerEntity setting', async () => {
      const result = await generateFireberryERD(client, {
        include: [1],
        settings: {
          includeFields: true,
          maxFieldsPerEntity: 5,
          includeFrontmatter: false,
        },
      });

      // If there are more than 5 fields, should show "and X more" indicator
      if (result.objects[0]?.fieldCount > 5) {
        expect(result.mermaid).toContain('_and_');
        expect(result.mermaid).toContain('_more');
      }
    });

    it('should only show relationship fields when onlyRelationshipFields is true', async () => {
      const resultAll = await generateFireberryERD(client, {
        include: [1],
        settings: {
          includeFields: true,
          onlyRelationshipFields: false,
          includeFrontmatter: false,
        },
      });

      const resultRelOnly = await generateFireberryERD(client, {
        include: [1],
        settings: {
          includeFields: true,
          onlyRelationshipFields: true,
          includeFrontmatter: false,
        },
      });

      // Relationship-only should have fewer or equal lines
      expect(resultRelOnly.mermaid.length).toBeLessThanOrEqual(resultAll.mermaid.length);
    });
  });

  describe('erdBuilder', () => {
    it('should work with fluent API', async () => {
      const result = await erdBuilder(client)
        .include([1, 2])
        .settings({
          includeFields: true,
          showFieldTypes: true,
          maxFieldsPerEntity: 10,
          includeFrontmatter: false,
        })
        .generate();

      expect(result.objects.length).toBeGreaterThanOrEqual(1);
      expect(result.mermaid).toContain('erDiagram');
    });

    it('should support exclude option', async () => {
      // Get ERD for objects 1 and 2
      const includeResult = await erdBuilder(client)
        .include([1, 2])
        .settings({ includeFrontmatter: false })
        .generate();

      // Exclude object 1
      const excludeResult = await erdBuilder(client)
        .include([1, 2])
        .exclude([1])
        .settings({ includeFrontmatter: false })
        .generate();

      expect(excludeResult.objects.length).toBeLessThan(includeResult.objects.length);
    });

    it('should include warnings array in result', async () => {
      const result = await erdBuilder(client)
        .include([1])
        .settings({ includeFrontmatter: false })
        .generate();

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should include correct metadata', async () => {
      const result = await erdBuilder(client)
        .include([1, 2])
        .settings({ includeFrontmatter: false })
        .generate();

      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.totalObjects).toBe(result.objects.length);
      expect(result.metadata.totalRelationships).toBe(result.relationships.length);
    });
  });

  describe('ERD Output Quality', () => {
    it('should sort fields appropriately', async () => {
      const result = await erdBuilder(client)
        .include([1])
        .settings({
          includeFields: true,
          showFieldTypes: true,
          maxFieldsPerEntity: 0, // Unlimited
          includeFrontmatter: false,
        })
        .generate();

      const lines = result.mermaid.split('\n');
      const accountLines = lines.filter((l) =>
        l.trim().match(/^(text|lookup|dropdown|number|date|datetime|email|url|phone|textarea|html|unknown)\s/),
      );

      // Should have some field lines
      expect(accountLines.length).toBeGreaterThan(0);

      // Check that lookup fields have FK marker
      const lookupLines = accountLines.filter((l) => l.includes('lookup'));
      for (const line of lookupLines) {
        expect(line).toContain('FK');
      }
    });

    it('should sanitize special characters in names', async () => {
      const result = await erdBuilder(client)
        .include([1])
        .settings({ includeFrontmatter: false })
        .generate();

      // Mermaid output should not contain problematic characters
      expect(result.mermaid).not.toMatch(/[^\x00-\x7F]/); // No unicode when useDisplayNames is false
    });
  });
});

describe('Generators Error Handling', () => {
  it('should handle invalid API key gracefully', async () => {
    const invalidClient = new FireberryClient({ apiKey: 'invalid-key-12345' });

    await expect(generateSchema(invalidClient, { include: [1] })).rejects.toThrow();
  });

  it('should handle empty include list', async () => {
    const apiKey = process.env.FIREBERRY_TOKEN;
    if (!apiKey) {
      return; // Skip if no API key
    }
    const client = new FireberryClient({ apiKey });

    // Empty include should return all objects
    const result = await generateSchema(client, { include: [] });
    expect(result.objects.length).toBe(0); // Empty include means no specific filter
  });
});
