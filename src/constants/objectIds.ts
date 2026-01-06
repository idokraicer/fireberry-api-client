/**
 * Object Type ID to Primary Key Field Mapping
 * Maps Fireberry object type IDs to their primary key field names
 */
export const OBJECT_ID_MAP: Record<number, string> = {
  1: 'accountid',
  2: 'contactid',
  3: 'leadid',
  4: 'opportunityid',
  5: 'casesid',
  6: 'activityid',
  7: 'noteid',
  8: 'competitorid',
  9: 'crmuserid',
  10: 'taskid',
  13: 'crmorderid',
  14: 'productid',
  17: 'crmorderitemid',
  20: 'emailtemplateid',
  23: 'businessunitid',
  27: 'printtemplateid',
  28: 'contractid',
  33: 'accountproductid',
  46: 'projectid',
  67: 'campaignid',
  76: 'articleid',
  86: 'invoiceid',
  101: 'attendanceclockid',
  102: 'activitylogid',
  104: 'conversationid',
  114: 'calendarresourceid',
};

/**
 * Gets the primary key field name for a given object type
 *
 * @param objectTypeId - The numeric object type ID
 * @returns The correct ID field name for the object type
 */
export function getObjectIdFieldName(objectTypeId: string | number): string {
  const objectTypeNum =
    typeof objectTypeId === 'string' ? parseInt(objectTypeId, 10) : objectTypeId;

  // Check if it's a mapped base object
  if (OBJECT_ID_MAP[objectTypeNum]) {
    return OBJECT_ID_MAP[objectTypeNum];
  }

  // For custom objects (1000 and up), use the pattern customobjectXid
  if (objectTypeNum >= 1000) {
    return `customobject${objectTypeNum}id`;
  }

  // Fallback to generic 'id' for unmapped objects
  return 'id';
}
