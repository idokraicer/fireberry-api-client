/**
 * Options for query operations
 */
export interface QueryOptions {
  /** Object type ID */
  objectType: string;
  /** Fields to return (array or comma-separated string, '*' for all) */
  fields?: string | string[];
  /** Query filter string */
  query?: string;
  /** Field to sort by (default: modifiedon) */
  sortBy?: string;
  /** Sort direction (default: desc) */
  sortType?: 'asc' | 'desc';
  /** Maximum number of records to return */
  limit?: number;
  /** Whether to return label values alongside IDs for dropdowns/lookups */
  showRealValue?: boolean;
  /** Page number (1-indexed) */
  page?: number;
  /** Page size (default: 500, max: 500) */
  pageSize?: number;
  /** Automatically fetch all pages (default: true) */
  autoPage?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Query result
 */
export interface QueryResult<T = Record<string, unknown>> {
  /** Array of records */
  records: T[];
  /** Total number of records returned */
  total: number;
  /** Whether the query was successful */
  success: boolean;
  /** Page number (only set when using queryStream or single-page queries) */
  page?: number;
}

/**
 * Query metadata for debugging
 */
export interface QueryMetadata {
  /** Object type ID */
  objectType: string;
  /** Fields requested */
  fields: string[];
  /** Query filter string */
  queryString: string;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Page size */
  pageSize: number;
  /** Whether auto-pagination was used */
  autoPage: boolean;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortType?: 'asc' | 'desc';
  /** Limit if set */
  limit?: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Query result with debugging metadata
 */
export interface QueryResultWithMetadata<T = Record<string, unknown>> extends QueryResult<T> {
  /** Query metadata for debugging */
  metadata: QueryMetadata;
}

/**
 * Query condition item for query builder
 */
export interface QueryConditionItem {
  itemType: 'condition';
  field: string;
  operator: QueryOperator;
  value?: string;
  joinOperator?: 'and' | 'or';
}

/**
 * Query separator item for grouping
 */
export interface QuerySeparatorItem {
  itemType: 'separator';
  logicOperator: 'and' | 'or';
}

/**
 * Query item type
 */
export type QueryItem = QueryConditionItem | QuerySeparatorItem;

/**
 * Native Fireberry query operators
 */
export type QueryOperator =
  | '='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'start-with'
  | 'not-start-with'
  | 'is-null'
  | 'is-not-null';

/**
 * Result of query explain/dry run
 */
export interface QueryExplainResult {
  /** The object type being queried */
  objectType: string;
  /** The generated query string */
  query: string;
  /** Fields that will be selected */
  fields: string[];
  /** Whether wildcard (*) fields are used */
  usesWildcard: boolean;
  /** Whether auto-pagination will be used */
  willAutoPage: boolean;
  /** Configured limit (if any) */
  limit: number | null;
  /** Page size that will be used */
  pageSize: number;
  /** Sort configuration */
  sorting: {
    field: string;
    direction: 'asc' | 'desc';
  };
  /** Estimated API calls needed (approximate) */
  estimatedApiCalls: number;
  /** Warnings about the query */
  warnings: string[];
  /** Suggestions for optimization */
  suggestions: string[];
  /** Number of conditions in the query */
  conditionCount: number;
  /** Whether showRealValue is enabled */
  showRealValue: boolean;
}
