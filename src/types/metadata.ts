/**
 * Fireberry object/entity type
 */
export interface FireberryObject {
  /** Object type ID */
  objectType: number;
  /** Display name */
  name: string;
  /** System name (API name) */
  systemName: string;
}

/**
 * Fireberry field metadata
 */
export interface FireberryField {
  /** Field API name */
  fieldName: string;
  /** Field display label */
  label: string;
  /** System field type ID (UUID) */
  systemFieldTypeId: string;
  /** Human-readable field type */
  fieldType?: string;
  /** Whether field is required */
  required?: boolean;
  /** Default value if any */
  defaultValue?: unknown;
  /** Max length for text fields */
  maxLength?: number;
  /** Precision for number fields */
  precision?: number;
  /**
   * Related object type ID for lookup fields.
   * Only populated when getFields is called with includeLookupRelations: true
   */
  relatedObjectType?: number;
  /**
   * @deprecated Use `relatedObjectType` instead. This was never populated by the API.
   */
  relatedObjectId?: string;
}

/**
 * Dropdown/picklist value
 */
export interface FieldValue {
  /** Display name */
  name: string;
  /** Value (usually numeric ID) */
  value: string;
}

/**
 * Result of getObjects operation
 */
export interface GetObjectsResult {
  /** Array of objects */
  objects: FireberryObject[];
  /** Total count */
  total: number;
  /** Success flag */
  success: boolean;
}

/**
 * Result of getFields operation
 */
export interface GetFieldsResult {
  /** Object type ID */
  objectTypeId: string;
  /** Array of fields */
  fields: FireberryField[];
  /** Total count */
  total: number;
  /** Success flag */
  success: boolean;
  /**
   * Lookup fields whose related object type could not be read.
   * Present only when at least one read failed; such results are not cached.
   */
  lookupRelationErrors?: LookupRelationError[];
}

/**
 * A lookup field whose related object type could not be read by getFields
 */
export interface LookupRelationError {
  /** The lookup field name */
  fieldName: string;
  /** Error message from the failed request */
  message: string;
  /** FireberryErrorCode, when the failure was a FireberryError */
  code?: string;
}

/**
 * Result of getFieldValues operation
 */
export interface GetFieldValuesResult {
  /** Object type ID */
  objectTypeId: string;
  /** Field name */
  fieldName: string;
  /** Array of values */
  values: FieldValue[];
  /** Total count */
  total: number;
  /** Success flag */
  success: boolean;
}
