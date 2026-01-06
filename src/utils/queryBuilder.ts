import type { QueryOperator } from '../types/query';

/**
 * Escapes special characters in query values to prevent query injection.
 * This is a security measure to ensure user-provided values cannot modify
 * the query structure or inject additional query logic.
 *
 * @param value - The value to escape
 * @returns Escaped value safe for use in Fireberry queries
 */
export function escapeQueryValue(value: string): string {
  if (!value) {
    return '';
  }
  // Escape backslashes first to avoid double-escaping
  let escaped = value.replace(/\\/g, '\\\\');
  // Escape parentheses which could break out of conditions
  escaped = escaped.replace(/\(/g, '\\(');
  escaped = escaped.replace(/\)/g, '\\)');
  // Escape logical operators that could inject additional conditions
  // Using word boundaries to only match standalone operators
  escaped = escaped.replace(/\bor\b/gi, '\\or');
  escaped = escaped.replace(/\band\b/gi, '\\and');
  return escaped;
}

/**
 * Sanitizes a query string to ensure proper syntax for the Fireberry API
 * Handles common syntax issues and removes extraneous elements
 *
 * @param query - Query string to sanitize
 * @returns Sanitized query string
 */
export function sanitizeQuery(query: string): string {
  if (!query) {
    return '';
  }

  // First, protect special operators from being modified
  // Temporarily mark is-null and is-not-null operators
  query = query.replace(
    /\(\s*([a-zA-Z0-9_]+)\s+(is-null|is-not-null)\s*\)/g,
    '($1 __SPECIAL_OPERATOR__$2)',
  );

  // Also protect text operators like start-with, not-start-with
  query = query.replace(
    /\(\s*([a-zA-Z0-9_]+)\s+(start-with|not-start-with)\s+([^)]+)\s*\)/g,
    '($1 __TEXT_OPERATOR__$2 $3)',
  );

  // Fix missing operators: (field value) -> (field = value)
  query = query.replace(
    /\(\s*([a-zA-Z0-9_]+(?:field|Field|system|System)[0-9]*)\s+(?!__SPECIAL_OPERATOR__|__TEXT_OPERATOR__)([^()<>=!]+)\s*\)/g,
    '($1 = $2)',
  );

  // Fix with a more general pattern for any field-value pair without operator
  query = query.replace(
    /\(\s*([a-zA-Z0-9_]+)\s+(?!__SPECIAL_OPERATOR__|__TEXT_OPERATOR__|<=|>=|!=|<|>|=\s)([^()<>]+)\s*\)/g,
    '($1 = $2)',
  );

  // Restore special operators
  query = query.replace(/__SPECIAL_OPERATOR__/g, '');
  query = query.replace(/__TEXT_OPERATOR__/g, '');

  // Remove parentheses containing only a comparison operator
  query = query.replace(/\(\s*(?:<=|>=|!=|<|>|=)\s*\)/g, '');
  // Remove parentheses containing only text operators
  query = query.replace(/\(\s*(?:start-with|not-start-with)\s*\)/gi, '');
  // Remove parentheses containing only logical operators (AND/OR)
  query = query.replace(/\(\s*(?:and|or)\s*\)/gi, '');
  // Remove empty parentheses
  query = query.replace(/\(\s*\)/g, '');
  // Remove logical operators without operands at start/end
  query = query.replace(/^\s*(and|or)\s*/gi, '');
  query = query.replace(/\s*(and|or)\s*$/gi, '');
  // Remove redundant nested parentheses: ((x)) -> (x)
  const nestedPattern = /\(\s*\(([^()]+)\)\s*\)/g;
  while (nestedPattern.test(query)) {
    query = query.replace(nestedPattern, '($1)');
  }
  // Collapse multiple spaces
  query = query.replace(/\s+/g, ' ');
  return query.trim();
}

/**
 * Condition builder for fluent query construction
 */
interface ConditionBuilder {
  /** Equals comparison (=) */
  equals(value: string | number): QueryBuilder;
  /** Not equals comparison (!=) */
  notEquals(value: string | number): QueryBuilder;
  /** Less than comparison (<) - works with numbers and dates */
  lessThan(value: string | number): QueryBuilder;
  /** Greater than comparison (>) - works with numbers and dates */
  greaterThan(value: string | number): QueryBuilder;
  /** Less than or equal (<=) - works with numbers ONLY (not dates!) */
  lessThanOrEqual(value: string | number): QueryBuilder;
  /** Greater than or equal (>=) - works with numbers ONLY (not dates!) */
  greaterThanOrEqual(value: string | number): QueryBuilder;
  /** Contains value (translates to start-with %value) */
  contains(value: string): QueryBuilder;
  /** Does not contain value (translates to not-start-with %value) */
  notContains(value: string): QueryBuilder;
  /** Starts with value (start-with) */
  startsWith(value: string): QueryBuilder;
  /** Does not start with value (not-start-with) */
  notStartsWith(value: string): QueryBuilder;
  /** Field is null (is-null) */
  isNull(): QueryBuilder;
  /** Field is not null (is-not-null) */
  isNotNull(): QueryBuilder;
}

/**
 * Internal representation of a query condition
 */
interface QueryCondition {
  field: string;
  operator: QueryOperator;
  value?: string;
}

/**
 * Fluent query builder for constructing Fireberry queries
 *
 * @example
 * ```typescript
 * // Build a query string
 * const query = new QueryBuilder()
 *   .where('statuscode').equals('1')
 *   .and()
 *   .where('emailaddress1').contains('@example.com')
 *   .build();
 * // Output: "(statuscode = 1) and (emailaddress1 start-with %@example.com)"
 *
 * // With select and execute (requires client)
 * const result = await new QueryBuilder(client)
 *   .objectType('1')
 *   .select('accountid', 'name', 'emailaddress1')
 *   .where('statuscode').equals('1')
 *   .limit(100)
 *   .execute();
 * ```
 */
/**
 * Client interface for query execution
 */
interface QueryClient {
  query(options: {
    objectType: string;
    fields: string[];
    query: string;
    showRealValue: boolean;
    sortBy?: string;
    sortType?: 'asc' | 'desc';
    limit?: number;
    page?: number;
    signal?: AbortSignal;
  }): Promise<QueryResult>;
}

/**
 * Query result type
 */
interface QueryResult {
  records: Record<string, unknown>[];
  total: number;
  success: boolean;
}

export class QueryBuilder {
  private conditions: QueryCondition[] = [];
  private joinOperators: ('and' | 'or')[] = [];
  private currentField: string | null = null;
  private selectedFields: string[] = [];
  private objectTypeId: string | null = null;
  private sortByField: string | null = null;
  private sortDirection: 'asc' | 'desc' = 'desc';
  private limitValue: number | null = null;
  private pageNumber: number = 1;
  private showRealValueFlag: boolean = true;
  private client: QueryClient | null = null;

  /**
   * Creates a new QueryBuilder
   * @param client - Optional FireberryClient for executing queries
   */
  constructor(client?: QueryClient) {
    this.client = client ?? null;
  }

  /**
   * Sets the object type for the query
   * @param objectType - Object type ID (e.g., '1' for Account)
   */
  objectType(objectType: string | number): this {
    this.objectTypeId = String(objectType);
    return this;
  }

  /**
   * Adds fields to select
   * @param fields - Field names to select
   */
  select(...fields: string[]): this {
    this.selectedFields.push(...fields);
    return this;
  }

  /**
   * Starts a new WHERE condition
   * @param field - Field name to filter on
   */
  where(field: string): ConditionBuilder {
    this.currentField = field;
    return this.createConditionBuilder();
  }

  /**
   * Adds an AND logical operator
   */
  and(): this {
    if (this.conditions.length > 0) {
      this.joinOperators.push('and');
    }
    return this;
  }

  /**
   * Adds an OR logical operator
   */
  or(): this {
    if (this.conditions.length > 0) {
      this.joinOperators.push('or');
    }
    return this;
  }

  /**
   * Sets the sort field and direction
   * @param field - Field to sort by
   * @param direction - Sort direction ('asc' or 'desc')
   */
  sortBy(field: string, direction: 'asc' | 'desc' = 'desc'): this {
    this.sortByField = field;
    this.sortDirection = direction;
    return this;
  }

  /**
   * Sets the maximum number of records to return
   * @param count - Maximum record count
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Sets the page number for pagination
   * @param page - Page number (1-based)
   */
  page(page: number): this {
    this.pageNumber = page;
    return this;
  }

  /**
   * Controls whether to show real values (labels) for dropdown fields
   * @param show - Whether to show real values (default: true)
   */
  showRealValue(show: boolean): this {
    this.showRealValueFlag = show;
    return this;
  }

  /**
   * Builds the query string from conditions
   * @returns The built query string
   */
  build(): string {
    if (this.conditions.length === 0) {
      return '';
    }

    const parts: string[] = [];

    for (let i = 0; i < this.conditions.length; i++) {
      const condition = this.conditions[i];
      let conditionStr: string;

      if (condition.operator === 'is-null' || condition.operator === 'is-not-null') {
        conditionStr = `(${condition.field} ${condition.operator})`;
      } else {
        const escapedValue = escapeQueryValue(condition.value || '');
        conditionStr = `(${condition.field} ${condition.operator} ${escapedValue})`;
      }

      parts.push(conditionStr);

      // Add join operator if there's a next condition
      if (i < this.joinOperators.length) {
        parts.push(this.joinOperators[i]);
      }
    }

    return parts.join(' ');
  }

  /**
   * Executes the query (requires client to be set)
   * @param signal - Optional AbortSignal for cancellation
   * @returns Query results
   */
  async execute(signal?: AbortSignal): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('QueryBuilder requires a client to execute queries. Pass a FireberryClient to the constructor.');
    }

    if (!this.objectTypeId) {
      throw new Error('Object type is required. Use .objectType() before executing.');
    }

    const queryOptions: Parameters<QueryClient['query']>[0] = {
      objectType: this.objectTypeId,
      fields: this.selectedFields.length > 0 ? this.selectedFields : ['*'],
      query: this.build(),
      showRealValue: this.showRealValueFlag,
    };

    if (this.sortByField) {
      queryOptions.sortBy = this.sortByField;
      queryOptions.sortType = this.sortDirection;
    }

    if (this.limitValue !== null) {
      queryOptions.limit = this.limitValue;
    }

    if (this.pageNumber > 1) {
      queryOptions.page = this.pageNumber;
    }

    if (signal) {
      queryOptions.signal = signal;
    }

    return this.client.query(queryOptions);
  }

  /**
   * Creates a condition builder for the current field
   */
  private createConditionBuilder(): ConditionBuilder {
    const field = this.currentField!;

    return {
      equals: (value: string | number): QueryBuilder => {
        this.addCondition(field, '=', String(value));
        return this;
      },
      notEquals: (value: string | number): QueryBuilder => {
        this.addCondition(field, '!=', String(value));
        return this;
      },
      lessThan: (value: string | number): QueryBuilder => {
        this.addCondition(field, '<', String(value));
        return this;
      },
      greaterThan: (value: string | number): QueryBuilder => {
        this.addCondition(field, '>', String(value));
        return this;
      },
      lessThanOrEqual: (value: string | number): QueryBuilder => {
        this.addCondition(field, '<=', String(value));
        return this;
      },
      greaterThanOrEqual: (value: string | number): QueryBuilder => {
        this.addCondition(field, '>=', String(value));
        return this;
      },
      contains: (value: string): QueryBuilder => {
        // Contains translates to "start-with %value"
        this.addCondition(field, 'start-with', `%${value}`);
        return this;
      },
      notContains: (value: string): QueryBuilder => {
        // Not contains translates to "not-start-with %value"
        this.addCondition(field, 'not-start-with', `%${value}`);
        return this;
      },
      startsWith: (value: string): QueryBuilder => {
        this.addCondition(field, 'start-with', value);
        return this;
      },
      notStartsWith: (value: string): QueryBuilder => {
        this.addCondition(field, 'not-start-with', value);
        return this;
      },
      isNull: (): QueryBuilder => {
        this.addCondition(field, 'is-null');
        return this;
      },
      isNotNull: (): QueryBuilder => {
        this.addCondition(field, 'is-not-null');
        return this;
      },
    };
  }

  /**
   * Adds a condition to the query
   */
  private addCondition(field: string, operator: QueryOperator, value?: string): void {
    this.conditions.push({ field, operator, value });
    this.currentField = null;
  }
}
