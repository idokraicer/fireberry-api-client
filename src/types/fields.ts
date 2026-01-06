/**
 * Field types supported for creation
 */
export type CreateFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'url'
  | 'phone'
  | 'number'
  | 'date'
  | 'datetime'
  | 'html'
  | 'lookup'
  | 'picklist'
  | 'formula'
  | 'summary';

/**
 * Base options for creating a field
 */
export interface CreateFieldOptionsBase {
  /** Field type */
  type: CreateFieldType;
  /** Field API name (must be unique, should start with 'pcf') */
  fieldName: string;
  /** Display label */
  label: string;
  /** Default value */
  defaultValue?: string;
  /** Track changes */
  follow?: boolean;
  /** Enable auto-complete */
  autoComplete?: boolean;
}

/**
 * Options for text/email/url fields
 */
export interface CreateTextFieldOptions extends CreateFieldOptionsBase {
  type: 'text' | 'email' | 'url';
  /** Maximum length (1-200) */
  maxLength?: number;
}

/**
 * Options for number fields
 */
export interface CreateNumberFieldOptions extends CreateFieldOptionsBase {
  type: 'number';
  /** Decimal precision (0-4) */
  precision?: number;
}

/**
 * Options for lookup fields
 */
export interface CreateLookupFieldOptions extends CreateFieldOptionsBase {
  type: 'lookup';
  /** Related object type ID */
  relatedObjectId: string;
}

/**
 * Picklist value for field creation
 */
export interface PicklistValue {
  name: string;
  value: string;
}

/**
 * Options for picklist fields
 */
export interface CreatePicklistFieldOptions extends CreateFieldOptionsBase {
  type: 'picklist';
  /** Picklist values */
  values: PicklistValue[];
}

/**
 * Summary types
 */
export type SummaryType = 'avg' | 'count' | 'max' | 'min' | 'sum';

/**
 * Options for summary fields
 */
export interface CreateSummaryFieldOptions extends CreateFieldOptionsBase {
  type: 'summary';
  /** Summary calculation type */
  summaryType: SummaryType;
  /** Related object to summarize */
  relatedObjectId: string;
  /** Field to summarize (required for sum, avg, min, max) */
  summaryField?: string;
}

/**
 * Formula result types
 */
export type FormulaFieldType = 'text' | 'number' | 'date' | 'boolean';

/**
 * Options for formula fields
 */
export interface CreateFormulaFieldOptions extends CreateFieldOptionsBase {
  type: 'formula';
  /** Formula expression */
  formula: string;
  /** Output field type */
  formulaFieldType: FormulaFieldType;
  /** Precision for numeric formulas */
  formulaPrecision?: number;
}

/**
 * Options for other simple fields
 */
export interface CreateSimpleFieldOptions extends CreateFieldOptionsBase {
  type: 'textarea' | 'phone' | 'date' | 'datetime' | 'html';
}

/**
 * Union type for all field creation options
 */
export type CreateFieldOptions =
  | CreateTextFieldOptions
  | CreateNumberFieldOptions
  | CreateLookupFieldOptions
  | CreatePicklistFieldOptions
  | CreateSummaryFieldOptions
  | CreateFormulaFieldOptions
  | CreateSimpleFieldOptions;

/**
 * Result of field creation
 */
export interface CreateFieldResult {
  /** Object type ID */
  objectTypeId: string;
  /** Field type */
  fieldType: CreateFieldType;
  /** Created field data */
  fieldData: Record<string, unknown>;
  /** Success flag */
  success: boolean;
}
