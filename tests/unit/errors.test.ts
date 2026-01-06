import { describe, it, expect } from 'vitest';
import {
  FireberryError,
  FireberryErrorCode,
  createErrorFromResponse,
  createNetworkError,
} from '../../src/errors';

describe('FireberryError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new FireberryError('Test error', {
        code: FireberryErrorCode.UNKNOWN,
      });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(FireberryErrorCode.UNKNOWN);
      expect(error.name).toBe('FireberryError');
    });

    it('should create error with status code', () => {
      const error = new FireberryError('Not found', {
        code: FireberryErrorCode.NOT_FOUND,
        statusCode: 404,
      });

      expect(error.statusCode).toBe(404);
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new FireberryError('Wrapped error', {
        code: FireberryErrorCode.NETWORK_ERROR,
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it('should create error with context', () => {
      const error = new FireberryError('Error with context', {
        code: FireberryErrorCode.INVALID_REQUEST,
        context: { field: 'accountname', value: 'test' },
      });

      expect(error.context).toEqual({ field: 'accountname', value: 'test' });
    });
  });

  describe('toString', () => {
    it('should format error without status code', () => {
      const error = new FireberryError('Test error', {
        code: FireberryErrorCode.UNKNOWN,
      });

      expect(error.toString()).toBe('FireberryError [UNKNOWN]: Test error');
    });

    it('should format error with status code', () => {
      const error = new FireberryError('Not found', {
        code: FireberryErrorCode.NOT_FOUND,
        statusCode: 404,
      });

      expect(error.toString()).toBe('FireberryError [NOT_FOUND]: Not found (HTTP 404)');
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new FireberryError('Test error', {
        code: FireberryErrorCode.INVALID_REQUEST,
        statusCode: 400,
        context: { param: 'value' },
      });

      const json = error.toJSON();

      expect(json.name).toBe('FireberryError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('INVALID_REQUEST');
      expect(json.statusCode).toBe(400);
      expect(json.context).toEqual({ param: 'value' });
      expect(json.stack).toBeDefined();
    });
  });

  describe('instanceof', () => {
    it('should be instance of Error', () => {
      const error = new FireberryError('Test', { code: FireberryErrorCode.UNKNOWN });
      expect(error instanceof Error).toBe(true);
    });

    it('should be instance of FireberryError', () => {
      const error = new FireberryError('Test', { code: FireberryErrorCode.UNKNOWN });
      expect(error instanceof FireberryError).toBe(true);
    });
  });
});

describe('FireberryErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(FireberryErrorCode.UNKNOWN).toBe('UNKNOWN');
    expect(FireberryErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(FireberryErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(FireberryErrorCode.AUTHENTICATION_FAILED).toBe('AUTHENTICATION_FAILED');
    expect(FireberryErrorCode.AUTHORIZATION_FAILED).toBe('AUTHORIZATION_FAILED');
    expect(FireberryErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(FireberryErrorCode.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(FireberryErrorCode.INVALID_REQUEST).toBe('INVALID_REQUEST');
    expect(FireberryErrorCode.SERVER_ERROR).toBe('SERVER_ERROR');
    expect(FireberryErrorCode.ABORTED).toBe('ABORTED');
    expect(FireberryErrorCode.INVALID_RESPONSE).toBe('INVALID_RESPONSE');
  });
});

describe('createErrorFromResponse', () => {
  const createMockResponse = (status: number): Response => {
    return {
      status,
      ok: status >= 200 && status < 300,
    } as Response;
  };

  it('should create INVALID_REQUEST error for 400', () => {
    const response = createMockResponse(400);
    const error = createErrorFromResponse(response);

    expect(error.code).toBe(FireberryErrorCode.INVALID_REQUEST);
    expect(error.statusCode).toBe(400);
  });

  it('should create AUTHENTICATION_FAILED error for 401', () => {
    const response = createMockResponse(401);
    const error = createErrorFromResponse(response);

    expect(error.code).toBe(FireberryErrorCode.AUTHENTICATION_FAILED);
    expect(error.statusCode).toBe(401);
  });

  it('should create AUTHORIZATION_FAILED error for 403', () => {
    const response = createMockResponse(403);
    const error = createErrorFromResponse(response);

    expect(error.code).toBe(FireberryErrorCode.AUTHORIZATION_FAILED);
    expect(error.statusCode).toBe(403);
  });

  it('should create NOT_FOUND error for 404', () => {
    const response = createMockResponse(404);
    const error = createErrorFromResponse(response);

    expect(error.code).toBe(FireberryErrorCode.NOT_FOUND);
    expect(error.statusCode).toBe(404);
  });

  it('should create RATE_LIMITED error for 429', () => {
    const response = createMockResponse(429);
    const error = createErrorFromResponse(response);

    expect(error.code).toBe(FireberryErrorCode.RATE_LIMITED);
    expect(error.statusCode).toBe(429);
  });

  it('should create SERVER_ERROR error for 5xx', () => {
    const response500 = createMockResponse(500);
    const response503 = createMockResponse(503);

    expect(createErrorFromResponse(response500).code).toBe(FireberryErrorCode.SERVER_ERROR);
    expect(createErrorFromResponse(response503).code).toBe(FireberryErrorCode.SERVER_ERROR);
  });

  it('should create UNKNOWN error for other status codes', () => {
    const response = createMockResponse(418);
    const error = createErrorFromResponse(response);

    expect(error.code).toBe(FireberryErrorCode.UNKNOWN);
  });

  it('should extract message from response body', () => {
    const response = createMockResponse(400);
    const body = { message: 'Custom error message' };
    const error = createErrorFromResponse(response, body);

    expect(error.message).toBe('Custom error message');
  });

  it('should extract error from response body', () => {
    const response = createMockResponse(400);
    const body = { error: 'Error from body' };
    const error = createErrorFromResponse(response, body);

    expect(error.message).toBe('Error from body');
  });
});

describe('createNetworkError', () => {
  it('should create ABORTED error for AbortError', () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    const error = createNetworkError(abortError);

    expect(error.code).toBe(FireberryErrorCode.ABORTED);
    expect(error.message).toBe('Request was aborted');
    expect(error.cause).toBe(abortError);
  });

  it('should create TIMEOUT error for TimeoutError', () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'TimeoutError';

    const error = createNetworkError(timeoutError);

    expect(error.code).toBe(FireberryErrorCode.TIMEOUT);
    expect(error.message).toBe('Request timed out');
  });

  it('should create TIMEOUT error for timeout message', () => {
    const timeoutError = new Error('Connection timeout');

    const error = createNetworkError(timeoutError);

    expect(error.code).toBe(FireberryErrorCode.TIMEOUT);
  });

  it('should create NETWORK_ERROR for other errors', () => {
    const networkError = new Error('Connection refused');

    const error = createNetworkError(networkError);

    expect(error.code).toBe(FireberryErrorCode.NETWORK_ERROR);
    expect(error.message).toBe('Network error: Connection refused');
    expect(error.cause).toBe(networkError);
  });
});
