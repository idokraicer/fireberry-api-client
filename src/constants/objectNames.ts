/**
 * Object Type ID to Name Field Mapping
 * Maps Fireberry object type IDs to their display name field
 */
export const OBJECT_NAME_MAP: Record<number, string> = {
  1: 'accountname',      // Account
  2: 'fullname',         // Contact
  3: 'fullname',         // Lead
  4: 'name',             // Opportunity
  5: 'title',            // Case
  6: 'subject',          // Activity
  7: 'subject',          // Note
  8: 'name',             // Competitor
  9: 'fullname',         // CRM User
  10: 'subject',         // Task
  13: 'name',            // CRM Order
  14: 'productname',     // Product
  17: 'productname',     // CRM Order Item
  20: 'name',            // Email Template
  23: 'name',            // Business Unit
  27: 'name',            // Print Template
  28: 'name',            // Contract
  33: 'productname',     // Account Product
  46: 'name',            // Project
  67: 'name',            // Campaign
  76: 'title',           // Article
  86: 'name',            // Invoice
  101: 'name',           // Attendance Clock
  102: 'subject',        // Activity Log
  104: 'subject',        // Conversation
  114: 'name',           // Calendar Resource
};

/**
 * Gets the display name field for a given object type
 *
 * @param objectTypeId - The numeric object type ID
 * @returns The name field for the object type
 */
export function getNameFieldByObjectType(objectTypeId: string | number): string {
  const objectTypeNum =
    typeof objectTypeId === 'string' ? parseInt(objectTypeId, 10) : objectTypeId;

  // Check if it's a mapped base object
  if (OBJECT_NAME_MAP[objectTypeNum]) {
    return OBJECT_NAME_MAP[objectTypeNum];
  }

  // For custom objects (1000 and up), use 'name'
  if (objectTypeNum >= 1000) {
    return 'name';
  }

  // Fallback to 'name' for unmapped objects
  return 'name';
}
