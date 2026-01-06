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
