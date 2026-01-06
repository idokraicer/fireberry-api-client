/**
 * Error codes for Fireberry API errors
 */
export enum FireberryErrorCode {
  /** Unknown or unexpected error */
  UNKNOWN = 'UNKNOWN',
  /** Network error (connection failed, DNS, etc.) */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Request timeout */
  TIMEOUT = 'TIMEOUT',
  /** Authentication failed (invalid API key) */
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  /** Authorization failed (missing permissions) */
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  /** Resource not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Rate limit exceeded (429) */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Invalid request parameters */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** Server error (5xx) */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Request was aborted */
  ABORTED = 'ABORTED',
  /** Invalid response from API */
  INVALID_RESPONSE = 'INVALID_RESPONSE',
}

/**
 * Options for creating a FireberryError
 */
export interface FireberryErrorOptions {
  /** Error code */
  code: FireberryErrorCode;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Original error that caused this error */
  cause?: Error;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Custom error class for Fireberry API errors
 */
export class FireberryError extends Error {
  /** Error code */
  readonly code: FireberryErrorCode;
  /** HTTP status code if applicable */
  readonly statusCode?: number;
  /** Original error that caused this error */
  readonly cause?: Error;
  /** Additional context data */
  readonly context?: Record<string, unknown>;

  constructor(message: string, options: FireberryErrorOptions) {
    super(message);
    this.name = 'FireberryError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.cause = options.cause;
    this.context = options.context;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FireberryError);
    }
  }

  /**
   * Creates a string representation of the error
   */
  toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.statusCode) {
      str += ` (HTTP ${this.statusCode})`;
    }
    return str;
  }

  /**
   * Converts the error to a plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Creates an error from an HTTP response
 */
export function createErrorFromResponse(
  response: Response,
  body?: unknown,
): FireberryError {
  const status = response.status;
  let code: FireberryErrorCode;
  let message: string;

  switch (status) {
    case 400:
      code = FireberryErrorCode.INVALID_REQUEST;
      message = 'Invalid request parameters';
      break;
    case 401:
      code = FireberryErrorCode.AUTHENTICATION_FAILED;
      message = 'Authentication failed - invalid or missing API key';
      break;
    case 403:
      code = FireberryErrorCode.AUTHORIZATION_FAILED;
      message = 'Authorization failed - insufficient permissions';
      break;
    case 404:
      code = FireberryErrorCode.NOT_FOUND;
      message = 'Resource not found';
      break;
    case 429:
      code = FireberryErrorCode.RATE_LIMITED;
      message = 'Rate limit exceeded - too many requests';
      break;
    default:
      if (status >= 500) {
        code = FireberryErrorCode.SERVER_ERROR;
        message = `Server error (${status})`;
      } else {
        code = FireberryErrorCode.UNKNOWN;
        message = `HTTP error ${status}`;
      }
  }

  // Try to extract error message from response body
  if (body && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>;
    if (typeof bodyObj.message === 'string') {
      message = bodyObj.message;
    } else if (typeof bodyObj.error === 'string') {
      message = bodyObj.error;
    }
  }

  return new FireberryError(message, {
    code,
    statusCode: status,
    context: { body },
  });
}

/**
 * Creates an error from a network/fetch error
 */
export function createNetworkError(error: Error): FireberryError {
  // Check for abort
  if (error.name === 'AbortError') {
    return new FireberryError('Request was aborted', {
      code: FireberryErrorCode.ABORTED,
      cause: error,
    });
  }

  // Check for timeout
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    return new FireberryError('Request timed out', {
      code: FireberryErrorCode.TIMEOUT,
      cause: error,
    });
  }

  return new FireberryError(`Network error: ${error.message}`, {
    code: FireberryErrorCode.NETWORK_ERROR,
    cause: error,
  });
}
