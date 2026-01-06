/**
 * Query module - Query functionality is implemented directly in FireberryClient
 *
 * This file re-exports query-related utilities for convenience.
 * The actual query execution is handled by:
 * - client.query() - for direct query execution
 * - client.queryBuilder() - for fluent query building
 */

export { QueryBuilder, escapeQueryValue, sanitizeQuery } from '../utils/queryBuilder';
export type { QueryOptions, QueryResult, QueryOperator } from '../types/query';
