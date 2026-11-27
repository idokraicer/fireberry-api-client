import type { FireberryClient } from '../client';
import type {
  GetObjectsResult,
  GetFieldsResult,
  GetFieldValuesResult,
  FireberryObject,
  FireberryField,
  FieldValue,
  LookupRelationError,
} from '../types/metadata';
import { FIELD_TYPE_MAPPINGS, FIELD_TYPE_IDS } from '../constants/fieldTypes';
import { FireberryError, FireberryErrorCode } from '../errors';

/** API endpoints used by MetadataAPI */
const ENDPOINTS = {
  OBJECTS: '/metadata/records',
  FIELDS: (objectType: string) => `/metadata/records/${objectType}/fields`,
  FIELD_VALUES: (objectType: string, fieldName: string) =>
    `/metadata/records/${objectType}/fields/${fieldName}/values`,
  FIELD: (objectType: string, fieldName: string) =>
    `/metadata/records/${objectType}/fields/${encodeURIComponent(fieldName)}`,
} as const;

/** How many lookup-field metadata requests run at once */
const LOOKUP_RELATION_CONCURRENCY = 5;

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

    let lookupRelationErrors: LookupRelationError[] = [];

    // If requested, fetch related object types for lookup fields
    if (opts.includeLookupRelations) {
      const lookupFields = fields.filter(
        (field) => field.systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP,
      );

      if (lookupFields.length > 0) {
        const { relations, errors } = await this.fetchLookupRelations(
          objectTypeStr,
          lookupFields.map((f) => f.fieldName),
          opts.signal,
        );
        lookupRelationErrors = errors;

        // Merge lookup relations into fields
        fields = fields.map((field) => ({
          ...field,
          relatedObjectType: relations.get(field.fieldName),
        }));
      }
    }

    const result: GetFieldsResult = {
      objectTypeId: objectTypeStr,
      fields,
      total: fields.length,
      success: true,
    };

    // A lookup read that failed is reported, and the partial result is not cached,
    // so the next call tries again instead of serving a gap for the cache TTL.
    if (lookupRelationErrors.length > 0) {
      result.lookupRelationErrors = lookupRelationErrors;
      return result;
    }

    // Cache the result
    this.client.setCache('fields', objectTypeStr, result);

    return result;
  }

  /**
   * Fetches the related object type of each lookup field from its field metadata
   * (`GET /metadata/records/{objectType}/fields/{fieldName}` returns `fieldObjectType`).
   * The fields list endpoint does not carry it, so this costs one request per lookup field,
   * run a few at a time; the transport retries 429 responses.
   *
   * A failed read leaves that field without `relatedObjectType` and is returned in `errors`.
   * Cancellation is not swallowed: an aborted signal rejects the whole call.
   */
  private async fetchLookupRelations(
    objectType: string,
    lookupFieldNames: string[],
    signal?: AbortSignal,
  ): Promise<{ relations: Map<string, number>; errors: LookupRelationError[] }> {
    const relations = new Map<string, number>();
    const errors: LookupRelationError[] = [];

    const readOne = async (fieldName: string): Promise<void> => {
      try {
        const response = await this.client.request<{
          success: boolean;
          data?: { fieldObjectType?: string | number | null };
        }>({
          method: 'GET',
          endpoint: ENDPOINTS.FIELD(objectType, fieldName),
          signal,
        });
        const raw = response.data?.fieldObjectType;
        const target = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
        if (Number.isFinite(target)) {
          relations.set(fieldName, target);
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        errors.push({
          fieldName,
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof FireberryError ? error.code : undefined,
        });
      }
    };

    for (let i = 0; i < lookupFieldNames.length; i += LOOKUP_RELATION_CONCURRENCY) {
      await Promise.all(lookupFieldNames.slice(i, i + LOOKUP_RELATION_CONCURRENCY).map(readOne));
    }

    return { relations, errors };
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
