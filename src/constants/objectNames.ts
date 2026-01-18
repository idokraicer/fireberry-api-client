/**
 * Object Type ID to Name Field Mapping
 * Maps Fireberry object type IDs to their display name field
 * Generated from actual API responses
 */
export const OBJECT_NAME_MAP: Record<number, string> = {
  1: 'accountname', // Account
  2: 'fullname', // Contact
  3: 'fullname', // Lead
  4: 'name', // Opportunity
  5: 'title', // Cases
  6: 'subject', // Activity
  7: 'notetext', // Note
  8: 'competitorname', // Competitor
  9: 'fullname', // CrmUser
  10: 'subject', // Task
  12: 'quotenumber', // Quote
  13: 'crmordernumber', // CrmOrder
  14: 'name', // Product
  17: 'productname', // CrmOrderItem
  20: 'title', // EmailTemplate
  23: 'name', // BusinessUnit
  25: 'orgname', // Org
  27: 'name', // PrintTemplate
  28: 'contractname', // Contract
  33: 'productid', // AccountProduct (uses productid as display)
  46: 'projectname', // Project
  55: 'rulename', // WFRule
  58: 'name', // MDObject
  64: 'rolename', // Role
  67: 'campaignname', // Campaign
  70: 'browsername', // CrmUserLogin
  73: 'label', // SystemField (using label as name field)
  76: 'articlename', // Article
  77: 'linkname', // Link
  78: 'invoicenumber', // Invoice
  80: 'documentnumber', // InvoiceReceiptItem
  81: 'invoicenumber', // InvoiceNo
  82: 'invoicenumber', // InvoiceDraft
  83: 'invoicenumber', // InvoiceReceipt
  84: 'invoicenumber', // InvoiceReno
  85: 'invoicenumber', // InvoiceCredit
  86: 'invoicenumber', // InvoiceDelivery
  89: 'name', // IpRestriction
  90: 'documentnumber', // TransactionItem
  93: 'name', // Charge
  100: 'callerid', // calllog
  101: 'name', // AttendanceClock
  102: 'activitylognumber', // ActivityLog
  104: 'subject', // Conversation
  105: 'name', // TeamInbox
  106: 'name', // TextTemplate
  107: 'name', // FacebookConnection
  109: 'name', // AuditLog
  110: 'name', // SMSTemplate
  111: 'name', // ProviderVerification
  114: 'name', // CalendarResource
  115: 'name', // Journey
  116: 'name', // Profile
  117: 'name', // LandingPage
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
