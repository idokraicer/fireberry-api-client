import type { FireberryClient } from '../client';
import type { CreateFieldOptions, CreateFieldResult } from '../types/fields';

/**
 * Field type to API endpoint mapping
 */
const FIELD_TYPE_ENDPOINTS: Record<string, string> = {
  text: 'text',
  email: 'email',
  url: 'url',
  phone: 'phone',
  number: 'number',
  textarea: 'textarea',
  html: 'html',
  date: 'date',
  datetime: 'datetime',
  lookup: 'lookup',
  summary: 'summary',
  formula: 'formula',
  picklist: 'picklist',
};

/**
 * Fields API for creating custom fields in Fireberry
 */
export class FieldsAPI {
  constructor(private readonly client: FireberryClient) {}

  /**
   * Creates a new custom field in a Fireberry object
   *
   * @param objectType - The object type ID
   * @param options - Field creation options
   * @returns Created field result
   *
   * @example
   * ```typescript
   * // Create a text field
   * const result = await client.fields.create('1', {
   *   type: 'text',
   *   fieldName: 'pcf_custom_field',
   *   label: 'Custom Field',
   *   maxLength: 100,
   * });
   *
   * // Create a picklist field
   * const result = await client.fields.create('1', {
   *   type: 'picklist',
   *   fieldName: 'pcf_status',
   *   label: 'Status',
   *   values: [
   *     { name: 'Active', value: '1' },
   *     { name: 'Inactive', value: '2' },
   *   ],
   * });
   *
   * // Create a lookup field
   * const result = await client.fields.create('2', {
   *   type: 'lookup',
   *   fieldName: 'pcf_related_account',
   *   label: 'Related Account',
   *   relatedObjectId: '1',
   * });
   * ```
   */
  async create(
    objectType: string | number,
    options: CreateFieldOptions,
  ): Promise<CreateFieldResult> {
    const objectTypeStr = String(objectType);
    const { type, fieldName, label, defaultValue, follow, autoComplete } = options;

    // Build field data
    const fieldData: Record<string, unknown> = {
      fieldName,
      label,
    };

    // Add optional common properties
    if (defaultValue !== undefined) {
      fieldData.defaultValue = defaultValue;
    }
    if (follow !== undefined) {
      fieldData.follow = follow;
    }
    if (autoComplete !== undefined && ['text', 'email', 'url', 'phone', 'number'].includes(type)) {
      fieldData.autoComplete = autoComplete;
    }

    // Add field-type specific properties
    switch (type) {
      case 'text':
      case 'email':
      case 'url': {
        const opts = options as { maxLength?: number };
        if (opts.maxLength !== undefined && opts.maxLength > 0) {
          fieldData.maxLength = opts.maxLength;
        }
        break;
      }

      case 'number': {
        const opts = options as { precision?: number };
        if (opts.precision !== undefined) {
          fieldData.precision = opts.precision;
        }
        break;
      }

      case 'lookup': {
        const opts = options as { relatedObjectId: string };
        fieldData.relatedObjectId = opts.relatedObjectId;
        break;
      }

      case 'picklist': {
        const opts = options as { values: Array<{ name: string; value: string }> };
        fieldData.values = opts.values;
        break;
      }

      case 'summary': {
        const opts = options as {
          summaryType: string;
          relatedObjectId: string;
          summaryField?: string;
        };
        fieldData.summaryType = opts.summaryType;
        fieldData.relatedObjectId = opts.relatedObjectId;
        if (opts.summaryField) {
          fieldData.summaryField = opts.summaryField;
        }
        break;
      }

      case 'formula': {
        const opts = options as {
          formula: string;
          formulaFieldType: string;
          formulaPrecision?: number;
        };
        fieldData.formula = opts.formula;
        fieldData.fieldType = opts.formulaFieldType;
        if (opts.formulaFieldType === 'number' && opts.formulaPrecision !== undefined) {
          fieldData.precision = opts.formulaPrecision;
        }
        break;
      }
    }

    // Get the API endpoint for this field type
    const endpoint = FIELD_TYPE_ENDPOINTS[type];
    if (!endpoint) {
      throw new Error(`Unsupported field type: ${type}`);
    }

    const response = await this.client.request<Record<string, unknown>>({
      method: 'POST',
      endpoint: `/api/v2/system-field/${objectTypeStr}/${endpoint}`,
      body: fieldData,
    });

    return {
      objectTypeId: objectTypeStr,
      fieldType: type,
      fieldData: response,
      success: true,
    };
  }
}
