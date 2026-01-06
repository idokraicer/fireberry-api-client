import { FIELD_TYPE_IDS } from '../constants/fieldTypes';

/**
 * Checks if a field is a dropdown type based on its systemFieldTypeId
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns True if the field is a dropdown
 */
export function isDropdownField(systemFieldTypeId: string): boolean {
  return systemFieldTypeId === FIELD_TYPE_IDS.DROPDOWN;
}

/**
 * Checks if a field is a lookup type based on its systemFieldTypeId
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns True if the field is a lookup
 */
export function isLookupField(systemFieldTypeId: string): boolean {
  return systemFieldTypeId === FIELD_TYPE_IDS.LOOKUP;
}

/**
 * Checks if a field is a dropdown or lookup type
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns True if the field is a dropdown or lookup
 */
export function isDropdownOrLookupField(systemFieldTypeId: string): boolean {
  return isDropdownField(systemFieldTypeId) || isLookupField(systemFieldTypeId);
}

/**
 * Checks if a field is a text type
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns True if the field is a text field
 */
export function isTextField(systemFieldTypeId: string): boolean {
  return systemFieldTypeId === FIELD_TYPE_IDS.TEXT;
}

/**
 * Checks if a field is a numeric type
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns True if the field is a numeric field
 */
export function isNumericField(systemFieldTypeId: string): boolean {
  return systemFieldTypeId === FIELD_TYPE_IDS.NUMERIC;
}

/**
 * Checks if a field is a date type (date or datetime)
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns True if the field is a date or datetime field
 */
export function isDateField(systemFieldTypeId: string): boolean {
  return (
    systemFieldTypeId === FIELD_TYPE_IDS.DATE ||
    systemFieldTypeId === FIELD_TYPE_IDS.DATETIME
  );
}

/**
 * Gets the field type name from its system ID
 *
 * @param systemFieldTypeId - The system field type ID from metadata
 * @returns Human-readable field type name, or 'Unknown' if not found
 */
export function getFieldTypeName(systemFieldTypeId: string): string {
  const typeMap: Record<string, string> = {
    [FIELD_TYPE_IDS.DROPDOWN]: 'Dropdown',
    [FIELD_TYPE_IDS.LOOKUP]: 'Lookup',
    [FIELD_TYPE_IDS.EMAIL]: 'Email',
    [FIELD_TYPE_IDS.TEXT]: 'Text',
    [FIELD_TYPE_IDS.URL]: 'URL',
    [FIELD_TYPE_IDS.LONG_TEXT]: 'Long Text',
    [FIELD_TYPE_IDS.DATETIME]: 'DateTime',
    [FIELD_TYPE_IDS.DATE]: 'Date',
    [FIELD_TYPE_IDS.HTML]: 'HTML',
    [FIELD_TYPE_IDS.TELEPHONE]: 'Telephone',
    [FIELD_TYPE_IDS.NUMERIC]: 'Number',
  };
  return typeMap[systemFieldTypeId] || 'Unknown';
}
