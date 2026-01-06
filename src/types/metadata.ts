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
  /** Related object ID for lookup fields */
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
