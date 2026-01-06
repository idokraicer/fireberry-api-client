/**
 * Field Type System IDs from Fireberry CRM
 * These UUIDs identify different field types in the metadata API
 */
export const FIELD_TYPE_IDS = {
  DROPDOWN: 'b4919f2e-2996-48e4-a03c-ba39fb64386c',
  LOOKUP: 'a8fcdf65-91bc-46fd-82f6-1234758345a1',
  EMAIL: 'c713d2f7-8fa9-43c3-8062-f07486eaf567',
  TEXT: 'a1e7ed6f-5083-477b-b44c-9943a6181359',
  URL: 'c820d32f-44df-4c2a-9c1e-18734e864fd5',
  LONG_TEXT: '80108f9d-1e75-40fa-9fa9-02be4ddc1da1',
  DATETIME: 'ce972d02-5013-46d4-9d1d-f09df1ac346a',
  DATE: '83bf530c-e04c-462b-9ffc-a46f750fc072',
  HTML: 'ed2ad39d-32fc-4585-8f5b-2e93463f050a',
  TELEPHONE: '3f62f67a-1cee-403a-bec6-aa02a9804edb',
  NUMERIC: '6a34bfe3-fece-4da1-9136-a7b1e5ae3319',
} as const;

/**
 * Human-readable mappings for field types
 * Used for display purposes
 */
export const FIELD_TYPE_MAPPINGS: Record<string, string> = {
  [FIELD_TYPE_IDS.DROPDOWN]: 'Dropdown',
  [FIELD_TYPE_IDS.EMAIL]: 'Email',
  [FIELD_TYPE_IDS.TEXT]: 'Text',
  [FIELD_TYPE_IDS.LOOKUP]: 'Lookup',
  [FIELD_TYPE_IDS.URL]: 'URL',
  [FIELD_TYPE_IDS.LONG_TEXT]: 'Long Text',
  [FIELD_TYPE_IDS.DATETIME]: 'DateTime',
  [FIELD_TYPE_IDS.DATE]: 'Date',
  [FIELD_TYPE_IDS.HTML]: 'HTML',
  [FIELD_TYPE_IDS.TELEPHONE]: 'Telephone',
  [FIELD_TYPE_IDS.NUMERIC]: 'Number',
};
