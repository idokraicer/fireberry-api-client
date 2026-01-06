import type { FireberryClient } from '../client';
import type {
  GetObjectsResult,
  GetFieldsResult,
  GetFieldValuesResult,
  FireberryObject,
  FireberryField,
  FieldValue,
} from '../types/metadata';
import { FIELD_TYPE_MAPPINGS } from '../constants/fieldTypes';

/**
 * Metadata API for retrieving Fireberry schema information
 */
export class MetadataAPI {
  constructor(private readonly client: FireberryClient) {}

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
      endpoint: '/metadata/records',
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
   * @param signal - Optional AbortSignal for cancellation
   * @returns List of fields with metadata
   *
   * @example
   * ```typescript
   * const result = await client.metadata.getFields('1');
   * console.log(result.fields); // [{ fieldName: 'accountid', label: 'Account ID', ... }, ...]
   * ```
   */
  async getFields(objectType: string | number, signal?: AbortSignal): Promise<GetFieldsResult> {
    const objectTypeStr = String(objectType);

    // Check cache first
    const cached = this.client.getCached<GetFieldsResult>('fields', objectTypeStr);
    if (cached) {
      return cached;
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
        relatedObjectId?: string;
      }>;
    }>({
      method: 'GET',
      endpoint: `/metadata/records/${objectTypeStr}/fields`,
      signal,
    });

    // Enhance fields with readable field types
    const fields: FireberryField[] = (response.data || []).map((field) => ({
      ...field,
      fieldType: FIELD_TYPE_MAPPINGS[field.systemFieldTypeId] || field.systemFieldTypeId,
    }));

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
      endpoint: `/metadata/records/${objectTypeStr}/fields/${fieldName}/values`,
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
