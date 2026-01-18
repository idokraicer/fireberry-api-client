/**
 * SDK Adapter for @fireberry/sdk
 *
 * This module provides utilities to enhance the Fireberry SDK with
 * QueryBuilder and field mapping capabilities from fireberry-api-client.
 *
 * @example
 * ```typescript
 * import FireberryClientSDK from '@fireberry/sdk/client';
 * import { createSDKQueryBuilder, EnhancedSDK } from 'fireberry-api-client/sdk';
 *
 * // Option 1: Use query builder factory
 * const sdk = new FireberryClientSDK();
 * await sdk.initializeContext();
 *
 * const queryBuilder = createSDKQueryBuilder(sdk);
 * const results = await queryBuilder(1)
 *   .select('accountid', 'accountname', 'statuscode')
 *   .where('statuscode').equals('1')
 *   .execute();
 *
 * // Option 2: Use enhanced SDK wrapper
 * const enhanced = EnhancedSDK.create(sdk);
 * const results = await enhanced
 *   .query(1)
 *   .select('accountid', 'accountname')
 *   .where('statuscode').equals('1')
 *   .execute();
 * ```
 *
 * @packageDocumentation
 */

import type {
  FireberrySDKClient,
  FireberrySDKAPI,
  SDKQueryPayload,
  SDKResponseData,
  SDKContext,
} from '../types/sdk';
import { QueryBuilder, escapeQueryValue, sanitizeQuery, type ConditionBuilder } from '../utils/queryBuilder';
import { getLabelFieldForField } from '../utils/fieldMapping';
import { getObjectIdFieldName, getNameFieldByObjectType } from '../utils/objectMapping';
import { getExcludedFieldsForStarQuery } from '../constants/excludedFields';
import {
  isDropdownField,
  isLookupField,
  isDropdownOrLookupField,
} from '../utils/fieldTypes';

// Re-export types for convenience
export type {
  FireberrySDKClient,
  FireberrySDKAPI,
  SDKQueryPayload,
  SDKResponseData,
  SDKContext,
} from '../types/sdk';

/**
 * Condition builder that returns SDKQueryBuilder for fluent chaining
 */
interface SDKConditionBuilder {
  equals(value: string | number): SDKQueryBuilder;
  notEquals(value: string | number): SDKQueryBuilder;
  lessThan(value: string | number): SDKQueryBuilder;
  greaterThan(value: string | number): SDKQueryBuilder;
  lessThanOrEqual(value: string | number): SDKQueryBuilder;
  greaterThanOrEqual(value: string | number): SDKQueryBuilder;
  contains(value: string): SDKQueryBuilder;
  notContains(value: string): SDKQueryBuilder;
  startsWith(value: string): SDKQueryBuilder;
  notStartsWith(value: string): SDKQueryBuilder;
  isNull(): SDKQueryBuilder;
  isNotNull(): SDKQueryBuilder;
}

/**
 * SDK-compatible query builder that executes via the Fireberry SDK
 */
export class SDKQueryBuilder {
  private builder: QueryBuilder;
  private objectTypeId: number | string;
  private sdk: FireberrySDKAPI;
  private selectedFields: string[] = [];
  private pageSizeValue?: number;
  private pageNum: number = 1;

  constructor(sdk: FireberrySDKAPI, objectType: number | string) {
    this.sdk = sdk;
    this.objectTypeId = objectType;
    this.builder = new QueryBuilder();
  }

  /**
   * Select fields to return
   * @param fields - Field names to include in results
   */
  select(...fields: string[]): this {
    this.selectedFields.push(...fields);
    return this;
  }

  /**
   * Select fields with their label fields automatically included
   * Useful for dropdown and lookup fields where you want both ID and display value
   * @param fields - Field names to include
   */
  selectWithLabels(...fields: string[]): this {
    const objectType = typeof this.objectTypeId === 'string'
      ? parseInt(this.objectTypeId, 10)
      : this.objectTypeId;

    for (const field of fields) {
      if (!this.selectedFields.includes(field)) {
        this.selectedFields.push(field);
      }
      const labelField = getLabelFieldForField(field, objectType);
      if (labelField && !this.selectedFields.includes(labelField)) {
        this.selectedFields.push(labelField);
      }
    }
    return this;
  }

  /**
   * Start a WHERE condition
   * @param field - Field name to filter on
   */
  where(field: string): SDKConditionBuilder {
    const innerBuilder = this.builder.where(field);
    // Wrap the inner condition builder to return this SDKQueryBuilder
    return {
      equals: (value: string | number) => { innerBuilder.equals(value); return this; },
      notEquals: (value: string | number) => { innerBuilder.notEquals(value); return this; },
      lessThan: (value: string | number) => { innerBuilder.lessThan(value); return this; },
      greaterThan: (value: string | number) => { innerBuilder.greaterThan(value); return this; },
      lessThanOrEqual: (value: string | number) => { innerBuilder.lessThanOrEqual(value); return this; },
      greaterThanOrEqual: (value: string | number) => { innerBuilder.greaterThanOrEqual(value); return this; },
      contains: (value: string) => { innerBuilder.contains(value); return this; },
      notContains: (value: string) => { innerBuilder.notContains(value); return this; },
      startsWith: (value: string) => { innerBuilder.startsWith(value); return this; },
      notStartsWith: (value: string) => { innerBuilder.notStartsWith(value); return this; },
      isNull: () => { innerBuilder.isNull(); return this; },
      isNotNull: () => { innerBuilder.isNotNull(); return this; },
    };
  }

  /**
   * Add AND logical operator
   */
  and(): this {
    this.builder.and();
    return this;
  }

  /**
   * Add OR logical operator
   */
  or(): this {
    this.builder.or();
    return this;
  }

  /**
   * Set page size for pagination
   * @param size - Number of records per page
   */
  pageSize(size: number): this {
    this.pageSizeValue = size;
    return this;
  }

  /**
   * Set page number for pagination
   * @param page - Page number (1-based)
   */
  page(page: number): this {
    this.pageNum = page;
    return this;
  }

  /**
   * Build the query payload without executing
   * Useful if you want to modify the payload before sending
   */
  toQueryPayload(): SDKQueryPayload {
    const payload: SDKQueryPayload = {
      fields: this.selectedFields.length > 0
        ? this.selectedFields.join(',')
        : '*',
      query: this.builder.build(),
    };

    if (this.pageSizeValue !== undefined) {
      payload.page_size = this.pageSizeValue;
    }

    if (this.pageNum > 1) {
      payload.page_number = this.pageNum;
    }

    return payload;
  }

  /**
   * Execute the query via the SDK
   */
  async execute<T = Record<string, unknown>>(): Promise<SDKResponseData<T>> {
    const payload = this.toQueryPayload();
    return this.sdk.query(this.objectTypeId, payload) as Promise<SDKResponseData<T>>;
  }
}

/**
 * Creates a query builder factory bound to a Fireberry SDK instance
 *
 * @param sdk - Fireberry SDK client or API instance
 * @returns Factory function that creates SDKQueryBuilder instances
 *
 * @example
 * ```typescript
 * import FireberryClientSDK from '@fireberry/sdk/client';
 * import { createSDKQueryBuilder } from 'fireberry-api-client/sdk';
 *
 * const sdk = new FireberryClientSDK();
 * await sdk.initializeContext();
 *
 * const queryBuilder = createSDKQueryBuilder(sdk);
 *
 * // Query accounts where status is active
 * const results = await queryBuilder(1) // 1 = Account object type
 *   .select('accountid', 'accountname', 'statuscode', 'status')
 *   .where('statuscode').equals('1')
 *   .pageSize(50)
 *   .execute();
 * ```
 */
export function createSDKQueryBuilder(
  sdk: FireberrySDKClient | FireberrySDKAPI
): (objectType: number | string) => SDKQueryBuilder {
  const api = 'api' in sdk ? sdk.api : sdk;

  return (objectType: number | string) => new SDKQueryBuilder(api, objectType);
}

/**
 * Enhanced SDK wrapper that combines Fireberry SDK with utility functions
 * Provides a more feature-rich API for working with Fireberry data
 */
export class EnhancedSDK<TData = Record<string, unknown>> {
  private sdk: FireberrySDKClient<TData>;

  private constructor(sdk: FireberrySDKClient<TData>) {
    this.sdk = sdk;
  }

  /**
   * Create an EnhancedSDK wrapper around an existing SDK instance
   * The SDK should already be initialized with context
   *
   * @param sdk - Initialized Fireberry SDK client
   */
  static create<T = Record<string, unknown>>(
    sdk: FireberrySDKClient<T>
  ): EnhancedSDK<T> {
    return new EnhancedSDK(sdk);
  }

  /**
   * Get the current context (user and record info)
   */
  get context(): SDKContext | null {
    return this.sdk.context;
  }

  /**
   * Get the underlying SDK API for direct access
   */
  get api(): FireberrySDKAPI<TData> {
    return this.sdk.api;
  }

  /**
   * Get the current user ID from context
   */
  get userId(): string | undefined {
    return this.context?.user?.id;
  }

  /**
   * Get the current user's full name from context
   */
  get userFullName(): string | undefined {
    return this.context?.user?.fullName;
  }

  /**
   * Get the current record ID from context
   */
  get recordId(): string | undefined {
    return this.context?.record?.id;
  }

  /**
   * Get the current record's object type from context
   */
  get recordType(): number | undefined {
    return this.context?.record?.type;
  }

  /**
   * Start building a query for an object type
   *
   * @param objectType - Object type ID (e.g., 1 for Account, 2 for Contact)
   * @returns SDKQueryBuilder for fluent query construction
   *
   * @example
   * ```typescript
   * const results = await enhanced
   *   .query(1)
   *   .select('accountid', 'accountname')
   *   .where('ownerid').equals(enhanced.userId)
   *   .execute();
   * ```
   */
  query(objectType: number | string): SDKQueryBuilder {
    // Cast is safe - SDKQueryBuilder only uses the query method which has the same signature
    return new SDKQueryBuilder(this.sdk.api as FireberrySDKAPI, objectType);
  }

  /**
   * Get the primary key field name for an object type
   *
   * @param objectType - Object type ID
   * @returns Primary key field name (e.g., 'accountid' for type 1)
   *
   * @example
   * ```typescript
   * const idField = enhanced.getIdField(1); // 'accountid'
   * const idField = enhanced.getIdField(2); // 'contactid'
   * ```
   */
  getIdField(objectType: number | string): string {
    return getObjectIdFieldName(objectType);
  }

  /**
   * Get the display name field for an object type
   *
   * @param objectType - Object type ID
   * @returns Name field (e.g., 'accountname' for type 1, 'fullname' for type 2)
   *
   * @example
   * ```typescript
   * const nameField = enhanced.getNameField(1); // 'accountname'
   * const nameField = enhanced.getNameField(2); // 'fullname'
   * ```
   */
  getNameField(objectType: number | string): string {
    return getNameFieldByObjectType(objectType);
  }

  /**
   * Get the label field for a dropdown or lookup field
   *
   * @param fieldName - API field name
   * @param objectType - Object type ID
   * @returns Label field name, or empty string if not applicable
   *
   * @example
   * ```typescript
   * const labelField = enhanced.getLabelField('statuscode', 1); // 'status'
   * const labelField = enhanced.getLabelField('ownerid', 1);    // 'ownername'
   * ```
   */
  getLabelField(fieldName: string, objectType: number | string): string {
    return getLabelFieldForField(fieldName, objectType);
  }

  /**
   * Get fields that should be excluded from * (star) queries for an object type
   * Some fields cause API errors when included in broad queries
   *
   * @param objectType - Object type ID
   * @returns Array of field names to exclude
   */
  getExcludedFields(objectType: number | string): string[] {
    return getExcludedFieldsForStarQuery(objectType);
  }

  /**
   * Expand field list to include label fields for dropdowns and lookups
   *
   * @param fields - Original field list
   * @param objectType - Object type ID
   * @returns Expanded field list with label fields
   *
   * @example
   * ```typescript
   * const fields = enhanced.expandFieldsWithLabels(['statuscode', 'ownerid'], 1);
   * // Returns: ['statuscode', 'status', 'ownerid', 'ownername']
   * ```
   */
  expandFieldsWithLabels(fields: string[], objectType: number | string): string[] {
    const result: string[] = [];
    for (const field of fields) {
      if (!result.includes(field)) {
        result.push(field);
      }
      const labelField = getLabelFieldForField(field, objectType);
      if (labelField && !result.includes(labelField)) {
        result.push(labelField);
      }
    }
    return result;
  }

  /**
   * Create a record
   *
   * @param objectType - Object type ID
   * @param data - Record data
   */
  create<T extends Record<string, unknown>>(
    objectType: number | string,
    data: T
  ): Promise<SDKResponseData<TData>> {
    return this.sdk.api.create(objectType, data);
  }

  /**
   * Update a record
   *
   * @param objectType - Object type ID
   * @param recordId - Record ID to update
   * @param data - Updated field values
   */
  update<T extends Record<string, unknown>>(
    objectType: number | string,
    recordId: string,
    data: T
  ): Promise<SDKResponseData<TData>> {
    return this.sdk.api.update(objectType, recordId, data);
  }

  /**
   * Delete a record
   *
   * @param objectType - Object type ID
   * @param recordId - Record ID to delete
   */
  delete(
    objectType: number | string,
    recordId: string
  ): Promise<SDKResponseData<TData>> {
    return this.sdk.api.delete(objectType, recordId);
  }

  /**
   * Clean up the underlying SDK
   */
  destroy(): void {
    this.sdk.destroy();
  }
}

// Re-export utilities that work standalone with the SDK
export {
  // Query utilities
  QueryBuilder,
  escapeQueryValue,
  sanitizeQuery,
  type ConditionBuilder,
  // Field utilities
  getLabelFieldForField,
  getObjectIdFieldName,
  getNameFieldByObjectType,
  getExcludedFieldsForStarQuery,
  // Type detection
  isDropdownField,
  isLookupField,
  isDropdownOrLookupField,
};

// Re-export constants
export {
  FIELD_TYPE_IDS,
  FIELD_TYPE_MAPPINGS,
  OBJECT_ID_MAP,
  OBJECT_NAME_MAP,
  EXCLUDED_FIELDS_FOR_STAR_QUERY,
} from '../constants';
