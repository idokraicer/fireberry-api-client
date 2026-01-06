/**
 * Special field name mappings that don't follow standard patterns
 * Key: original field name, Value: corresponding label field
 */
const SPECIAL_LABEL_FIELD_MAPPINGS: Record<string, string> = {
  objectid: 'objecttitle',
  lastactionid: 'lastactiontitle',
  wfruleid: 'rulename', // Object 55 (Workflow Rules)
  noteid: 'subject', // Object 7 (Note) - noteid maps to subject
};

/**
 * Fields ending with "id" that should NOT have "id" replaced with "name"
 * These fields will use the default append "name" behavior instead
 */
const EXCLUDED_ID_FIELDS: string[] = [
  'businessunitid', // → businessunitidname (not businessunitname)
  'crmuserid', // → no name field exists
  'languageid', // → languageidname (not languagename)
];

/**
 * Fields ending with "code" that should NOT have "code" removed
 * These fields will use the default append "name" behavior instead
 */
const EXCLUDED_CODE_FIELDS: string[] = [
  'duplicaterecordcode', // → duplicaterecordcodename (not duplicaterecord)
];

/**
 * Fields that have NO corresponding label field at all
 * These fields should not have any name transformation applied
 * Return empty string to signal "no label field exists"
 */
const FIELDS_WITHOUT_LABEL_FIELD: string[] = [
  'systemfieldid', // Object 73 - no name field exists
  'fieldobjecttype', // Object 73 - base field doesn't exist, only *name exists
  'invoiceid', // Objects 78, 81 - no name field exists
  'calllogid', // Object 100 - no name field exists (primary key)
  'attendanceclockid', // Object 101 - no name field exists (primary key)
  'activitylogid', // Object 102 - no name field exists (primary key)
  'conversationid', // Object 104 - no name field exists (primary key)
  'texttemplateid', // Text Template - no name field exists (primary key)
  'smstemplateid', // Object 110 - no name field exists (primary key)
  'deletedby', // Object 7 - no name field exists
  'recordid', // Object 7 - no name field exists
  'objecttypecode', // Object 7 - no name field exists
];

/**
 * Object-type specific overrides for field name transformations
 * Key: object type ID, Value: { excludedIdFields, excludedCodeFields }
 */
const OBJECT_TYPE_OVERRIDES: Record<
  number,
  { excludedIdFields?: string[]; excludedCodeFields?: string[] }
> = {
  // CRM Orders (13) - uses *idname and *codename patterns
  13: {
    excludedIdFields: ['ownerid', 'accountid', 'printtemplateid', 'pcfaccountid'],
    excludedCodeFields: [
      'rounddiscountcode',
      'taxincludecode',
      'currencycode',
      'transmissioncode',
      'creditrejectioncode1',
      'creditrejectioncode2',
      'apartmentcode1',
      'apartmentcode2',
      'restrictioncode1',
      'restrictioncode2',
      'casescode1',
      'casescode2',
      'returncode1',
      'returncode2',
      'statuscode',
    ],
  },
  // Products (14)
  14: {
    excludedCodeFields: ['categorycode'], // → categoryname (not category)
  },
  // CRM Order Items (17) - uses *idname pattern
  17: {
    excludedIdFields: ['crmorderid', 'productid', 'ownerid'],
  },
  // Email Templates (20)
  20: {
    excludedIdFields: ['mdobjectid'],
  },
  // Print Templates (27)
  27: {
    excludedIdFields: ['mdobjectid'],
  },
  // System Fields (73) - uses *idname pattern
  73: {
    excludedIdFields: ['mdobjectid', 'ownerid'],
  },
  // Invoices (78) - uses *codename and *idname patterns extensively
  78: {
    excludedIdFields: [
      'crmorderid',
      'invoicereceiptid',
      'accountid',
      'ownerid',
      'invoicerenoid',
    ],
    excludedCodeFields: [
      'taxincludecode',
      'depositcode',
      'rounddiscountcode',
      'currencycode',
      'statecode',
      'invoicetypecode',
    ],
  },
  // Invoice No (81) - uses *codename and *idname patterns extensively
  81: {
    excludedIdFields: [
      'ownerid',
      'invoicecreditid',
      'crmorderid',
      'invoicereceiptid',
      'invoicedeliveryid',
      'accountid',
    ],
    excludedCodeFields: ['currencycode', 'rounddiscountcode', 'statecode', 'taxincludecode'],
  },
  // Invoice Draft (82) - uses *codename and *idname patterns extensively
  82: {
    excludedIdFields: ['accountid', 'crmorderid', 'ownerid', 'invoicerenoid'],
    excludedCodeFields: ['taxincludecode', 'statecode', 'rounddiscountcode', 'currencycode'],
  },
  // Invoice Receipt (83) - uses *codename and *idname patterns
  83: {
    excludedIdFields: ['invoicenoid', 'crmorderid', 'ownerid', 'accountid'],
    excludedCodeFields: ['statecode', 'currencycode'],
  },
  // Invoice Tax Receipt (84) - uses *codename and *idname patterns
  84: {
    excludedIdFields: ['crmorderid', 'ownerid', 'invoicecreditid', 'accountid'],
    excludedCodeFields: ['rounddiscountcode', 'statecode', 'taxincludecode', 'currencycode'],
  },
  // Invoice Credit (85) - uses *codename and *idname patterns
  85: {
    excludedIdFields: ['ownerid', 'crmorderid', 'accountid'],
    excludedCodeFields: ['taxincludecode', 'rounddiscountcode', 'currencycode', 'statecode'],
  },
  // Invoice (86) - uses *codename and *idname patterns
  86: {
    excludedIdFields: ['accountid', 'ownerid', 'crmorderid'],
    excludedCodeFields: ['statecode', 'rounddiscountcode', 'currencycode', 'taxincludecode'],
  },
  // Call Log (100) - uses *idname pattern
  100: {
    excludedIdFields: ['contactid', 'leadid', 'accountid', 'ownerid'],
  },
  // Attendance Clock (101) - uses *idname pattern
  101: {
    excludedIdFields: ['ownerid'],
  },
  // Activity Log (102) - uses *idname and *codename patterns
  102: {
    excludedIdFields: ['contactid', 'ownerid'],
    excludedCodeFields: ['objecttypecode', 'typecode', 'resultcode'],
  },
  // Conversation (104) - uses *idname pattern
  104: {
    excludedIdFields: ['leadid', 'ownerid', 'contactid', 'accountid'],
  },
  // Text Template (106) - uses *idname pattern
  106: {
    excludedIdFields: ['ownerid'],
  },
  // SMS Template (110) - uses *idname pattern
  110: {
    excludedIdFields: ['ownerid'],
  },
};

/**
 * Converts a field API name to its corresponding label field.
 *
 * Rules:
 * - Special mappings (e.g., objectid → objecttitle)
 * - Fields starting with "pcf" (custom fields): append "name" → pcf_field → pcf_fieldname
 * - Fields ending with "code" (unless excluded): remove "code" → statuscode → status
 * - Fields ending with "id" (unless excluded): replace "id" with "name" → accountid → accountname
 * - All other fields: append "name"
 *
 * @param fieldName - The field API name
 * @param objectType - The object type ID (required for object-specific overrides)
 * @returns The corresponding label field, or empty string if no label field exists
 */
export function getLabelFieldForField(fieldName: string, objectType: string | number): string {
  // Check special mappings first
  if (SPECIAL_LABEL_FIELD_MAPPINGS[fieldName]) {
    return SPECIAL_LABEL_FIELD_MAPPINGS[fieldName];
  }

  // Check if field has no label field at all - return empty string
  if (FIELDS_WITHOUT_LABEL_FIELD.includes(fieldName)) {
    return '';
  }

  // Check for custom object primary keys (customobject{N}id pattern) → name
  if (/^customobject\d+id$/.test(fieldName)) {
    return 'name';
  }

  // Custom fields (pcf prefix) - just append "name"
  if (fieldName.startsWith('pcf')) {
    return `${fieldName}name`;
  }

  // Get object-type specific overrides
  const objectTypeNum =
    typeof objectType === 'string' ? parseInt(objectType, 10) : objectType;
  const overrides = OBJECT_TYPE_OVERRIDES[objectTypeNum] || null;

  // For custom objects (1000+), add default exclusions
  const isCustomObject = objectTypeNum >= 1000;
  const customObjectExclusions = isCustomObject ? ['ownerid'] : [];

  // Combine global and object-specific exclusions
  const excludedCodeFields = [
    ...EXCLUDED_CODE_FIELDS,
    ...(overrides?.excludedCodeFields || []),
  ];
  const excludedIdFields = [
    ...EXCLUDED_ID_FIELDS,
    ...(overrides?.excludedIdFields || []),
    ...customObjectExclusions,
  ];

  // Remove "code" suffix (unless excluded) → statuscode → status
  if (fieldName.endsWith('code') && !excludedCodeFields.includes(fieldName)) {
    return fieldName.slice(0, -4);
  }

  // Replace "id" suffix with "name" (unless excluded) → accountid → accountname
  if (fieldName.endsWith('id') && !excludedIdFields.includes(fieldName)) {
    return fieldName.slice(0, -2) + 'name';
  }

  // Default: append "name"
  return `${fieldName}name`;
}
