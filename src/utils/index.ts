// Object mapping utilities
export { getObjectIdFieldName, getNameFieldByObjectType, OBJECT_ID_MAP, OBJECT_NAME_MAP } from './objectMapping';

// Field mapping utilities
export { getLabelFieldForField } from './fieldMapping';

// Field type utilities
export {
  isDropdownField,
  isLookupField,
  isDropdownOrLookupField,
  isTextField,
  isNumericField,
  isDateField,
  getFieldTypeName,
} from './fieldTypes';

// Helper utilities
export {
  wait,
  chunkArray,
  safeStringValue,
  normalizeFields,
  joinFields,
  isSelectAll,
  deepClone,
  isPlainObject,
} from './helpers';

// Query builder utilities
export {
  QueryBuilder,
  escapeQueryValue,
  sanitizeQuery,
  isPureDate,
  addDays,
  getToday,
  getStartOfWeek,
  getStartOfMonth,
  type ConditionBuilder,
  type DateConditionBuilder,
} from './queryBuilder';

// Schema generator
export {
  generateSchema,
  schemaBuilder,
  SchemaBuilder,
  type SchemaGeneratorOptions,
  type SchemaGeneratorResult,
} from './schemaGenerator';

// ERD generator
export {
  erdBuilder,
  ERDBuilder,
  generateFireberryERD,
  type ERDSettings,
  type ERDResult,
} from './erdGenerator';

// Re-export constants for convenience
export {
  FIELD_TYPE_IDS,
  FIELD_TYPE_MAPPINGS,
  EXCLUDED_FIELDS_FOR_STAR_QUERY,
  isExcludedFromStarQuery,
  getExcludedFieldsForStarQuery,
} from '../constants';
