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

// Related field utilities
export {
  RelatedFieldResolver,
  parseRelatedField,
  resolveRelatedField,
  expandRelatedFields,
  getRelatedFieldInfo,
  getObjectTypeFromReferenceField,
  ID_FIELD_TO_OBJECT_TYPE,
} from './utils/relatedFieldMapping';
export type { RelatedFieldInfo, RelatedFieldResolution, FieldMetadataMap } from './utils/relatedFieldMapping';

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
  QueryExplainResult,
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

// Transport types
export type {
  Transport,
  TransportRequestOptions,
  HTTPTransportConfig,
  SDKTransportConfig,
  TransportConfig,
} from './types/transport';
export { isHTTPTransportConfig, isSDKTransportConfig } from './types/transport';

// SDK types (for SDK mode usage)
export type {
  FireberrySDKClient,
  FireberrySDKAPI,
  SDKQueryPayload,
  SDKResponseData,
  SDKContext,
} from './types/sdk';

// Constants
export {
  FIELD_TYPE_IDS,
  FIELD_TYPE_MAPPINGS,
  OBJECT_ID_MAP,
  OBJECT_NAME_MAP,
  EXCLUDED_FIELDS_FOR_STAR_QUERY,
} from './constants';

