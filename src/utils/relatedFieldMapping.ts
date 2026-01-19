/**
 * Related Field Mapping Utilities
 *
 * Functions for parsing and resolving related object field references.
 * Related fields use the pattern: {referenceField}_{relatedField}
 * Example: accountid_telephone1, contactid_fullname, accountid_statuscode
 */

import { OBJECT_ID_MAP } from '../constants/objectIds';
import { FIELD_TYPE_IDS } from '../constants/fieldTypes';
import { getLabelFieldForField } from './fieldMapping';
import type { FireberryField } from '../types/metadata';

/**
 * Reverse mapping from ID field name to object type ID
 * Generated from OBJECT_ID_MAP
 */
export const ID_FIELD_TO_OBJECT_TYPE: Record<string, number> = Object.entries(OBJECT_ID_MAP).reduce(
  (acc, [objectTypeId, idFieldName]) => {
    acc[idFieldName] = parseInt(objectTypeId, 10);
    return acc;
  },
  {} as Record<string, number>,
);

/**
 * Information about a parsed related field
 */
export interface RelatedFieldInfo {
  /** The original field name (e.g., "accountid_telephone1") */
  originalField: string;
  /** The reference/lookup field (e.g., "accountid") */
  referenceField: string;
  /** The field on the related object (e.g., "telephone1") */
  relatedField: string;
  /** The object type ID of the related object (e.g., 1 for Account) */
  relatedObjectType: number;
}

/**
 * Result of resolving a related field with its label field(s)
 */
export interface RelatedFieldResolution {
  /** The original field name */
  originalField: string;
  /** All fields that should be selected/returned */
  fields: string[];
  /** The primary value field */
  valueField: string;
  /** The label/display field (may be same as valueField for non-code fields) */
  labelField: string;
  /** The code field if applicable (for dropdown fields) */
  codeField?: string;
  /** Whether this is a code field (ends with 'code') */
  isCodeField: boolean;
  /** Related object type ID */
  relatedObjectType: number;
  /** Field type from metadata (if available) */
  fieldType?: string;
}

/**
 * Field metadata map type - maps field name to field info
 */
export type FieldMetadataMap = Map<string, FireberryField>;

/**
 * Gets the object type ID from a reference field name
 *
 * @param referenceField - The reference field name (e.g., "accountid", "contactid")
 * @returns The object type ID, or null if not a known reference field
 *
 * @example
 * getObjectTypeFromReferenceField('accountid')  // 1
 * getObjectTypeFromReferenceField('contactid')  // 2
 * getObjectTypeFromReferenceField('leadid')     // 3
 * getObjectTypeFromReferenceField('unknown')    // null
 */
export function getObjectTypeFromReferenceField(referenceField: string): number | null {
  // Check standard mappings
  if (ID_FIELD_TO_OBJECT_TYPE[referenceField]) {
    return ID_FIELD_TO_OBJECT_TYPE[referenceField];
  }

  // Check for custom object pattern: customobject{N}id
  const customMatch = referenceField.match(/^customobject(\d+)id$/);
  if (customMatch) {
    return parseInt(customMatch[1], 10);
  }

  return null;
}

/**
 * Parses a related field name into its components
 *
 * @param fieldName - The field name to parse (e.g., "accountid_telephone1")
 * @returns RelatedFieldInfo if it's a valid related field, null otherwise
 *
 * @example
 * parseRelatedField('accountid_telephone1')
 * // { originalField: 'accountid_telephone1', referenceField: 'accountid',
 * //   relatedField: 'telephone1', relatedObjectType: 1 }
 *
 * parseRelatedField('accountid_statuscode')
 * // { originalField: 'accountid_statuscode', referenceField: 'accountid',
 * //   relatedField: 'statuscode', relatedObjectType: 1 }
 *
 * parseRelatedField('telephone1')  // null (not a related field)
 */
export function parseRelatedField(fieldName: string): RelatedFieldInfo | null {
  // Must contain underscore
  const underscoreIndex = fieldName.indexOf('_');
  if (underscoreIndex === -1) {
    return null;
  }

  // Try to find a valid reference field by checking progressively longer prefixes
  // This handles cases like pcf_accountid_status where we need to find the right split
  const parts = fieldName.split('_');

  // Start from the first part and try combinations
  for (let i = 0; i < parts.length - 1; i++) {
    const potentialRefField = parts.slice(0, i + 1).join('_');
    const objectType = getObjectTypeFromReferenceField(potentialRefField);

    if (objectType !== null) {
      const relatedField = parts.slice(i + 1).join('_');
      if (relatedField) {
        return {
          originalField: fieldName,
          referenceField: potentialRefField,
          relatedField,
          relatedObjectType: objectType,
        };
      }
    }
  }

  return null;
}

/**
 * Determines if a field is a "code" field (stores internal value, has label equivalent)
 *
 * @param fieldName - The field name to check
 * @returns True if the field is a code field
 */
export function isCodeField(fieldName: string): boolean {
  return fieldName.endsWith('code');
}

/**
 * Gets the code field name for a label field
 * For example: status -> statuscode
 *
 * @param labelField - The label field name
 * @returns The code field name
 */
export function getCodeFieldFromLabel(labelField: string): string {
  return `${labelField}code`;
}

/**
 * Gets the label field name for a code field
 * For example: statuscode -> status
 *
 * @param codeField - The code field name
 * @returns The label field name
 */
export function getLabelFieldFromCode(codeField: string): string {
  if (codeField.endsWith('code')) {
    return codeField.slice(0, -4);
  }
  return codeField;
}

/**
 * Checks if a field is a dropdown type based on metadata
 *
 * @param fieldName - The field name to check
 * @param metadata - Field metadata map
 * @returns True if the field is a dropdown type
 */
export function isDropdownFieldByMetadata(
  fieldName: string,
  metadata: FieldMetadataMap,
): boolean {
  const field = metadata.get(fieldName);
  return field?.systemFieldTypeId === FIELD_TYPE_IDS.DROPDOWN;
}

/**
 * Resolver class for related fields that uses metadata to determine field types
 *
 * @example
 * ```typescript
 * // Create resolver with metadata
 * const fields = await client.metadata.getFields('1');
 * const resolver = new RelatedFieldResolver();
 * resolver.setMetadata(1, fields.fields);
 *
 * // Resolve a related field
 * const resolution = resolver.resolve('accountid_statuscode');
 * // Returns both statuscode and status fields for dropdown types
 * ```
 */
export class RelatedFieldResolver {
  private metadataByObjectType: Map<number, FieldMetadataMap> = new Map();

  /**
   * Sets field metadata for an object type
   *
   * @param objectType - The object type ID
   * @param fields - Array of field metadata
   */
  setMetadata(objectType: number, fields: FireberryField[]): void {
    const fieldMap: FieldMetadataMap = new Map();
    for (const field of fields) {
      fieldMap.set(field.fieldName, field);
    }
    this.metadataByObjectType.set(objectType, fieldMap);
  }

  /**
   * Gets field metadata for an object type
   *
   * @param objectType - The object type ID
   * @returns Field metadata map, or undefined if not loaded
   */
  getMetadata(objectType: number): FieldMetadataMap | undefined {
    return this.metadataByObjectType.get(objectType);
  }

  /**
   * Checks if metadata is loaded for an object type
   *
   * @param objectType - The object type ID
   * @returns True if metadata is loaded
   */
  hasMetadata(objectType: number): boolean {
    return this.metadataByObjectType.has(objectType);
  }

  /**
   * Clears all cached metadata
   */
  clearMetadata(): void {
    this.metadataByObjectType.clear();
  }

  /**
   * Resolves a related field into all necessary fields for querying and display
   * Uses metadata to determine if fields are dropdown types that need code/label pairs
   *
   * @param fieldName - The related field name to resolve
   * @param showRealValue - Whether labels are being returned (default: true).
   *   When true, expands dropdown fields to include both code and label.
   *   When false, returns only the requested field (no expansion needed).
   * @returns Resolution with all fields and metadata, or null if not a related field
   *
   * @example
   * // With showRealValue=true (default), dropdown fields get code/label pairs
   * resolver.resolve('accountid_status')
   * // { fields: ['accountid_status', 'accountid_statuscode'], ... }
   *
   * // With showRealValue=false, no expansion
   * resolver.resolve('accountid_status', false)
   * // { fields: ['accountid_status'], ... }
   *
   * // Regular fields stay as-is regardless of showRealValue
   * resolver.resolve('accountid_telephone1')
   * // { fields: ['accountid_telephone1'], ... }
   */
  resolve(fieldName: string, showRealValue: boolean = true): RelatedFieldResolution | null {
    const parsed = parseRelatedField(fieldName);
    if (!parsed) {
      return null;
    }

    const { referenceField, relatedField, relatedObjectType } = parsed;
    const metadata = this.metadataByObjectType.get(relatedObjectType);
    const fieldIsCode = isCodeField(relatedField);
    const fieldMeta = metadata?.get(relatedField);

    // When showRealValue is false, no expansion needed - just return the field as-is
    if (!showRealValue) {
      return {
        originalField: fieldName,
        fields: [fieldName],
        valueField: fieldName,
        labelField: fieldName,
        isCodeField: fieldIsCode,
        relatedObjectType,
        fieldType: fieldMeta?.systemFieldTypeId,
      };
    }

    // For code fields, we want to also get the label
    if (fieldIsCode) {
      const labelOnRelated = getLabelFieldForField(relatedField, relatedObjectType);
      const labelFieldName = labelOnRelated
        ? `${referenceField}_${labelOnRelated}`
        : `${referenceField}_${getLabelFieldFromCode(relatedField)}`;

      // Get field type from metadata for the code field
      const baseField = getLabelFieldFromCode(relatedField);
      const codeFieldMeta = metadata?.get(`${baseField}code`) || metadata?.get(relatedField);

      return {
        originalField: fieldName,
        fields: [fieldName, labelFieldName],
        valueField: fieldName,
        labelField: labelFieldName,
        codeField: fieldName,
        isCodeField: true,
        relatedObjectType,
        fieldType: codeFieldMeta?.systemFieldTypeId,
      };
    }

    // Input is NOT a code field - check if it's a dropdown using metadata
    const potentialCodeField = getCodeFieldFromLabel(relatedField);

    // Check if the code field exists and is a dropdown type
    const codeFieldMeta = metadata?.get(potentialCodeField);
    const isDropdown = codeFieldMeta?.systemFieldTypeId === FIELD_TYPE_IDS.DROPDOWN;

    if (isDropdown) {
      // This is a label field that has a corresponding dropdown code field
      const codeFieldName = `${referenceField}_${potentialCodeField}`;
      return {
        originalField: fieldName,
        fields: [fieldName, codeFieldName],
        valueField: fieldName,
        labelField: fieldName,
        codeField: codeFieldName,
        isCodeField: false,
        relatedObjectType,
        fieldType: codeFieldMeta.systemFieldTypeId,
      };
    }

    // Check if the field itself is a dropdown (for fields that don't follow code pattern)
    const fieldIsDropdown = fieldMeta?.systemFieldTypeId === FIELD_TYPE_IDS.DROPDOWN;

    if (fieldIsDropdown) {
      // The field itself is a dropdown - check if there's a code variant
      const codeFieldName = `${referenceField}_${potentialCodeField}`;
      return {
        originalField: fieldName,
        fields: [fieldName, codeFieldName],
        valueField: fieldName,
        labelField: fieldName,
        codeField: codeFieldName,
        isCodeField: false,
        relatedObjectType,
        fieldType: fieldMeta.systemFieldTypeId,
      };
    }

    // Regular field without code/label pairing
    return {
      originalField: fieldName,
      fields: [fieldName],
      valueField: fieldName,
      labelField: fieldName,
      isCodeField: false,
      relatedObjectType,
      fieldType: fieldMeta?.systemFieldTypeId,
    };
  }

  /**
   * Expands a list of fields to include related field labels/codes
   *
   * @param fields - Array of field names to expand
   * @param showRealValue - Whether labels are being returned (default: true).
   *   When true, expands dropdown fields to include both code and label.
   *   When false, returns fields as-is (no expansion needed).
   * @returns Array of field names with related field expansions
   *
   * @example
   * // With showRealValue=true (default)
   * resolver.expandFields(['accountid_status', 'accountid_telephone1'])
   * // ['accountid_status', 'accountid_statuscode', 'accountid_telephone1']
   *
   * // With showRealValue=false
   * resolver.expandFields(['accountid_status', 'accountid_telephone1'], false)
   * // ['accountid_status', 'accountid_telephone1']
   */
  expandFields(fields: string[], showRealValue: boolean = true): string[] {
    const expanded = new Set<string>();

    for (const field of fields) {
      const resolution = this.resolve(field, showRealValue);
      if (resolution) {
        resolution.fields.forEach((f) => expanded.add(f));
      } else {
        expanded.add(field);
      }
    }

    return Array.from(expanded);
  }
}

/**
 * Resolves a related field without metadata (basic resolution)
 * Only handles code fields, does not detect dropdown types without metadata
 *
 * For full resolution with dropdown detection, use RelatedFieldResolver with metadata
 *
 * @param fieldName - The related field name to resolve
 * @returns Resolution with fields, or null if not a related field
 */
export function resolveRelatedField(fieldName: string): RelatedFieldResolution | null {
  const parsed = parseRelatedField(fieldName);
  if (!parsed) {
    return null;
  }

  const { referenceField, relatedField, relatedObjectType } = parsed;
  const fieldIsCode = isCodeField(relatedField);

  // For code fields, we always add the label
  if (fieldIsCode) {
    const labelOnRelated = getLabelFieldForField(relatedField, relatedObjectType);
    const labelFieldName = labelOnRelated
      ? `${referenceField}_${labelOnRelated}`
      : `${referenceField}_${getLabelFieldFromCode(relatedField)}`;

    return {
      originalField: fieldName,
      fields: [fieldName, labelFieldName],
      valueField: fieldName,
      labelField: labelFieldName,
      codeField: fieldName,
      isCodeField: true,
      relatedObjectType,
    };
  }

  // Without metadata, we can only return the field as-is
  // Use RelatedFieldResolver with metadata for dropdown detection
  return {
    originalField: fieldName,
    fields: [fieldName],
    valueField: fieldName,
    labelField: fieldName,
    isCodeField: false,
    relatedObjectType,
  };
}

/**
 * Expands a list of fields to include related field labels/codes
 * Basic expansion without metadata - only expands code fields
 *
 * For full expansion with dropdown detection, use RelatedFieldResolver with metadata
 *
 * @param fields - Array of field names to expand
 * @returns Array of field names with related field expansions
 */
export function expandRelatedFields(fields: string[]): string[] {
  const expanded = new Set<string>();

  for (const field of fields) {
    const resolution = resolveRelatedField(field);
    if (resolution) {
      resolution.fields.forEach((f) => expanded.add(f));
    } else {
      expanded.add(field);
    }
  }

  return Array.from(expanded);
}

/**
 * Gets all related field information for a field name
 * Combines parsing and basic resolution into a single call
 *
 * @param fieldName - The field name to analyze
 * @returns Combined info with parsing and resolution, or null if not a related field
 */
export function getRelatedFieldInfo(
  fieldName: string,
): (RelatedFieldInfo & RelatedFieldResolution) | null {
  const parsed = parseRelatedField(fieldName);
  if (!parsed) {
    return null;
  }

  const resolved = resolveRelatedField(fieldName);
  if (!resolved) {
    return null;
  }

  return { ...parsed, ...resolved };
}
