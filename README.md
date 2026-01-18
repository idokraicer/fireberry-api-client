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

## Author

Created by **[Ido Kraicer](https://www.linkedin.com/in/ido-kraicer/)** - An open-source client library built for the Fireberry community.

## License

MIT
