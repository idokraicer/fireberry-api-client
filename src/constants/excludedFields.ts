/**
 * Fields to exclude from queries when using '*' (all fields) for specific object types
 * These fields cause API errors when queried
 */
export const EXCLUDED_FIELDS_FOR_STAR_QUERY: Record<string, string[]> = {
  '7': ['deletedon', 'deletedby'], // Note object
};

/**
 * Checks if a field should be excluded from star queries for a given object type
 *
 * @param objectType - The object type ID
 * @param fieldName - The field name to check
 * @returns True if the field should be excluded
 */
export function isExcludedFromStarQuery(objectType: string | number, fieldName: string): boolean {
  const objectTypeStr = String(objectType);
  const excludedFields = EXCLUDED_FIELDS_FOR_STAR_QUERY[objectTypeStr];
  return excludedFields ? excludedFields.includes(fieldName) : false;
}

/**
 * Gets the list of excluded fields for a given object type
 *
 * @param objectType - The object type ID
 * @returns Array of field names to exclude, or empty array if none
 */
export function getExcludedFieldsForStarQuery(objectType: string | number): string[] {
  const objectTypeStr = String(objectType);
  return EXCLUDED_FIELDS_FOR_STAR_QUERY[objectTypeStr] || [];
}
