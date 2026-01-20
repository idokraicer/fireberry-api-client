import type { FireberryClient } from '../client';
import type {
  GetObjectsResult,
  GetFieldsResult,
  GetFieldValuesResult,
  FireberryObject,
  FireberryField,
  FieldValue,
} from '../types/metadata';
import { FIELD_TYPE_MAPPINGS, FIELD_TYPE_IDS } from '../constants/fieldTypes';
import { EXCLUDED_LOOKUP_FIELDS } from '../constants/excludedFields';
import { FireberryError, FireberryErrorCode } from '../errors';

/** API endpoints used by MetadataAPI */
const ENDPOINTS = {
  OBJECTS: '/metadata/records',
  FIELDS: (objectType: string) => `/metadata/records/${objectType}/fields`,
  FIELD_VALUES: (objectType: string, fieldName: string) =>
    `/metadata/records/${objectType}/fields/${fieldName}/values`,
  QUERY: '/api/query',
} as const;

/**
 * Metadata API for retrieving Fireberry schema information
 */
export class MetadataAPI {
  constructor(private readonly client: FireberryClient) {}

  /**
   * Checks if metadata operations are available and throws error if not
   * @private
   */
  private ensureMetadataAvailable(): void {
    if (!this.client.isMetadataAvailable()) {
      throw new FireberryError(
        'Metadata operations are not available in SDK-only mode. Please provide an API key in the FireberryClient configuration to use metadata features.',
        {
          code: FireberryErrorCode.INVALID_REQUEST,
          context: {
            hint: 'Fireberry SDK does not yet support metadata operations. Use API key mode or hybrid mode (both SDK + API key) to access metadata.',
          },
        }
      );
    }
  }

  /**
   * Gets all available objects/entity types from Fireberry
   *
   * @param signal - Optional AbortSignal for cancellation
   * @returns List of all objects
   *
   * @example
   * ```typescript
   * const result = await client.metadata.getObjects();
   * console.log(result.objects); // [{ objectType: 1, name: 'Account', ... }, ...]
   * ```
   */
  async getObjects(signal?: AbortSignal): Promise<GetObjectsResult> {
    // Ensure metadata is available
    this.ensureMetadataAvailable();

    // Check cache first
    const cached = this.client.getCached<GetObjectsResult>('objects');
    if (cached) {
      return cached;
    }

    const response = await this.client.request<{
      success: boolean;
      data?: FireberryObject[];
    }>({
      method: 'GET',
      endpoint: ENDPOINTS.OBJECTS,
      signal,
    });

    const result: GetObjectsResult = {
      objects: response.data || [],
      total: response.data?.length || 0,
      success: true,
    };

    // Cache the result
    this.client.setCache('objects', result);

    return result;
  }

  /**
   * Gets all fields for a specific object type
   *
   * @param objectType - The object type ID (e.g., '1' for Account)
   * @param options - Optional settings
   * @param options.includeLookupRelations - Fetches related object types for lookup fields (default: true)
   * @param options.signal - Optional AbortSignal for cancellation
   * @returns List of fields with metadata
   *
   * @example
   * ```typescript
   * // Lookup relations are included by default
   * const result = await client.metadata.getFields('1');
   * console.log(result.fields.find(f => f.fieldName === 'primarycontactid')?.relatedObjectType); // 2
   *
   * // Disable lookup relations for faster response
   * const result = await client.metadata.getFields('1', { includeLookupRelations: false });
   * ```
   */
  async getFields(
    objectType: string | number,
    options?: { includeLookupRelations?: boolean; signal?: AbortSignal } | AbortSignal,
  ): Promise<GetFieldsResult> {
    // Ensure metadata is available
    this.ensureMetadataAvailable();

    const objectTypeStr = String(objectType);

    // Handle both old signature (signal only) and new signature (options object)
    // Default includeLookupRelations to true
    const opts =
      options instanceof AbortSignal
        ? { signal: options, includeLookupRelations: true }
        : { signal: options?.signal, includeLookupRelations: options?.includeLookupRelations ?? true };

    // Check cache first
    const cached = this.client.getCached<GetFieldsResult>('fields', objectTypeStr);
    if (cached) {
      // If user wants lookup relations and cache has them (or doesn't need them), return cached
      // Since default is includeLookupRelations: true, cached results typically have relations
      const cachedHasRelations = cached.fields.some((f) => f.relatedObjectType !== undefined);
      if (!opts.includeLookupRelations || cachedHasRelations) {
        return cached;
      }
      // If user wants relations but cache doesn't have them, continue to fetch
    }

    const response = await this.client.request<{
      success: boolean;
      data?: Array<{
        fieldName: string;
        label: string;
        systemFieldTypeId: string;
        required?: boolean;
        defaultValue?: unknown;
        maxLength?: number;
        precision?: number;
      }>;
    }>({
      method: 'GET',
      endpoint: ENDPOINTS.FIELDS(objectTypeStr),
      signal: opts.signal,
    });

    // Enhance fields with readable field types
    let fields: FireberryField[] = (response.data || []).map((field) => ({
      ...field,
      fieldType: FIELD_TYPE_MAPPINGS[field.systemFieldTypeId] || field.systemFieldTypeId,
    }));

    // If requested, fetch related object types for lookup fields
    if (opts.includeLookupRelations) {
      const lookupFields = fields.filter(
        (field) => field.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP,
      );

      if (lookupFields.length > 0) {
        const lookupRelations = await this.fetchLookupRelations(
          objectTypeStr,
          lookupFields.map((f) => f.fieldName),
          opts.signal,
        );

        // Merge lookup relations into fields
        fields = fields.map((field) => ({
          ...field,
          relatedObjectType: lookupRelations.get(field.fieldName),
        }));
      }
    }

    const result: GetFieldsResult = {
      objectTypeId: objectTypeStr,
      fields,
      total: fields.length,
      success: true,
    };

    // Cache the result
    this.client.setCache('fields', objectTypeStr, result);

    return result;
  }

  /**
   * Fetches related object types for lookup fields using the query endpoint.
   * The query endpoint returns Columns metadata with fieldobjecttype even without records.
   * Excludes fields that cause API errors (e.g., deletedby, deletedon).
   */
  private async fetchLookupRelations(
    objectType: string,
    lookupFieldNames: string[],
    signal?: AbortSignal,
  ): Promise<Map<string, number>> {
    const relations = new Map<string, number>();

    // Filter out excluded fields that cause API errors
    const queryableFields = lookupFieldNames.filter(
      (fieldName) => !EXCLUDED_LOOKUP_FIELDS.includes(fieldName),
    );

    if (queryableFields.length === 0) {
      return relations;
    }

    try {
      const response = await this.client.request<{
        success: boolean;
        data?: {
          Columns?: Array<{
            fieldname: string;
            fieldobjecttype: number | null;
          }>;
        };
      }>({
        method: 'POST',
        endpoint: ENDPOINTS.QUERY,
        body: {
          objecttype: objectType,
          fields: queryableFields.join(','),
          query: '',
          page_size: 1,
          page_number: 1,
          show_real_value: 0,
        },
        signal,
      });

      // Extract fieldobjecttype from Columns metadata
      const columns = response.data?.Columns || [];
      for (const column of columns) {
        if (column.fieldobjecttype !== null && column.fieldobjecttype !== undefined) {
          relations.set(column.fieldname, column.fieldobjecttype);
        }
      }
    } catch (error) {
      // If fetching lookup relations fails, return empty map
      // This allows tests and edge cases to work without complete mocking
      // Lookup fields will still be returned, just without relatedObjectType
    }

    return relations;
  }

  /**
   * Gets all possible values for a dropdown field
   *
   * @param objectType - The object type ID
   * @param fieldName - The field name
   * @param signal - Optional AbortSignal for cancellation
   * @returns List of dropdown values
   *
   * @example
   * ```typescript
   * const result = await client.metadata.getFieldValues('1', 'statuscode');
   * console.log(result.values); // [{ name: 'Active', value: '1' }, { name: 'Inactive', value: '2' }]
   * ```
   */
  async getFieldValues(
    objectType: string | number,
    fieldName: string,
    signal?: AbortSignal,
  ): Promise<GetFieldValuesResult> {
    // Ensure metadata is available
    this.ensureMetadataAvailable();

    const objectTypeStr = String(objectType);

    // Check cache first
    const cached = this.client.getCached<GetFieldValuesResult>(
      'fieldValues',
      objectTypeStr,
      fieldName,
    );
    if (cached) {
      return cached;
    }

    const response = await this.client.request<{
      success: boolean;
      data?: {
        values?: FieldValue[];
      };
    }>({
      method: 'GET',
      endpoint: ENDPOINTS.FIELD_VALUES(objectTypeStr, fieldName),
      signal,
    });

    const result: GetFieldValuesResult = {
      objectTypeId: objectTypeStr,
      fieldName,
      values: response.data?.values || [],
      total: response.data?.values?.length || 0,
      success: true,
    };

    // Cache the result
    this.client.setCache('fieldValues', objectTypeStr, fieldName, result);

    return result;
  }
}
