/**
 * Object Type ID to Primary Key Field Mapping
 * Maps Fireberry object type IDs to their primary key field names
 * Generated from actual API responses
 */
export const OBJECT_ID_MAP: Record<number, string> = {
  1: 'accountid', // Account
  2: 'contactid', // Contact
  3: 'leadid', // Lead
  4: 'opportunityid', // Opportunity
  5: 'casesid', // Cases
  6: 'activityid', // Activity
  7: 'noteid', // Note
  8: 'competitorid', // Competitor
  9: 'crmuserid', // CrmUser
  10: 'taskid', // Task
  12: 'quoteid', // Quote
  13: 'crmorderid', // CrmOrder
  14: 'productid', // Product
  17: 'crmorderitemid', // CrmOrderItem
  20: 'emailtemplateid', // EmailTemplate
  23: 'businessunitid', // BusinessUnit
  25: 'orgid', // Org
  27: 'printtemplateid', // PrintTemplate
  28: 'contractid', // Contract
  33: 'accountproductid', // AccountProduct
  46: 'projectid', // Project
  55: 'wfruleid', // WFRule
  58: 'mdobjectid', // MDObject
  64: 'roleid', // Role
  67: 'campaignid', // Campaign
  70: 'crmuserloginid', // CrmUserLogin
  73: 'systemfieldid', // SystemField
  76: 'articleid', // Article
  77: 'linkid', // Link
  78: 'invoiceid', // Invoice
  80: 'invoicereceiptitemid', // InvoiceReceiptItem
  81: 'invoiceid', // InvoiceNo
  82: 'invoiceid', // InvoiceDraft
  83: 'invoiceid', // InvoiceReceipt
  84: 'invoiceid', // InvoiceReno
  85: 'invoiceid', // InvoiceCredit
  86: 'invoiceid', // InvoiceDelivery
  89: 'iprestrictionid', // IpRestriction
  90: 'transactionitemid', // TransactionItem
  93: 'chargeid', // Charge
  100: 'calllogid', // calllog
  101: 'attendanceclockid', // AttendanceClock
  102: 'activitylogid', // ActivityLog
  104: 'conversationid', // Conversation
  105: 'teaminboxid', // TeamInbox
  106: 'texttemplateid', // TextTemplate
  107: 'facebookconnectionid', // FacebookConnection
  109: 'auditlogid', // AuditLog
  110: 'smstemplateid', // SMSTemplate
  111: 'providerverificationid', // ProviderVerification
  114: 'calendarresourceid', // CalendarResource
  115: 'journeyid', // Journey
  116: 'profileid', // Profile
  117: 'landingpageid', // LandingPage
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
