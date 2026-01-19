import type { QueryOperator, QueryMetadata, QueryResultWithMetadata, QueryExplainResult } from '../types/query';
import { getObjectIdFieldName } from '../constants/objectIds';

/**
 * Regular expression to match pure date format (YYYY-MM-DD).
 * Does not match datetime formats like YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS.
 */
const PURE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks if a value is a pure date string (YYYY-MM-DD format).
 * Returns false for datetime formats that include time components.
 *
 * @param value - The value to check
 * @returns True if the value is a pure date string
 *
 * @example
 * isPureDate('2024-01-15')           // true
 * isPureDate('2024-01-15T10:30:00')  // false
 * isPureDate('2024-01-15 10:30:00')  // false
 * isPureDate('123')                  // false
 */
export function isPureDate(value: string): boolean {
  return PURE_DATE_REGEX.test(value);
}

/**
 * Adds a specified number of days to a date string.
 * Works with both pure dates (YYYY-MM-DD) and datetime formats.
 *
 * @param dateStr - The date string to modify
 * @param days - Number of days to add (can be negative)
 * @returns The modified date in YYYY-MM-DD format
 *
 * @example
 * addDays('2024-01-15', 1)   // '2024-01-16'
 * addDays('2024-01-31', 1)   // '2024-02-01'
 * addDays('2024-03-01', -1)  // '2024-02-29' (leap year)
 */
export function addDays(dateStr: string, days: number): string {
  // Extract just the date part if datetime format
  const datePart = dateStr.split(/[T\s]/)[0];
  const date = new Date(datePart + 'T00:00:00');
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

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
 * Gets today's date in YYYY-MM-DD format
 */
export function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the start of current week (Monday) in YYYY-MM-DD format
 */
export function getStartOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  // Adjust so Monday is first day (day 0 = Sunday, so Monday = 1)
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const dayStr = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

/**
 * Gets the start of current month in YYYY-MM-DD format
 */
export function getStartOfMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Date condition builder for fluent date query construction
 */
export interface DateConditionBuilder {
  /** Records from today */
  today(): QueryBuilder;
  /** Records from this week (Monday to now) */
  thisWeek(): QueryBuilder;
  /** Records from this month */
  thisMonth(): QueryBuilder;
  /** Records between two dates (inclusive) */
  between(startDate: string, endDate: string): QueryBuilder;
  /** Records from the last N days (including today) */
  daysAgo(days: number): QueryBuilder;
  /** Records before date */
  before(date: string): QueryBuilder;
  /** Records after date */
  after(date: string): QueryBuilder;
  /** Records on or before date */
  onOrBefore(date: string): QueryBuilder;
  /** Records on or after date */
  onOrAfter(date: string): QueryBuilder;
}

/**
 * Condition builder for fluent query construction
 */
export interface ConditionBuilder {
  /** Equals comparison (=) */
  equals(value: string | number): QueryBuilder;
  /** Not equals comparison (!=) */
  notEquals(value: string | number): QueryBuilder;
  /** IN comparison - matches any of the provided values (joined with OR) */
  in(values: (string | number)[]): QueryBuilder;
  /** Less than comparison (<) - works with numbers and dates */
  lessThan(value: string | number): QueryBuilder;
  /** Greater than comparison (>) - works with numbers and dates */
  greaterThan(value: string | number): QueryBuilder;
  /** Less than or equal (<=) - auto-converts pure dates (YYYY-MM-DD) to < nextDay */
  lessThanOrEqual(value: string | number): QueryBuilder;
  /** Greater than or equal (>=) - works with numbers and dates */
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
   * Starts a new WHERE condition for a date field with date-specific helpers
   * @param field - Date field name to filter on
   *
   * @example
   * ```typescript
   * // Records created today
   * qb.whereDate('createdon').today()
   *
   * // Records from this week
   * qb.whereDate('createdon').thisWeek()
   *
   * // Records from the last 30 days
   * qb.whereDate('createdon').daysAgo(30)
   *
   * // Records between two dates
   * qb.whereDate('createdon').between('2024-01-01', '2024-12-31')
   * ```
   */
  whereDate(field: string): DateConditionBuilder {
    return this.createDateConditionBuilder(field);
  }

  /**
   * Adds a WHERE condition for the primary ID field, automatically mapped based on object type
   * @param value - The ID value to match
   * @throws Error if objectType is not set
   *
   * @example
   * ```typescript
   * // Instead of knowing the exact field name:
   * new QueryBuilder(client)
   *   .objectType(1)
   *   .whereId('abc123')  // Automatically uses 'accountid' for object type 1
   *   .execute();
   *
   * // Equivalent to:
   * new QueryBuilder(client)
   *   .objectType(1)
   *   .where('accountid').equals('abc123')
   *   .execute();
   * ```
   */
  whereId(value: string | number): this {
    if (!this.objectTypeId) {
      throw new Error('Object type must be set before using whereId(). Call .objectType() first.');
    }
    const idField = getObjectIdFieldName(this.objectTypeId);
    this.addCondition(idField, '=', String(value));
    return this;
  }

  /**
   * Adds WHERE conditions for multiple primary ID values, joined with OR
   * @param values - Array of ID values to match
   * @throws Error if objectType is not set
   * @throws Error if values array is empty
   *
   * @example
   * ```typescript
   * // Query multiple accounts by ID:
   * new QueryBuilder(client)
   *   .objectType(1)
   *   .whereIds(['id1', 'id2', 'id3'])
   *   .execute();
   *
   * // Generates: (accountid = id1) or (accountid = id2) or (accountid = id3)
   *
   * // Can be combined with other conditions:
   * new QueryBuilder(client)
   *   .objectType(1)
   *   .whereIds(['id1', 'id2'])
   *   .and()
   *   .where('statuscode').equals('1')
   *   .execute();
   * ```
   */
  whereIds(values: (string | number)[]): this {
    if (!this.objectTypeId) {
      throw new Error('Object type must be set before using whereIds(). Call .objectType() first.');
    }
    if (!values || values.length === 0) {
      throw new Error('whereIds() requires at least one ID value.');
    }
    const idField = getObjectIdFieldName(this.objectTypeId);

    // Add first condition
    this.addCondition(idField, '=', String(values[0]));

    // Add remaining conditions with OR
    for (let i = 1; i < values.length; i++) {
      this.joinOperators.push('or');
      this.addCondition(idField, '=', String(values[i]));
    }

    return this;
  }

  /**
   * Adds a WHERE IN condition for a field with multiple values, joined with OR
   * @param field - Field name to filter on
   * @param values - Array of values to match
   * @throws Error if values array is empty
   *
   * @example
   * ```typescript
   * // Query accounts with specific status codes:
   * new QueryBuilder(client)
   *   .objectType(1)
   *   .whereIn('statuscode', [1, 2, 3])
   *   .execute();
   *
   * // Generates: (statuscode = 1) or (statuscode = 2) or (statuscode = 3)
   * ```
   */
  whereIn(field: string, values: (string | number)[]): this {
    if (!values || values.length === 0) {
      throw new Error('whereIn() requires at least one value.');
    }
    // Add first condition
    this.addCondition(field, '=', String(values[0]));
    // Add remaining conditions with OR
    for (let i = 1; i < values.length; i++) {
      this.joinOperators.push('or');
      this.addCondition(field, '=', String(values[i]));
    }
    return this;
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
   * Returns the selected fields array
   * Useful for inspecting the query configuration
   */
  getFields(): string[] {
    return [...this.selectedFields];
  }

  /**
   * Converts the query builder state to a payload compatible with @fireberry/sdk
   *
   * @returns Object with `fields` (comma-separated string) and `query` (filter string)
   *
   * @example
   * ```typescript
   * import FireberryClientSDK from '@fireberry/sdk/client';
   * import { QueryBuilder } from 'fireberry-api-client';
   *
   * const sdk = new FireberryClientSDK();
   * await sdk.initializeContext();
   *
   * const payload = new QueryBuilder()
   *   .select('accountid', 'accountname')
   *   .where('statuscode').equals('1')
   *   .toSDKPayload();
   *
   * // Use with SDK
   * const results = await sdk.api.query(1, payload);
   * ```
   */
  toSDKPayload(): { fields: string; query: string; page_size?: number; page_number?: number } {
    const payload: { fields: string; query: string; page_size?: number; page_number?: number } = {
      fields: this.selectedFields.length > 0 ? this.selectedFields.join(',') : '*',
      query: this.build(),
    };

    if (this.limitValue !== null) {
      payload.page_size = this.limitValue;
    }

    if (this.pageNumber > 1) {
      payload.page_number = this.pageNumber;
    }

    return payload;
  }

  /**
   * Executes the query and returns the count of matching records
   * Uses minimal field selection (ID only) for efficiency
   * @param signal - Optional AbortSignal for cancellation
   * @returns Number of matching records
   *
   * @example
   * ```typescript
   * const activeCount = await client.queryBuilder()
   *   .objectType(1)
   *   .where('statuscode').equals('1')
   *   .count();
   *
   * console.log(`Found ${activeCount} active accounts`);
   * ```
   */
  async count(signal?: AbortSignal): Promise<number> {
    if (!this.client) {
      throw new Error('QueryBuilder requires a client to execute queries. Pass a FireberryClient to the constructor.');
    }

    if (!this.objectTypeId) {
      throw new Error('Object type is required. Use .objectType() before executing.');
    }

    // Use minimal fields for efficiency - just get the ID field
    const idField = getObjectIdFieldName(this.objectTypeId);

    const result = await this.client.query({
      objectType: this.objectTypeId,
      fields: [idField],
      query: this.build(),
      showRealValue: false, // No need for labels
      signal,
    });

    return result.total;
  }

  /**
   * Executes the query and returns the first record or null
   * Automatically sets limit to 1 for efficiency
   * @param signal - Optional AbortSignal for cancellation
   * @returns First record or null if no records found
   *
   * @example
   * ```typescript
   * const account = await client.queryBuilder()
   *   .objectType(1)
   *   .where('accountname').equals('Acme Corp')
   *   .first();
   *
   * if (account) {
   *   console.log(account.accountid);
   * }
   * ```
   */
  async first(signal?: AbortSignal): Promise<Record<string, unknown> | null> {
    // Temporarily set limit to 1 for efficiency
    const originalLimit = this.limitValue;
    this.limitValue = 1;

    try {
      const result = await this.execute(signal);
      return result.records[0] ?? null;
    } finally {
      // Restore original limit
      this.limitValue = originalLimit;
    }
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
   * Executes the query and returns results with debugging metadata
   * Includes query string, fields, pagination info, and execution time
   * @param signal - Optional AbortSignal for cancellation
   * @returns Query results with metadata
   *
   * @example
   * ```typescript
   * const result = await client.queryBuilder()
   *   .objectType(1)
   *   .select('accountid', 'accountname')
   *   .where('statuscode').equals('1')
   *   .executeWithDebug();
   *
   * console.log('Query:', result.metadata.queryString);
   * console.log('Fields:', result.metadata.fields);
   * console.log('Execution time:', result.metadata.executionTimeMs, 'ms');
   * console.log('Records:', result.records.length);
   * ```
   */
  async executeWithDebug(signal?: AbortSignal): Promise<QueryResultWithMetadata> {
    if (!this.client) {
      throw new Error('QueryBuilder requires a client to execute queries. Pass a FireberryClient to the constructor.');
    }

    if (!this.objectTypeId) {
      throw new Error('Object type is required. Use .objectType() before executing.');
    }

    const startTime = Date.now();
    const fields = this.selectedFields.length > 0 ? this.selectedFields : ['*'];
    const queryString = this.build();

    const queryOptions: Parameters<QueryClient['query']>[0] = {
      objectType: this.objectTypeId,
      fields,
      query: queryString,
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

    const result = await this.client.query(queryOptions);
    const executionTimeMs = Date.now() - startTime;

    const metadata: QueryMetadata = {
      objectType: this.objectTypeId,
      fields,
      queryString,
      pageNumber: this.pageNumber,
      pageSize: this.limitValue ?? 500,
      autoPage: true, // Default behavior
      executionTimeMs,
    };

    if (this.sortByField) {
      metadata.sortBy = this.sortByField;
      metadata.sortType = this.sortDirection;
    }

    if (this.limitValue !== null) {
      metadata.limit = this.limitValue;
    }

    return {
      ...result,
      metadata,
    };
  }

  /**
   * Analyzes the query without executing it (dry run)
   * Returns information about what the query will do, potential issues, and optimization suggestions
   *
   * @returns Query analysis with warnings and suggestions
   *
   * @example
   * ```typescript
   * const analysis = client.queryBuilder()
   *   .objectType('1')
   *   .select('*')
   *   .where('statuscode').equals('1')
   *   .explain();
   *
   * console.log('Query:', analysis.query);
   * console.log('Warnings:', analysis.warnings);
   * console.log('Suggestions:', analysis.suggestions);
   * console.log('Estimated API calls:', analysis.estimatedApiCalls);
   * ```
   */
  explain(): QueryExplainResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check object type
    if (!this.objectTypeId) {
      warnings.push('Object type is not set. Call .objectType() before executing.');
    }

    // Analyze fields
    const fields = this.selectedFields.length > 0 ? this.selectedFields : ['*'];
    const usesWildcard = fields.includes('*') || fields.length === 0;

    if (usesWildcard) {
      warnings.push('Using wildcard (*) fields may include unnecessary data and slow down queries.');
      suggestions.push('Consider selecting only the specific fields you need with .select()');
    }

    // Analyze query
    const queryString = this.build();
    const conditionCount = this.conditions.length;

    if (conditionCount === 0 && !this.limitValue) {
      warnings.push('No query conditions or limit set. This may return a large number of records.');
      suggestions.push('Add filters with .where() or set a .limit() to control result size.');
    }

    // Check for potential performance issues
    const hasContainsOperator = this.conditions.some(
      (c) => c.operator === 'start-with' && c.value?.startsWith('%'),
    );
    if (hasContainsOperator) {
      warnings.push('Contains queries (using % prefix) may be slower than exact matches.');
    }

    // Check for OR conditions (may affect performance)
    const hasOrConditions = this.joinOperators.some((op) => op === 'or');
    if (hasOrConditions && conditionCount > 5) {
      warnings.push('Multiple OR conditions may affect query performance.');
      suggestions.push('Consider breaking into separate queries if possible.');
    }

    // Sorting analysis
    const sortField = this.sortByField || 'modifiedon';
    const sortDirection = this.sortDirection;

    // Estimate API calls
    let estimatedApiCalls = 1;
    const pageSize = 500; // Default page size
    const willAutoPage = this.limitValue === null; // Auto-page when no limit

    if (willAutoPage && conditionCount === 0) {
      // Without conditions, could be many pages
      estimatedApiCalls = -1; // Unknown/many
      warnings.push('Without filters, query may require many API calls for pagination.');
    } else if (this.limitValue !== null) {
      estimatedApiCalls = Math.ceil(this.limitValue / pageSize);
    }

    // Check for missing index hints
    if (!this.sortByField && conditionCount > 0) {
      suggestions.push('Consider adding .sortBy() to control result ordering.');
    }

    // Check showRealValue impact
    if (this.showRealValueFlag) {
      suggestions.push('showRealValue is enabled (default). Set .showRealValue(false) if you only need IDs.');
    }

    return {
      objectType: this.objectTypeId || '(not set)',
      query: queryString || '(no conditions)',
      fields,
      usesWildcard,
      willAutoPage,
      limit: this.limitValue,
      pageSize,
      sorting: {
        field: sortField,
        direction: sortDirection,
      },
      estimatedApiCalls,
      warnings,
      suggestions,
      conditionCount,
      showRealValue: this.showRealValueFlag,
    };
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
      in: (values: (string | number)[]): QueryBuilder => {
        if (!values || values.length === 0) {
          throw new Error('in() requires at least one value.');
        }
        // Add first condition
        this.addCondition(field, '=', String(values[0]));
        // Add remaining conditions with OR
        for (let i = 1; i < values.length; i++) {
          this.joinOperators.push('or');
          this.addCondition(field, '=', String(values[i]));
        }
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
        const strValue = String(value);
        // Fireberry API bug: <= with pure dates (YYYY-MM-DD) behaves like <
        // because it interprets the date as midnight (00:00:00).
        // Auto-convert to < nextDay for correct "on or before" behavior.
        if (isPureDate(strValue)) {
          const nextDay = addDays(strValue, 1);
          this.addCondition(field, '<', nextDay);
        } else {
          this.addCondition(field, '<=', strValue);
        }
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
   * Creates a date condition builder for the specified field
   */
  private createDateConditionBuilder(field: string): DateConditionBuilder {
    return {
      today: (): QueryBuilder => {
        const today = getToday();
        // Records from today: >= today AND < tomorrow
        this.addCondition(field, '>=', today);
        this.joinOperators.push('and');
        this.addCondition(field, '<', addDays(today, 1));
        return this;
      },
      thisWeek: (): QueryBuilder => {
        const startOfWeek = getStartOfWeek();
        const tomorrow = addDays(getToday(), 1);
        // Records from start of week to now: >= monday AND < tomorrow
        this.addCondition(field, '>=', startOfWeek);
        this.joinOperators.push('and');
        this.addCondition(field, '<', tomorrow);
        return this;
      },
      thisMonth: (): QueryBuilder => {
        const startOfMonth = getStartOfMonth();
        const tomorrow = addDays(getToday(), 1);
        // Records from start of month to now: >= first day AND < tomorrow
        this.addCondition(field, '>=', startOfMonth);
        this.joinOperators.push('and');
        this.addCondition(field, '<', tomorrow);
        return this;
      },
      between: (startDate: string, endDate: string): QueryBuilder => {
        // Records between dates (inclusive): >= start AND < day after end
        this.addCondition(field, '>=', startDate);
        this.joinOperators.push('and');
        // Use < next day for inclusive end date (handles API quirk)
        const dayAfterEnd = isPureDate(endDate) ? addDays(endDate, 1) : endDate;
        this.addCondition(field, '<', dayAfterEnd);
        return this;
      },
      daysAgo: (days: number): QueryBuilder => {
        const today = getToday();
        const startDate = addDays(today, -days);
        const tomorrow = addDays(today, 1);
        // Records from N days ago to now: >= (today - N) AND < tomorrow
        this.addCondition(field, '>=', startDate);
        this.joinOperators.push('and');
        this.addCondition(field, '<', tomorrow);
        return this;
      },
      before: (date: string): QueryBuilder => {
        this.addCondition(field, '<', date);
        return this;
      },
      after: (date: string): QueryBuilder => {
        // After a date means > end of that day
        // For pure dates, use > date (API treats as > midnight, so actually > end of previous day)
        // We need >= next day for "after" to work correctly
        const nextDay = isPureDate(date) ? addDays(date, 1) : date;
        this.addCondition(field, '>=', nextDay);
        return this;
      },
      onOrBefore: (date: string): QueryBuilder => {
        // Use < next day for inclusive (handles API quirk with <=)
        const nextDay = isPureDate(date) ? addDays(date, 1) : date;
        this.addCondition(field, '<', nextDay);
        return this;
      },
      onOrAfter: (date: string): QueryBuilder => {
        this.addCondition(field, '>=', date);
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
