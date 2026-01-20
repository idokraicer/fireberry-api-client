# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A standalone, framework-agnostic TypeScript client library for the Fireberry CRM API. Supports both ESM and CommonJS, targets Node.js 18+.

## Commands

```bash
npm run build        # Build with tsup (outputs to dist/)
npm run dev          # Build in watch mode
npm run test         # Run vitest in watch mode
npm run test:run     # Run tests once
npm run lint         # ESLint on src/
npm run typecheck    # TypeScript type checking
```

## Architecture

### Entry Points
- `src/index.ts` - Main exports (FireberryClient, types, utilities)
- `src/utils/index.ts` - Separate `/utils` export path for utilities
- `src/sdk/index.ts` - SDK adapter for `@fireberry/sdk` integration

### Core Components

**FireberryClient** (`src/client.ts`)
- Main client class that users instantiate with API key
- Handles HTTP requests with automatic 429 retry logic
- Provides metadata caching with configurable TTL
- Exposes API modules as properties: `metadata`, `records`, `batch`, `fields`, `files`

**API Modules** (`src/api/`)
- `MetadataAPI` - Schema introspection (objects, fields, field values)
- `RecordsAPI` - CRUD operations including upsert
- `BatchAPI` - Bulk create/update/delete operations
- `FieldsAPI` - Field management operations
- `FilesAPI` - File upload handling

**QueryBuilder** (`src/utils/queryBuilder.ts`)
- Fluent interface for building Fireberry query strings
- Handles value escaping to prevent query injection
- Can execute queries directly when initialized with a client

### Constants (`src/constants/`)
- `fieldTypes.ts` - Field type ID mappings
- `objectIds.ts` - Object type to ID field mappings
- `objectNames.ts` - Object type to name field mappings
- `excludedFields.ts` - Fields excluded from star (*) queries

### Types (`src/types/`)
- `client.ts` - Client configuration types
- `query.ts` - Query options and results
- `records.ts` - CRUD operation types
- `metadata.ts` - Schema types
- `fields.ts` - Field creation types

### Error Handling
`FireberryError` class (`src/errors.ts`) with error codes:
- `RATE_LIMITED`, `AUTHENTICATION_FAILED`, `NETWORK_ERROR`, `TIMEOUT`, etc.

## Build Output

tsup produces dual CJS/ESM builds with TypeScript declarations and sourcemaps in `dist/`.

## SDK Integration (`src/sdk/`)

This module provides an adapter layer for the official `@fireberry/sdk` package, enhancing it with QueryBuilder and field mapping utilities.

### Key Components
- **SDKQueryBuilder** - Fluent query builder that executes via SDK's iframe messaging
- **EnhancedSDK** - Wrapper adding context helpers and field mapping utilities
- **createSDKQueryBuilder** - Factory function accepting either SDK client or API

### Type Definitions (`src/types/sdk.ts`)
Types mirror the official SDK's API surface:
- `FireberrySDKClient` - Matches `FireberryClientSDK` from `@fireberry/sdk`
- `FireberrySDKAPI` - Matches the SDK's `api` property interface
- `SDKQueryPayload` - Query format: `{fields, query, page_size?, page_number?}`
- `SDKResponseData<T>` - Response format: `{success, data, error?, requestId}`

### SDK vs API Client
- **FireberryClient** (`src/client.ts`) - Direct HTTP API calls, requires API key
- **SDK Adapter** (`src/sdk/`) - Works via iframe messaging, no API key needed (browser-only)

## Field Mapping System

The field mapping system (`src/utils/fieldMapping.ts`) converts API field names to their label equivalents.

### Transformation Rules (in priority order)
1. Special mappings: `objectid` → `objecttitle`, `noteid` → `subject`
2. Custom fields (`pcf_*`): append `name` → `pcf_myfield` → `pcf_myfieldname`
3. Code fields: remove `code` suffix → `statuscode` → `status`
4. ID fields: replace `id` with `name` → `accountid` → `accountname`
5. Default: append `name`

### Object-Type Overrides
Some objects have special rules (defined in `OBJECT_TYPE_OVERRIDES`):
- Object 13 (Orders), 14 (Products), 15 (Invoices) have many exclusions
- Custom objects (1000+) exclude `ownerid` from id→name transformation

## Common Object Type IDs

| ID | Object | ID Field | Name Field |
|----|--------|----------|------------|
| 1 | Account | `accountid` | `accountname` |
| 2 | Contact | `contactid` | `fullname` |
| 3 | Lead | `leadid` | `fullname` |
| 4 | Opportunity | `opportunityid` | `name` |
| 5 | Task | `taskid` | `subject` |
| 6 | Event | `eventid` | `subject` |
| 7 | Note | `noteid` | `subject` |
| 14 | Product | `productid` | `productname` |
| 1000+ | Custom Objects | `customobject{N}id` | `name` |

## Testing

### Test Structure
- `tests/unit/` - Unit tests (mocked, fast)
- `tests/integration/` - Integration tests (requires API key in `.env`)

### Running Tests
```bash
npm run test:run              # All tests once
npm run test                  # Watch mode
npx vitest run tests/unit     # Unit tests only
```

### Integration Tests
Require `FIREBERRY_TOKEN` in `.env`. Tests create/modify real records (cleaned up after).

## Code Patterns

### Query Value Escaping
Always use `escapeQueryValue()` for user-provided values to prevent query injection:
```typescript
import { escapeQueryValue } from './utils/queryBuilder';
const safe = escapeQueryValue(userInput); // Escapes (, ), and, or, \
```

### Batch Operations
Fireberry API limits batch operations to 20 records. `BatchAPI` auto-chunks larger arrays.

### Rate Limiting
`FireberryClient` auto-retries on 429 errors (configurable, default 120 retries with backoff).

### Star Query Exclusions
Some fields cause API errors when using `*`. Use `getExcludedFieldsForStarQuery(objectType)` to get fields to exclude.
