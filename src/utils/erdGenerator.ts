import type { FireberryClient } from '../client';
import type { FireberryField, FireberryObject } from '../types/metadata';
import { FIELD_TYPE_IDS } from '../constants/fieldTypes';
import { getObjectIdFieldName } from '../constants/objectIds';
import { getNameFieldByObjectType } from '../constants/objectNames';

/**
 * Settings for ERD generation
 */
export interface ERDSettings {
  /** Include field names in entities (default: true) */
  includeFields?: boolean;
  /** Show field types alongside field names (default: true) */
  showFieldTypes?: boolean;
  /** Show only lookup/relationship fields (default: false) */
  onlyRelationshipFields?: boolean;
  /** Maximum fields to show per entity (default: 20, 0 = unlimited) */
  maxFieldsPerEntity?: number;
  /** Include field comments/labels (default: false) */
  includeFieldLabels?: boolean;
  /** Diagram title (default: 'Fireberry ERD') */
  title?: string;
  /**
   * Use display name instead of system name for entities (default: false)
   * Note: Mermaid ERD has limited support for Unicode/Hebrew characters.
   * System names are used by default for reliable rendering.
   */
  useDisplayNames?: boolean;
  /** Include YAML frontmatter with title (default: true) */
  includeFrontmatter?: boolean;
}

/**
 * Result of ERD generation
 */
export interface ERDResult {
  /** Generated Mermaid ERD diagram code */
  mermaid: string;
  /** Objects included in the diagram */
  objects: Array<{
    objectType: number;
    name: string;
    systemName: string;
    fieldCount: number;
  }>;
  /** Relationships found */
  relationships: Array<{
    from: string;
    to: string;
    field: string;
    cardinality: string;
  }>;
  /** Generation metadata */
  metadata: {
    generatedAt: string;
    totalObjects: number;
    totalRelationships: number;
  };
  /** Warnings about the generated diagram */
  warnings: string[];
}

/**
 * Maps Fireberry field types to ERD-friendly type names
 */
function getERDFieldType(field: FireberryField): string {
  const typeId = field.systemFieldTypeId;

  switch (typeId) {
    case FIELD_TYPE_IDS.NUMERIC:
      return 'number';
    case FIELD_TYPE_IDS.DATE:
      return 'date';
    case FIELD_TYPE_IDS.DATETIME:
      return 'datetime';
    case FIELD_TYPE_IDS.DROPDOWN:
      return 'dropdown';
    case FIELD_TYPE_IDS.LOOKUP:
      return 'lookup';
    case FIELD_TYPE_IDS.TEXT:
      return 'text';
    case FIELD_TYPE_IDS.EMAIL:
      return 'email';
    case FIELD_TYPE_IDS.URL:
      return 'url';
    case FIELD_TYPE_IDS.TELEPHONE:
      return 'phone';
    case FIELD_TYPE_IDS.LONG_TEXT:
      return 'textarea';
    case FIELD_TYPE_IDS.HTML:
      return 'html';
    default:
      return 'unknown';
  }
}

/**
 * Sanitizes entity names for Mermaid compatibility
 * For ASCII-only names, removes special chars
 * For names with unicode (Hebrew, etc), wraps in quotes
 */
function sanitizeName(name: string, forceQuote = false): string {
  // Check if name contains non-ASCII characters
  const hasUnicode = /[^\x00-\x7F]/.test(name);

  if (hasUnicode || forceQuote) {
    // Use quoted identifier for unicode/special names
    // Replace quotes in the name to avoid breaking syntax
    const cleaned = name.replace(/"/g, "'").replace(/\n/g, ' ').trim();
    return `"${cleaned}"`;
  }

  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Fluent builder for ERD generation
 *
 * @example
 * ```typescript
 * const client = new FireberryClient({ apiKey: '...' });
 *
 * // Generate ERD for all objects
 * const result = await erdBuilder(client).generate();
 *
 * // Generate ERD for specific objects with settings
 * const result = await erdBuilder(client)
 *   .include([1, 2, 3, 4]) // Account, Contact, Lead, Opportunity
 *   .exclude([1000])
 *   .settings({
 *     includeFields: true,
 *     showFieldTypes: true,
 *     maxFieldsPerEntity: 10,
 *   })
 *   .generate();
 *
 * console.log(result.mermaid);
 * ```
 */
export function erdBuilder(client: FireberryClient): ERDBuilder {
  return new ERDBuilder(client);
}

/**
 * Fluent builder class for ERD generation
 */
export class ERDBuilder {
  private includeList: (string | number)[] | null = null;
  private excludeList: (string | number)[] = [];
  private erdSettings: ERDSettings = {};
  private abortSignal?: AbortSignal;

  constructor(private client: FireberryClient) {}

  /**
   * Include only specific object types
   * @param objectTypes - Array of object type IDs to include (defaults to all if not called)
   */
  include(objectTypes: (string | number)[]): this {
    this.includeList = objectTypes;
    return this;
  }

  /**
   * Exclude specific object types
   * @param objectTypes - Array of object type IDs to exclude
   */
  exclude(objectTypes: (string | number)[]): this {
    this.excludeList = objectTypes;
    return this;
  }

  /**
   * Configure ERD generation settings
   */
  settings(settings: ERDSettings): this {
    this.erdSettings = { ...this.erdSettings, ...settings };
    return this;
  }

  /**
   * Set abort signal for cancellation
   */
  withSignal(signal: AbortSignal): this {
    this.abortSignal = signal;
    return this;
  }

  /**
   * Generate the ERD
   */
  async generate(): Promise<ERDResult> {
    return generateERD(this.client, {
      include: this.includeList,
      exclude: this.excludeList,
      settings: this.erdSettings,
      signal: this.abortSignal,
    });
  }
}

/**
 * Options for ERD generation (internal)
 */
interface ERDGeneratorOptions {
  include?: (string | number)[] | null;
  exclude?: (string | number)[];
  settings?: ERDSettings;
  signal?: AbortSignal;
}

/**
 * Generates a Mermaid ERD diagram from Fireberry metadata
 */
async function generateERD(
  client: FireberryClient,
  options: ERDGeneratorOptions = {},
): Promise<ERDResult> {
  const {
    include,
    exclude = [],
    settings = {},
    signal,
  } = options;

  const {
    includeFields = true,
    showFieldTypes = true,
    onlyRelationshipFields = false,
    maxFieldsPerEntity = 20,
    includeFieldLabels = false,
    title = 'Fireberry ERD',
    useDisplayNames = false,
    includeFrontmatter = true,
  } = settings;

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

  // Create object type to name mapping for relationships
  // Note: objectType from API can be string or number, normalize to number for consistent lookup
  const objectTypeMap = new Map<number, FireberryObject>();
  for (const obj of objectsResult.objects) {
    objectTypeMap.set(Number(obj.objectType), obj);
  }

  // Collect field data and relationships
  const objectFieldsMap = new Map<number, FireberryField[]>();
  const relationships: ERDResult['relationships'] = [];
  const processedObjects: ERDResult['objects'] = [];

  // Fetch fields for all included objects
  for (const obj of objects) {
    if (signal?.aborted) {
      break;
    }

    const fieldsResult = await client.metadata.getFields(String(obj.objectType), {
      includeLookupRelations: true,
      signal,
    });

    objectFieldsMap.set(obj.objectType, fieldsResult.fields);
    processedObjects.push({
      objectType: obj.objectType,
      name: obj.name,
      systemName: obj.systemName,
      fieldCount: fieldsResult.fields.length,
    });

    // Find relationships (lookup fields)
    for (const field of fieldsResult.fields) {
      if (
        field.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP &&
        field.relatedObjectType !== undefined
      ) {
        const targetObject = objectTypeMap.get(field.relatedObjectType);
        if (targetObject) {
          // Check if target is in our included objects
          // Note: objectType can be string or number, relatedObjectType is number
          const targetIncluded = objects.some(
            (o) => Number(o.objectType) === field.relatedObjectType,
          );
          if (targetIncluded) {
            relationships.push({
              from: obj.systemName,
              to: targetObject.systemName,
              field: field.fieldName,
              cardinality: '}o--||', // Many-to-one (lookup)
            });
          }
        }
      }
    }
  }

  // Build Mermaid ERD
  const lines: string[] = [];
  const warnings: string[] = [];

  // Check for Unicode names if useDisplayNames is enabled
  if (useDisplayNames) {
    const unicodeObjects = objects.filter((obj) => /[^\x00-\x7F]/.test(obj.name));
    if (unicodeObjects.length > 0) {
      warnings.push(
        `Mermaid ERD has limited support for Unicode/Hebrew characters. ` +
          `${unicodeObjects.length} object(s) have non-ASCII names which may cause parsing errors. ` +
          `Consider using useDisplayNames: false for reliable rendering.`,
      );
    }
  }

  // Add title and configuration (optional frontmatter)
  if (includeFrontmatter) {
    lines.push('---');
    lines.push(`title: ${title}`);
    lines.push('---');
  }
  lines.push(`erDiagram`);

  // Create a map from systemName to display name for relationships
  const displayNameMap = new Map<string, string>();
  for (const obj of objects) {
    const displayName = useDisplayNames
      ? `${obj.name} - ${obj.systemName}`.replace(/[^a-zA-Z0-9_\u0590-\u05FF\s-]/g, '').trim()
      : obj.systemName;
    displayNameMap.set(obj.systemName, displayName);
  }

  // Add entities
  for (const obj of objects) {
    const fields = objectFieldsMap.get(obj.objectType) || [];
    const entityName = useDisplayNames
      ? sanitizeName(displayNameMap.get(obj.systemName) || obj.systemName)
      : sanitizeName(obj.systemName);

    if (includeFields && fields.length > 0) {
      lines.push(`    ${entityName} {`);

      let fieldsToShow = [...fields];

      // Filter to only relationship fields if requested
      if (onlyRelationshipFields) {
        fieldsToShow = fieldsToShow.filter(
          (f) => f.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP,
        );
      }

      // Get the actual name and PK fields for this object type
      const pkField = getObjectIdFieldName(obj.objectType);
      const nameField = getNameFieldByObjectType(obj.objectType);

      // Sort fields: name field first, then PK, then lookups, then others
      fieldsToShow.sort((a, b) => {
        const aIsName = a.fieldName === nameField;
        const bIsName = b.fieldName === nameField;
        const aIsPK = a.fieldName === pkField;
        const bIsPK = b.fieldName === pkField;
        const aIsLookup = a.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP;
        const bIsLookup = b.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP;

        // Name fields first
        if (aIsName && !bIsName) return -1;
        if (!aIsName && bIsName) return 1;
        // Then PK
        if (aIsPK && !bIsPK) return -1;
        if (!aIsPK && bIsPK) return 1;
        // Then lookups
        if (aIsLookup && !bIsLookup) return -1;
        if (!aIsLookup && bIsLookup) return 1;
        return 0;
      });

      // Limit fields if maxFieldsPerEntity is set
      if (maxFieldsPerEntity > 0 && fieldsToShow.length > maxFieldsPerEntity) {
        fieldsToShow = fieldsToShow.slice(0, maxFieldsPerEntity);
      }

      for (const field of fieldsToShow) {
        const fieldType = showFieldTypes ? getERDFieldType(field) : '';
        const fieldName = sanitizeName(field.fieldName);
        const isPK = field.fieldName.endsWith('id') && fields.indexOf(field) === 0;
        const isFK = field.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP;

        let fieldLine = `        ${fieldType} ${fieldName}`;

        // Add key indicators
        if (isPK) {
          fieldLine += ' PK';
        } else if (isFK) {
          fieldLine += ' FK';
        }

        // Add label as comment if requested
        if (includeFieldLabels && field.label && field.label !== field.fieldName) {
          fieldLine += ` "${field.label}"`;
        }

        lines.push(fieldLine);
      }

      // Add indicator if fields were truncated
      if (maxFieldsPerEntity > 0 && fields.length > maxFieldsPerEntity) {
        const remaining = fields.length - maxFieldsPerEntity;
        lines.push(`        string _and_${remaining}_more "..."`);
      }

      lines.push(`    }`);
    } else {
      // Entity without fields shown
      lines.push(`    ${entityName} {`);
      lines.push(`    }`);
    }
  }

  // Add relationships
  lines.push('');
  for (const rel of relationships) {
    const fromEntity = useDisplayNames
      ? sanitizeName(displayNameMap.get(rel.from) || rel.from)
      : sanitizeName(rel.from);
    const toEntity = useDisplayNames
      ? sanitizeName(displayNameMap.get(rel.to) || rel.to)
      : sanitizeName(rel.to);
    lines.push(`    ${fromEntity} ${rel.cardinality} ${toEntity} : "${rel.field}"`);
  }

  const mermaid = lines.join('\n');

  return {
    mermaid,
    objects: processedObjects,
    relationships,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalObjects: processedObjects.length,
      totalRelationships: relationships.length,
    },
    warnings,
  };
}

/**
 * Direct function to generate ERD (alternative to fluent builder)
 *
 * @example
 * ```typescript
 * const result = await generateFireberryERD(client, {
 *   include: [1, 2, 3],
 *   settings: { includeFields: true, showFieldTypes: true },
 * });
 * ```
 */
export async function generateFireberryERD(
  client: FireberryClient,
  options: {
    include?: (string | number)[];
    exclude?: (string | number)[];
    settings?: ERDSettings;
    signal?: AbortSignal;
  } = {},
): Promise<ERDResult> {
  return generateERD(client, options);
}
