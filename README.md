# fireberry-api-client

A standalone, framework-agnostic TypeScript/JavaScript client for the Fireberry CRM API.

## Features

- Full TypeScript support with comprehensive type definitions
- Zero runtime dependencies (uses native `fetch`)
- Supports both ESM and CommonJS
- Automatic retry on rate limits (429)
- Optional metadata and query result caching
- Smart cache invalidation on mutations (auto-clears query cache when records are modified)
- Request deduplication (concurrent identical queries share a single API call)
- Parallel query execution with `queryAll()`
- Cursor-based pagination with async iterators
- Lookup field relationship detection
- Fluent QueryBuilder API with date helpers and debugging
- Query explain/dry-run for analyzing queries before execution
- Batch operations with auto-chunking
- Schema generator for TypeScript types from live API metadata
- ERD generator for Mermaid diagrams
- AbortController support for cancellation

## Installation

```bash
npm install fireberry-api-client@latest
```

**Requirements:** Node.js 18+

### Import Paths

```typescript
// Main export
import { FireberryClient } from 'fireberry-api-client';

// Utilities export
import { getObjectIdFieldName } from 'fireberry-api-client/utils';

// SDK adapter
import { createSDKQueryBuilder } from 'fireberry-api-client/sdk';
```

## Quick Start

```typescript
import { FireberryClient } from 'fireberry-api-client';

const client = new FireberryClient({
  apiKey: 'your-api-key',
});

// Query records
const accounts = await client.query({
  objectType: '1', // Account
  fields: ['accountid', 'accountname', 'statuscode'],
  limit: 10,
});

console.log(accounts.records);
```

## API Reference

### Client Configuration

```typescript
const client = new FireberryClient({
  apiKey: 'your-api-key',        // Required
  baseUrl: 'https://api.fireberry.com', // Optional, default shown
  timeout: 30000,                // Optional, request timeout in ms
  retryOn429: true,              // Optional, auto-retry on rate limit
  maxRetries: 120,               // Optional, max retry attempts
  retryDelay: 1000,              // Optional, delay between retries in ms
  cacheMetadata: false,          // Optional, enable metadata caching
  cacheTTL: 300000,              // Optional, metadata cache TTL in ms (5 min default)
  cacheQueryResults: false,      // Optional, enable query result caching
  queryResultCacheTTL: 60000,    // Optional, query cache TTL in ms (1 min default)
  invalidateCacheOnMutation: true, // Optional, auto-clear query cache on create/update/delete (default: true)
});
```

### Query Records

```typescript
// Simple query - fields as array
const result = await client.query({
  objectType: '1',
  fields: ['accountid', 'accountname'],
  query: '(statuscode = 1)',
  sortBy: 'modifiedon',
  sortType: 'desc',
  limit: 100,
});

// Fields as comma-separated string
const result = await client.query({
  objectType: '1',
  fields: 'accountid,accountname,statuscode',
  limit: 100,
});

// Query all records (auto-pagination enabled by default)
const result = await client.query({
  objectType: '1',
  fields: '*',
});

// Manual pagination (disable auto-pagination)
const page1 = await client.query({
  objectType: '1',
  fields: '*',
  autoPage: false,
  page: 1,
  pageSize: 500, // default: 500, max: 500
});
```

### QueryBuilder (Fluent API)

```typescript
const result = await client.queryBuilder()
  .objectType('1')
  .select('accountid', 'accountname', 'emailaddress1')
  .where('statuscode').equals('1')
  .and()
  .where('accountname').contains('Acme')
  .sortBy('modifiedon', 'desc')
  .limit(50)
  .execute();

// Query by ID - automatically uses correct field name for object type
const account = await client.queryBuilder()
  .objectType(1)
  .whereId('abc123')  // Uses 'accountid' automatically
  .execute();

// Query multiple IDs with OR
const accounts = await client.queryBuilder()
  .objectType(1)
  .whereIds(['id1', 'id2', 'id3'])  // (accountid = id1) or (accountid = id2) or (accountid = id3)
  .execute();

// Works with any object type
const contact = await client.queryBuilder()
  .objectType(2)
  .whereId('xyz789')  // Uses 'contactid' automatically
  .execute();

// Available conditions:
// .whereId(value)        - Query by primary ID (auto-mapped field)
// .whereIds([...])       - Query multiple IDs with OR (auto-mapped field)
// .equals(value)         - Exact match
// .notEquals(value)      - Not equal
// .lessThan(value)       - Less than
// .greaterThan(value)    - Greater than
// .lessThanOrEqual(value) - Less than or equal (see date note below)
// .greaterThanOrEqual(value) - Greater than or equal
// .contains(value)       - Contains (translates to start-with %value)
// .notContains(value)    - Does not contain
// .startsWith(value)     - Starts with
// .notStartsWith(value)  - Does not start with
// .isNull()              - Field is null
// .isNotNull()           - Field is not null

// Date handling:
// Pure dates (YYYY-MM-DD) are auto-converted for lessThanOrEqual
// Example: .lessThanOrEqual('2024-01-15') becomes < 2024-01-16
// This ensures records from Jan 15 are included (API quirk workaround)
```

### QueryBuilder: Additional Methods

```typescript
// whereIn - query with multiple values (OR'd together)
const accounts = await client.queryBuilder()
  .objectType(1)
  .whereIn('statuscode', [1, 2, 3])  // (statuscode = 1) or (statuscode = 2) or (statuscode = 3)
  .execute();

// first() - return single record or null
const account = await client.queryBuilder()
  .objectType(1)
  .where('accountname').equals('Acme Corp')
  .first();  // Returns Record<string, unknown> | null

// count() - get total count without fetching records
const total = await client.queryBuilder()
  .objectType(1)
  .where('statuscode').equals('1')
  .count();  // Returns number
```

### QueryBuilder: Date Helpers

```typescript
// Query records from today
const todaysRecords = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').today()
  .execute();

// Query records from this week
const thisWeeksRecords = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').thisWeek()
  .execute();

// Query records from this month
const thisMonthsRecords = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').thisMonth()
  .execute();

// Query records from N days ago
const last7Days = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').daysAgo(7)
  .execute();

// Query records between two dates
const dateRange = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').between('2024-01-01', '2024-01-31')
  .execute();

// Query records before/after a date
const beforeDate = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').before('2024-06-01')
  .execute();

const afterDate = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').after('2024-01-01')
  .execute();

// On or before/after (correctly handles API date quirks)
const onOrBefore = await client.queryBuilder()
  .objectType(1)
  .whereDate('createdon').onOrBefore('2024-06-30')
  .execute();
```

### QueryBuilder: Debugging

```typescript
// Get query result with metadata for debugging
const result = await client.queryBuilder()
  .objectType(1)
  .select('accountid', 'accountname')
  .where('statuscode').equals('1')
  .limit(50)
  .executeWithDebug();

console.log(result.metadata);
// {
//   objectType: '1',
//   fields: ['accountid', 'accountname'],
//   queryString: '(statuscode = 1)',
//   pageNumber: 1,
//   pageSize: 500,
//   autoPage: true,
//   sortBy: 'modifiedon',
//   sortType: 'desc',
//   limit: 50,
//   executionTimeMs: 234
// }
```

### QueryBuilder: Explain (Dry Run)

Analyze a query without executing it to understand its behavior and get optimization suggestions:

```typescript
const explanation = client.queryBuilder()
  .objectType(1)
  .select('*')
  .where('statuscode').equals('1')
  .limit(100)
  .explain();

console.log(explanation);
// {
//   objectType: '1',
//   query: '(statuscode = 1)',
//   fields: ['*'],
//   usesWildcard: true,
//   willAutoPage: true,
//   limit: 100,
//   pageSize: 500,
//   sorting: { field: 'modifiedon', direction: 'desc' },
//   estimatedApiCalls: 1,
//   conditionCount: 1,
//   showRealValue: false,
//   warnings: ['Using wildcard (*) fields - consider specifying exact fields for better performance'],
//   suggestions: ['Specify exact fields instead of * to reduce payload size']
// }

// Use explain to validate queries before execution
if (explanation.warnings.length > 0) {
  console.warn('Query warnings:', explanation.warnings);
}
```

### Parallel Query Execution

Execute multiple queries in parallel with concurrency control:

```typescript
const results = await client.queryAll([
  { objectType: '1', fields: ['accountid', 'accountname'] },
  { objectType: '2', fields: ['contactid', 'fullname'] },
  { objectType: '4', fields: ['opportunityid', 'name'] },
], {
  concurrency: 5,  // Optional, max parallel requests (default: 5)
});

// Results are returned in the same order as input queries
console.log(results[0].records);  // Accounts
console.log(results[1].records);  // Contacts
console.log(results[2].records);  // Opportunities
```

### Streaming / Cursor-Based Pagination

Process large datasets without loading everything into memory:

```typescript
// Process records in batches using async iterator
for await (const batch of client.queryStream({
  objectType: '1',
  fields: ['accountid', 'accountname'],
  pageSize: 100,
})) {
  console.log(`Processing ${batch.records.length} records (page ${batch.page})...`);
  for (const record of batch.records) {
    // Process each record
  }
}

// Collect all records from stream
const allRecords: Record<string, unknown>[] = [];
for await (const batch of client.queryStream({ objectType: '1', fields: '*' })) {
  allRecords.push(...batch.records);
}

// With limit
for await (const batch of client.queryStream({
  objectType: '1',
  fields: '*',
  limit: 1000,  // Stop after 1000 records
})) {
  // Process batch
}
```

### CRUD Operations

```typescript
// Create
const created = await client.records.create('1', {
  accountname: 'New Account',
  emailaddress1: 'contact@example.com',
});

// Update
const updated = await client.records.update('1', 'record-id', {
  accountname: 'Updated Name',
});

// Delete
await client.records.delete('1', 'record-id');

// Upsert (create if not exists, update if exists)
const result = await client.records.upsert('1', ['emailaddress1'], {
  accountname: 'Acme Corp',
  emailaddress1: 'contact@acme.com',
});
console.log(result.operationType); // 'create' or 'update'
```

### Batch Operations

Batch operations automatically chunk large datasets into API-compatible batches of 20.

```typescript
// Batch create
const result = await client.batch.create('1', [
  { accountname: 'Account 1' },
  { accountname: 'Account 2' },
  { accountname: 'Account 3' },
]);

// Batch update
await client.batch.update('1', [
  { id: 'id-1', record: { accountname: 'Updated 1' } },
  { id: 'id-2', record: { accountname: 'Updated 2' } },
]);

// Batch delete
await client.batch.delete('1', ['id-1', 'id-2', 'id-3']);
```

### Metadata

```typescript
// Get all objects
const objects = await client.metadata.getObjects();

// Get fields for an object (includes lookup relationships by default)
const fields = await client.metadata.getFields('1');

// Find which object a lookup field references
const primaryContact = fields.fields.find(f => f.fieldName === 'primarycontactid');
console.log(primaryContact?.relatedObjectType); // 2 (Contact)

// Disable lookup relations for faster response (skips additional API call)
const fieldsOnly = await client.metadata.getFields('1', { includeLookupRelations: false });

// Get dropdown values
const values = await client.metadata.getFieldValues('1', 'statuscode');
```

### Caching

```typescript
const client = new FireberryClient({
  apiKey: 'your-api-key',
  cacheMetadata: true,
  cacheTTL: 300000,           // Metadata cache: 5 minutes
  cacheQueryResults: true,
  queryResultCacheTTL: 60000, // Query cache: 1 minute
});

// Metadata calls are cached
await client.metadata.getFields('1'); // Hits API
await client.metadata.getFields('1'); // Uses cache

// Query results are cached (when cacheQueryResults is enabled)
await client.query({ objectType: '1', fields: '*' }); // Hits API
await client.query({ objectType: '1', fields: '*' }); // Uses cache

// Request deduplication (always active)
// Concurrent identical queries share a single API call
const [result1, result2] = await Promise.all([
  client.query({ objectType: '1', fields: '*' }),  // Makes API call
  client.query({ objectType: '1', fields: '*' }),  // Shares same promise
]);

// Manual cache control
client.cache.clear();                           // Clear all cache
client.cache.clearFields('1');                  // Clear fields for object 1
client.cache.clearFieldValues('1', 'statuscode'); // Clear specific field values
client.cache.clearQueryResults();               // Clear all query result cache
client.cache.clearQueryResultsForObject('1');   // Clear query cache for object 1
```

### Custom API Calls

```typescript
const response = await client.request({
  method: 'POST',
  endpoint: '/api/custom',
  body: { data: 'value' },
  headers: { 'X-Custom': 'header' },
});
```

### AbortController Support

```typescript
const controller = new AbortController();

// Start query
const promise = client.query({
  objectType: '1',
  fields: '*',
  signal: controller.signal,
});

// Cancel if needed
controller.abort();
```

## SDK Adapter (for @fireberry/sdk)

If you're building embedded Fireberry widgets/plugins using `@fireberry/sdk`, you can use this library's utilities with the SDK adapter:

```typescript
import FireberryClientSDK from '@fireberry/sdk/client';
import { createSDKQueryBuilder, EnhancedSDK } from 'fireberry-api-client/sdk';

// Initialize Fireberry SDK (runs in iframe)
const sdk = new FireberryClientSDK();
await sdk.initializeContext();
```

### Option 1: Query Builder Factory

```typescript
import { createSDKQueryBuilder } from 'fireberry-api-client/sdk';

const queryBuilder = createSDKQueryBuilder(sdk);

// Build and execute queries with fluent API
const results = await queryBuilder(1) // 1 = Account
  .select('accountid', 'accountname', 'statuscode')
  .selectWithLabels('ownerid') // Auto-adds 'ownername'
  .where('statuscode').equals('1')
  .pageSize(50)
  .execute();
```

### Option 2: Enhanced SDK Wrapper

```typescript
import { EnhancedSDK } from 'fireberry-api-client/sdk';

const enhanced = EnhancedSDK.create(sdk);

// Access context easily
console.log('Current user:', enhanced.userId, enhanced.userFullName);
console.log('Current record:', enhanced.recordId, enhanced.recordType);

// Query with utilities
const results = await enhanced
  .query(1)
  .select('accountid', 'accountname')
  .where('ownerid').equals(enhanced.userId!)
  .execute();

// Use field utilities
const idField = enhanced.getIdField(1);      // 'accountid'
const nameField = enhanced.getNameField(2);  // 'fullname'
const labelField = enhanced.getLabelField('statuscode', 1); // 'status'

// Expand fields with their labels
const fields = enhanced.expandFieldsWithLabels(['statuscode', 'ownerid'], 1);
// ['statuscode', 'status', 'ownerid', 'ownername']

// CRUD operations
await enhanced.create(1, { accountname: 'New Account' });
await enhanced.update(1, 'record-id', { accountname: 'Updated' });
await enhanced.delete(1, 'record-id');
```

### Option 3: Use QueryBuilder Directly

```typescript
import { QueryBuilder } from 'fireberry-api-client';

// Build query and convert to SDK-compatible payload
const payload = new QueryBuilder()
  .select('accountid', 'accountname')
  .where('statuscode').equals('1')
  .limit(50)
  .toSDKPayload();

// Execute with SDK
const results = await sdk.api.query(1, payload);
```

## Utility Functions

Utility functions are available as a separate export:

```typescript
import {
  getObjectIdFieldName,
  getNameFieldByObjectType,
  getLabelFieldForField,
  isDropdownField,
  isLookupField,
  chunkArray,
  normalizeFields,
} from 'fireberry-api-client/utils';

// Get primary key field name
getObjectIdFieldName('1');      // 'accountid'
getObjectIdFieldName('1000');   // 'customobject1000id'

// Get display name field
getNameFieldByObjectType('1');  // 'accountname'
getNameFieldByObjectType('2');  // 'fullname' (Contact)
getNameFieldByObjectType('14'); // 'name' (Product)

// Get label field for a lookup/dropdown field
getLabelFieldForField('accountid', '1');  // 'accountname'
getLabelFieldForField('statuscode', '1'); // 'status'

// Field type detection
isDropdownField('5');  // true
isLookupField('6');    // true
```

## Schema Generator

Generate TypeScript interfaces from your Fireberry metadata:

```typescript
import { generateSchema, schemaBuilder } from 'fireberry-api-client/utils';

// Simple generation
const result = await generateSchema(client);
console.log(result.typescript);  // TypeScript code
console.log(result.metadata);    // { totalObjects: 15, totalFields: 234 }

// Write to file
import fs from 'fs';
fs.writeFileSync('./fireberry-types.ts', result.typescript);

// Fluent builder with options
const result = await schemaBuilder(client)
  .include([1, 2, 4])       // Only Account, Contact, Opportunity
  .exclude([1000])          // Exclude custom object 1000
  .withComments()           // Include JSDoc comments
  .withFieldTypes()         // Include field type info
  .withLookupInfo()         // Include related object type for lookups
  .withPrefix('FB')         // Prefix interfaces: FBAccount, FBContact
  .asReadonly()             // Generate readonly interfaces
  .generate();

// Generated output example:
// /**
//  * Account (Object Type: 1)
//  * System Name: Account
//  */
// export interface FBAccount {
//   /** Account Name @type text */
//   accountname?: string;
//   /** Status @type dropdown */
//   statuscode?: string | number;
//   /** Primary Contact @type lookup @relatedObjectType 2 */
//   primarycontactid?: string;
// }
```

## ERD Generator

Generate Mermaid ERD diagrams from your Fireberry schema:

```typescript
import { erdBuilder, generateFireberryERD } from 'fireberry-api-client/utils';

// Fluent builder API
const result = await erdBuilder(client)
  .include([1, 2, 4, 9])    // Account, Contact, Opportunity, custom object
  .exclude([1000])          // Exclude specific objects
  .settings({
    includeFields: true,           // Show fields in entities
    showFieldTypes: true,          // Show field types (text, lookup, etc.)
    onlyRelationshipFields: false, // Show only lookup fields
    maxFieldsPerEntity: 10,        // Limit fields per entity (0 = unlimited)
    includeFieldLabels: false,     // Include field labels as comments
    title: 'My CRM Schema',        // Diagram title
    useDisplayNames: false,        // Use system names (recommended)
    includeFrontmatter: false,     // Exclude YAML frontmatter
  })
  .generate();

console.log(result.mermaid);       // Mermaid ERD code
console.log(result.objects);       // Processed objects
console.log(result.relationships); // Found relationships
console.log(result.warnings);      // Any warnings

// Direct function alternative
const result = await generateFireberryERD(client, {
  include: [1, 2, 4],
  settings: { includeFields: true, maxFieldsPerEntity: 5 },
});

// Example Mermaid output:
// erDiagram
//     Account {
//         text accountname
//         lookup primarycontactid FK
//         dropdown statuscode
//     }
//     Contact {
//         text fullname
//         lookup accountid FK
//     }
//
//     Account }o--|| Contact : "primarycontactid"
//     Contact }o--|| Account : "accountid"
```

Render the Mermaid code using any Mermaid-compatible viewer (VS Code extension, GitHub, Notion, etc.).

## Object Type Reference

| ID | Object | ID Field | Name Field |
|----|--------|----------|------------|
| 1 | Account | accountid | accountname |
| 2 | Contact | contactid | fullname |
| 3 | Lead | leadid | fullname |
| 4 | Opportunity | opportunityid | name |
| 5 | Case | casesid | title |
| 6 | Activity | activityid | subject |
| 7 | Note | noteid | notetext |
| 10 | Task | taskid | subject |
| 13 | CRM Order | crmorderid | crmordernumber |
| 14 | Product | productid | name |
| 1000+ | Custom Objects | customobject{N}id | name |

## Error Handling

```typescript
import { FireberryError, FireberryErrorCode } from 'fireberry-api-client';

try {
  await client.query({ objectType: '1', fields: '*' });
} catch (error) {
  if (error instanceof FireberryError) {
    console.log(error.code);       // e.g., 'RATE_LIMITED'
    console.log(error.statusCode); // e.g., 429
    console.log(error.message);    // Human-readable message
  }
}

// Error codes:
// - UNKNOWN
// - NETWORK_ERROR
// - TIMEOUT
// - AUTHENTICATION_FAILED
// - AUTHORIZATION_FAILED
// - NOT_FOUND
// - RATE_LIMITED
// - INVALID_REQUEST
// - SERVER_ERROR
// - ABORTED
// - INVALID_RESPONSE
```

## Query Syntax

Fireberry uses a custom query syntax:

```typescript
// Operators
'(field = value)'           // Equals
'(field != value)'          // Not equals
'(field < value)'           // Less than
'(field > value)'           // Greater than
'(field <= value)'          // Less than or equal
'(field >= value)'          // Greater than or equal
'(field start-with value)'  // Starts with
'(field start-with %value)' // Contains (% is wildcard)
'(field is-null)'           // Is null
'(field is-not-null)'       // Is not null

// Combining conditions
'(statuscode = 1) and (name start-with %Acme)'
'(statuscode = 1) or (statuscode = 2)'

// Nested field search (lookup fields)
'(accountid_fullname start-with %Acme)' // Search Contact by Account name
```

**Important:** Dropdown fields use IDs, not labels. Use `showRealValue: true` to get labels in responses.

### Date Query Quirk

The Fireberry API has a quirk with `<=` and pure date formats (YYYY-MM-DD). When you query `(createdon <= 2024-01-15)`, the API interprets this as `<= 2024-01-15 00:00:00`, which excludes records from January 15th.

**The QueryBuilder automatically handles this:** When using `.lessThanOrEqual()` with a pure date, it converts to `< nextDay`:

```typescript
// This query:
.where('createdon').lessThanOrEqual('2024-01-15')
// Becomes: (createdon < 2024-01-16)
// Correctly includes all records from January 15th

// Datetime values are passed through unchanged:
.where('createdon').lessThanOrEqual('2024-01-15T23:59:59')
// Becomes: (createdon <= 2024-01-15T23:59:59)
```

If building raw query strings, use `< nextDay` instead of `<=` for "on or before" date queries.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test

# Run tests once
npm run test:run

# Lint
npm run lint

# Type check
npm run typecheck
```

## Author

Created by **[Ido Kraicer](https://www.linkedin.com/in/ido-kraicer/)** - An open-source client library built for the Fireberry community.

## License

MIT
