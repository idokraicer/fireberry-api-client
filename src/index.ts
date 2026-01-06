/**
 * Fireberry API Client
 *
 * A standalone, framework-agnostic TypeScript/JavaScript client for the Fireberry CRM API.
 *
 * @example
 * ```typescript
 * import { FireberryClient } from 'fireberry-api-client';
 *
 * const client = new FireberryClient({
 *   apiKey: 'your-api-key',
 * });
 *
 * // Query records
 * const result = await client.query({
 *   objectType: '1',
 *   fields: ['accountid', 'name'],
 *   query: '(statuscode = 1)',
 * });
 *
 * // Use query builder
 * const result = await client.queryBuilder()
 *   .objectType('1')
 *   .select('accountid', 'name')
 *   .where('statuscode').equals('1')
 *   .execute();
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { FireberryClient } from './client';

// Error classes
export {
  FireberryError,
  FireberryErrorCode,
  type FireberryErrorOptions,
} from './errors';

// Query builder
export { QueryBuilder, escapeQueryValue, sanitizeQuery } from './utils/queryBuilder';

// Types - Client
export type {
  FireberryClientConfig,
  RequestOptions,
  CacheControl,
} from './types/client';

// Types - Query
export type {
  QueryOptions,
  QueryResult,
  QueryConditionItem,
  QuerySeparatorItem,
  QueryItem,
  QueryOperator,
} from './types/query';

// Types - Records
export type {
  FireberryRecord,
  CreateOptions,
  UpdateOptions,
  DeleteOptions,
  UpsertOptions,
  UpsertResult,
  BatchCreateOptions,
  BatchUpdateOptions,
  BatchUpdateRecord,
  BatchDeleteOptions,
  BatchResult,
  BatchDeleteResult,
} from './types/records';

// Types - Metadata
export type {
  FireberryObject,
  FireberryField,
  FieldValue,
  GetObjectsResult,
  GetFieldsResult,
  GetFieldValuesResult,
} from './types/metadata';

// Types - Fields
export type {
  CreateFieldType,
  CreateFieldOptionsBase,
  CreateTextFieldOptions,
  CreateNumberFieldOptions,
  CreateLookupFieldOptions,
  PicklistValue,
  CreatePicklistFieldOptions,
  SummaryType,
  CreateSummaryFieldOptions,
  FormulaFieldType,
  CreateFormulaFieldOptions,
  CreateSimpleFieldOptions,
  CreateFieldOptions,
  CreateFieldResult,
} from './types/fields';

// File upload types
export type { FileUploadOptions, FileUploadResult } from './api/files';

// Constants
export {
  FIELD_TYPE_IDS,
  FIELD_TYPE_MAPPINGS,
  OBJECT_ID_MAP,
  OBJECT_NAME_MAP,
  EXCLUDED_FIELDS_FOR_STAR_QUERY,
} from './constants';
