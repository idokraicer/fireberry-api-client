# fireberry-api-client

A standalone, framework-agnostic TypeScript/JavaScript client for the Fireberry CRM API.

## Features

- Full TypeScript support with comprehensive type definitions
- Zero runtime dependencies (uses native `fetch`)
- Supports both ESM and CommonJS
- Automatic retry on rate limits (429)
- Optional metadata caching
- Fluent QueryBuilder API
- Batch operations with auto-chunking
- AbortController support for cancellation

## Installation

```bash
npm install fireberry-api-client
```

**Requirements:** Node.js 18+

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
  cacheTTL: 300000,              // Optional, cache TTL in ms (5 min default)
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

// Query with all fields
const result = await client.query({
  objectType: '1',
  fields: '*',
  limit: 10,
});

// Auto-pagination (fetch all pages)
const allRecords = await client.query({
  objectType: '1',
  fields: '*',
  autoPage: true,
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

// Available conditions:
// .equals(value)         - Exact match
// .notEquals(value)      - Not equal
// .lessThan(value)       - Less than
// .greaterThan(value)    - Greater than
// .lessThanOrEqual(value) - Less than or equal (numbers only)
// .greaterThanOrEqual(value) - Greater than or equal (numbers only)
// .contains(value)       - Contains (translates to start-with %value)
// .notContains(value)    - Does not contain
// .startsWith(value)     - Starts with
// .notStartsWith(value)  - Does not start with
// .isNull()              - Field is null
// .isNotNull()           - Field is not null
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

// Get fields for an object
const fields = await client.metadata.getFields('1');

// Get dropdown values
const values = await client.metadata.getFieldValues('1', 'statuscode');
```

### Metadata Caching

```typescript
const client = new FireberryClient({
  apiKey: 'your-api-key',
  cacheMetadata: true,
  cacheTTL: 300000, // 5 minutes
});

// Metadata calls are cached
await client.metadata.getFields('1'); // Hits API
await client.metadata.getFields('1'); // Uses cache

// Manual cache control
client.cache.clear();                    // Clear all cache
client.cache.clearFields('1');           // Clear fields for object 1
client.cache.clearFieldValues('1', 'statuscode'); // Clear specific field values
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
getNameFieldByObjectType('14'); // 'productname' (Product)

// Get label field for a lookup/dropdown field
getLabelFieldForField('accountid', '1');  // 'accountname'
getLabelFieldForField('statuscode', '1'); // 'status'

// Field type detection
isDropdownField('5');  // true
isLookupField('6');    // true
```

## Object Type Reference

| ID | Object | ID Field | Name Field |
|----|--------|----------|------------|
| 1 | Account | accountid | accountname |
| 2 | Contact | contactid | fullname |
| 3 | Lead | leadid | fullname |
| 4 | Opportunity | opportunityid | name |
| 5 | Case | casesid | title |
| 6 | Activity | activityid | subject |
| 7 | Note | noteid | subject |
| 10 | Task | taskid | subject |
| 13 | CRM Order | crmorderid | name |
| 14 | Product | productid | productname |
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
'(field <= value)'          // Less than or equal (numbers only)
'(field >= value)'          // Greater than or equal (numbers only)
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

## License

MIT
