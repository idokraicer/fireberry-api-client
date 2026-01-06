/**
 * Waits for the specified number of milliseconds
 * Used for rate limit handling and retry logic
 *
 * @param ms - Time to wait in milliseconds
 * @returns Promise that resolves after the specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Splits an array into chunks of specified size
 * Used for processing large batches in Fireberry-compatible pieces (max 20 items)
 *
 * @param array - Array to split
 * @param size - Maximum chunk size
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Safely converts a value to a string for API usage
 * Handles null, undefined, numbers, and other types
 *
 * @param value - The value to convert
 * @returns String representation of the value
 */
export function safeStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Normalizes fields input to an array
 * Accepts both array of strings and comma-separated string
 *
 * @param fields - Fields as array or comma-separated string
 * @returns Array of field names
 *
 * @example
 * normalizeFields('a,b,c')      // ['a', 'b', 'c']
 * normalizeFields(['a', 'b'])   // ['a', 'b']
 * normalizeFields('*')          // ['*']
 */
export function normalizeFields(fields: string | string[]): string[] {
  if (Array.isArray(fields)) {
    return fields;
  }
  if (typeof fields === 'string') {
    // Handle empty string
    if (!fields.trim()) {
      return [];
    }
    // Split by comma and trim whitespace
    return fields.split(',').map((f) => f.trim()).filter((f) => f.length > 0);
  }
  return [];
}

/**
 * Joins fields array into a comma-separated string
 * Useful for API requests that expect fields as a string
 *
 * @param fields - Array of field names
 * @returns Comma-separated string of fields
 */
export function joinFields(fields: string[]): string {
  return fields.join(',');
}

/**
 * Checks if a fields input represents "select all"
 *
 * @param fields - Fields input (string or array)
 * @returns True if fields is '*' or ['*'] or empty
 */
export function isSelectAll(fields: string | string[]): boolean {
  if (Array.isArray(fields)) {
    return fields.length === 0 || (fields.length === 1 && fields[0] === '*');
  }
  return !fields || fields === '*';
}

/**
 * Deep clones an object
 * Used for safely copying configuration objects
 *
 * @param obj - Object to clone
 * @returns Deep cloned copy of the object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Checks if a value is a plain object (not array, null, etc.)
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
