import type { FireberryClient } from '../client';
import type { FireberryField } from '../types/metadata';
import { FIELD_TYPE_IDS } from '../constants/fieldTypes';

/**
 * Options for schema generation
 */
export interface SchemaGeneratorOptions {
  /** Object types to include (defaults to all) */
  include?: (string | number)[];
  /** Object types to exclude */
  exclude?: (string | number)[];
  /** Include JSDoc comments with field labels (default: true) */
  includeComments?: boolean;
  /** Include field type information in comments (default: true) */
  includeFieldTypes?: boolean;
  /** Include related object type info for lookups (default: true) */
  includeLookupInfo?: boolean;
  /** Generate readonly interfaces (default: false) */
  readonly?: boolean;
  /** Prefix for interface names (default: '') */
  prefix?: string;
  /** Suffix for interface names (default: '') */
  suffix?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result of schema generation
 */
export interface SchemaGeneratorResult {
  /** Generated TypeScript code */
  typescript: string;
  /** Objects that were processed */
  objects: Array<{
    objectType: number;
    name: string;
    interfaceName: string;
    fieldCount: number;
  }>;
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    totalObjects: number;
    totalFields: number;
  };
}

/**
 * Maps Fireberry field types to TypeScript types
 */
function getTypeScriptType(field: FireberryField): string {
  const typeId = field.systemFieldTypeId;

  switch (typeId) {
    case FIELD_TYPE_IDS.NUMERIC:
      return 'number';
    case FIELD_TYPE_IDS.DATE:
    case FIELD_TYPE_IDS.DATETIME:
      return 'string'; // Dates are returned as ISO strings
    case FIELD_TYPE_IDS.DROPDOWN:
      return 'string | number'; // Can be value or code
    case FIELD_TYPE_IDS.LOOKUP:
      return 'string'; // GUID reference
    case FIELD_TYPE_IDS.TEXT:
    case FIELD_TYPE_IDS.EMAIL:
    case FIELD_TYPE_IDS.URL:
    case FIELD_TYPE_IDS.TELEPHONE:
    case FIELD_TYPE_IDS.LONG_TEXT:
    case FIELD_TYPE_IDS.HTML:
    default:
      return 'string';
  }
}

/**
 * Converts a system name to a valid TypeScript interface name
 */
function toInterfaceName(name: string, prefix: string, suffix: string): string {
  // Capitalize first letter and ensure valid identifier
  const cleaned = name
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^(\d)/, '_$1'); // Prefix numbers with underscore

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return `${prefix}${capitalized}${suffix}`;
}

/**
 * Generates a JSDoc comment for a field
 */
function generateFieldComment(
  field: FireberryField,
  options: SchemaGeneratorOptions,
): string {
  const parts: string[] = [];

  if (options.includeComments && field.label) {
    parts.push(field.label);
  }

  if (options.includeFieldTypes && field.fieldType) {
    parts.push(`@type ${field.fieldType}`);
  }

  if (options.includeLookupInfo && field.relatedObjectType !== undefined) {
    parts.push(`@relatedObjectType ${field.relatedObjectType}`);
  }

  if (field.required) {
    parts.push('@required');
  }

  if (parts.length === 0) {
    return '';
  }

  if (parts.length === 1) {
    return `  /** ${parts[0]} */\n`;
  }

  return `  /**\n${parts.map((p) => `   * ${p}`).join('\n')}\n   */\n`;
}

/**
 * Generates TypeScript schema from Fireberry metadata
 *
 * @example
 * ```typescript
 * const client = new FireberryClient({ apiKey: '...' });
 *
 * // Generate schema for all objects
 * const result = await generateSchema(client);
 * console.log(result.typescript);
 *
 * // Generate schema for specific objects
 * const result = await generateSchema(client, {
 *   include: [1, 2, 4], // Account, Contact, Opportunity
 *   prefix: 'Fireberry',
 * });
 *
 * // Write to file
 * import fs from 'fs';
 * fs.writeFileSync('./fireberry-types.ts', result.typescript);
 * ```
 */
export async function generateSchema(
  client: FireberryClient,
  options: SchemaGeneratorOptions = {},
): Promise<SchemaGeneratorResult> {
  const {
    include,
    exclude = [],
    includeComments = true,
    includeFieldTypes = true,
    includeLookupInfo = true,
    readonly = false,
    prefix = '',
    suffix = '',
    signal,
  } = options;

  // Get all objects
  const objectsResult = await client.metadata.getObjects(signal);
  let objects = objectsResult.objects;

  // Filter objects based on include/exclude
  const excludeSet = new Set(exclude.map(String));

  if (include && include.length > 0) {
    const includeSet = new Set(include.map(String));
    objects = objects.filter((obj) => includeSet.has(String(obj.objectType)));
  }

  objects = objects.filter((obj) => !excludeSet.has(String(obj.objectType)));

  // Generate TypeScript for each object
  const interfaces: string[] = [];
  const processedObjects: SchemaGeneratorResult['objects'] = [];
  let totalFields = 0;

  for (const obj of objects) {
    if (signal?.aborted) {
      break;
    }

    // Get fields for this object
    const fieldsResult = await client.metadata.getFields(String(obj.objectType), {
      includeLookupRelations: includeLookupInfo,
      signal,
    });

    const interfaceName = toInterfaceName(obj.systemName, prefix, suffix);
    const readonlyPrefix = readonly ? 'readonly ' : '';

    // Build interface
    const lines: string[] = [];
    lines.push(`/**`);
    lines.push(` * ${obj.name} (Object Type: ${obj.objectType})`);
    lines.push(` * System Name: ${obj.systemName}`);
    lines.push(` */`);
    lines.push(`export interface ${interfaceName} {`);

    for (const field of fieldsResult.fields) {
      const comment = generateFieldComment(field, {
        includeComments,
        includeFieldTypes,
        includeLookupInfo,
      });
      const tsType = getTypeScriptType(field);
      const optional = field.required ? '' : '?';

      if (comment) {
        lines.push(comment.trimEnd());
      }
      lines.push(`  ${readonlyPrefix}${field.fieldName}${optional}: ${tsType};`);
    }

    lines.push(`}`);

    interfaces.push(lines.join('\n'));
    processedObjects.push({
      objectType: obj.objectType,
      name: obj.name,
      interfaceName,
      fieldCount: fieldsResult.fields.length,
    });
    totalFields += fieldsResult.fields.length;
  }

  // Build final TypeScript file
  const header = [
    `/**`,
    ` * Fireberry Schema Types`,
    ` * Auto-generated by fireberry-api-client`,
    ` * Generated at: ${new Date().toISOString()}`,
    ` * Total Objects: ${processedObjects.length}`,
    ` * Total Fields: ${totalFields}`,
    ` *`,
    ` * Usage:`,
    ` *   import type { Account, Contact } from './fireberry-schema';`,
    ` *   const accounts = await client.query<Account>({ objectType: '1', ... });`,
    ` */`,
    ``,
    `// eslint-disable-next-line @typescript-eslint/no-unused-vars`,
    `type FireberryRecordBase = Record<string, unknown>;`,
    ``,
  ].join('\n');

  const typescript = header + interfaces.join('\n\n') + '\n';

  return {
    typescript,
    objects: processedObjects,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalObjects: processedObjects.length,
      totalFields,
    },
  };
}

/**
 * Fluent builder for schema generation
 *
 * @example
 * ```typescript
 * const result = await schemaBuilder(client)
 *   .include([1, 2, 4])
 *   .exclude([1000])
 *   .withComments()
 *   .withFieldTypes()
 *   .withPrefix('FB')
 *   .generate();
 * ```
 */
export function schemaBuilder(client: FireberryClient): SchemaBuilder {
  return new SchemaBuilder(client);
}

/**
 * Fluent builder class for schema generation
 */
export class SchemaBuilder {
  private options: SchemaGeneratorOptions = {};

  constructor(private client: FireberryClient) {}

  /**
   * Include only specific object types
   */
  include(objectTypes: (string | number)[]): this {
    this.options.include = objectTypes;
    return this;
  }

  /**
   * Exclude specific object types
   */
  exclude(objectTypes: (string | number)[]): this {
    this.options.exclude = objectTypes;
    return this;
  }

  /**
   * Include JSDoc comments with field labels
   */
  withComments(enabled = true): this {
    this.options.includeComments = enabled;
    return this;
  }

  /**
   * Include field type information in comments
   */
  withFieldTypes(enabled = true): this {
    this.options.includeFieldTypes = enabled;
    return this;
  }

  /**
   * Include lookup relation info in comments
   */
  withLookupInfo(enabled = true): this {
    this.options.includeLookupInfo = enabled;
    return this;
  }

  /**
   * Generate readonly interfaces
   */
  asReadonly(enabled = true): this {
    this.options.readonly = enabled;
    return this;
  }

  /**
   * Add prefix to interface names
   */
  withPrefix(prefix: string): this {
    this.options.prefix = prefix;
    return this;
  }

  /**
   * Add suffix to interface names
   */
  withSuffix(suffix: string): this {
    this.options.suffix = suffix;
    return this;
  }

  /**
   * Set abort signal for cancellation
   */
  withSignal(signal: AbortSignal): this {
    this.options.signal = signal;
    return this;
  }

  /**
   * Generate the TypeScript schema
   */
  async generate(): Promise<SchemaGeneratorResult> {
    return generateSchema(this.client, this.options);
  }
}
