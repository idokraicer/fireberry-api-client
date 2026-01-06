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
