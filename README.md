# fireberry-api-client

A standalone, framework-agnostic TypeScript client library for the Fireberry CRM API. Supports both ESM and CommonJS, targets Node.js 18+.

## Installation

```bash
npm install fireberry-api-client
```

## Quick Start

```typescript
import { FireberryClient } from 'fireberry-api-client';

const client = new FireberryClient({
  apiKey: 'your-api-key'
});

// Fetch records
const records = await client.records.find('contacts', {
  limit: 10
});
```

## Features

- Full TypeScript support with comprehensive types
- Automatic rate limiting with 429 retry logic
- Metadata caching with configurable TTL
- Fluent QueryBuilder for complex queries
- Batch operations support
- File upload handling

## API Modules

- **MetadataAPI** - Schema introspection (objects, fields, field values)
- **RecordsAPI** - CRUD operations including upsert
- **BatchAPI** - Bulk create/update/delete operations
- **FieldsAPI** - Field management operations
- **FilesAPI** - File upload handling

## Development

```bash
npm run build        # Build with tsup (outputs to dist/)
npm run dev          # Build in watch mode
npm run test         # Run vitest in watch mode
npm run test:run     # Run tests once
npm run lint         # ESLint on src/
npm run typecheck    # TypeScript type checking
```

## License

MIT
