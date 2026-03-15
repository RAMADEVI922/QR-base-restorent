/**
 * Unit tests for Error Handler
 * Requirements: 10.1, 10.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler } from './errorHandler.js';

describe('ErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    // Clear any existing error containers
    const existing = document.getElementById('error-container');
    if (existing) {
      existing.remove();
    }
  });

  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      const error = new TypeError('Failed to fetch');
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('network');
      expect(result.userMessage).toContain('Unable to connect');
    });

    it('should categorize 400 bad request errors', () => {
      const error = new Error('Bad request');
      error.status = 400;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('validation');
      expect(result.userMessage).toContain('Invalid request');
    });

    it('should categorize 401 authentication errors', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('authentication');
      expect(result.userMessage).toContain('log in');
    });

    it('should categorize 403 authorization errors', () => {
      const error = new Error('Forbidden');
      error.status = 403;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('authorization');
      expect(result.userMessage).toContain('permission');
    });

    it('should categorize 404 not found errors', () => {
      const error = new Error('Not found');
      error.status = 404;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('notFound');
      expect(result.userMessage).toContain('not found');
    });

    it('should categorize 409 conflict errors', () => {
      const error = new Error('Conflict');
      error.status = 409;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('conflict');
      expect(result.userMessage).toContain('conflicts');
    });

    it('should categorize 422 validation errors', () => {
      const error = new Error('Unprocessable entity');
      error.status = 422;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('validation');
      expect(result.userMessage).toContain('invalid');
    });

    it('should categorize 500 server errors', () => {
      const error = new Error('Internal server error');
      error.status = 500;
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('server');
      expect(result.userMessage).toContain('server encountered an error');
    });

    it('should categorize validation errors by name', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('validation');
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Unknown error');
      const result = errorHandler.categorizeError(error);
      
      expect(result.type).toBe('unknown');
      expect(result.userMessage).toContain('unexpected error');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new TypeError('Failed to fetch');
      expect(errorHandler.isRetryableError(error)).toBe(true);
    });

    it('should identify 500 errors as retryable', () => {
      const error = new Error('Server error');
      error.status = 500;
      expect(errorHandler.isRetryableError(error)).toBe(true);
    });

    it('should identify 503 errors as retryable', () => {
      const error = new Error('Service unavailable');
      error.status = 503;
      expect(errorHandler.isRetryableError(error)).toBe(true);
    });

    it('should identify 429 rate limit errors as retryable', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      expect(errorHandler.isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      expect(errorHandler.isRetryableError(error)).toBe(true);
    });

    it('should not identify 400 errors as retryable', () => {
      const error = new Error('Bad request');
      error.status = 400;
      expect(errorHandler.isRetryableError(error)).toBe(false);
    });

    it('should not identify 404 errors as retryable', () => {
      const error = new Error('Not found');
      error.status = 404;
      expect(errorHandler.isRetryableError(error)).toBe(false);
    });
  });

  describe('shouldRetry', () => {
    it('should allow retry for retryable errors', () => {
      const error = new TypeError('Failed to fetch');
      const result = errorHandler.shouldRetry(error, 'test-op', 3, true);
      
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBeGreaterThan(0);
    });

    it('should not allow retry when allowRetry is false', () => {
      const error = new TypeError('Failed to fetch');
      const result = errorHandler.shouldRetry(error, 'test-op', 3, false);
      
      expect(result.shouldRetry).toBe(false);
      expect(result.retryDelay).toBe(0);
    });

    it('should not allow retry for non-retryable errors', () => {
      const error = new Error('Bad request');
      error.status = 400;
      const result = errorHandler.shouldRetry(error, 'test-op', 3, true);
      
      expect(result.shouldRetry).toBe(false);
    });

    it('should not allow retry after max retries exceeded', () => {
      const error = new TypeError('Failed to fetch');
      const operation = 'test-op-max';
      
      // Simulate multiple retries
      errorHandler.shouldRetry(error, operation, 2, true);
      errorHandler.shouldRetry(error, operation, 2, true);
      const result = errorHandler.shouldRetry(error, operation, 2, true);
      
      expect(result.shouldRetry).toBe(false);
    });

    it('should calculate exponential backoff delay', () => {
      const error = new TypeError('Failed to fetch');
      const operation = 'test-op-backoff';
      
      const result1 = errorHandler.shouldRetry(error, operation, 5, true);
      const result2 = errorHandler.shouldRetry(error, operation, 5, true);
      const result3 = errorHandler.shouldRetry(error, operation, 5, true);
      
      expect(result1.retryDelay).toBeLessThan(result2.retryDelay);
      expect(result2.retryDelay).toBeLessThan(result3.retryDelay);
    });
  });

  describe('handleApiError', () => {
    it('should handle network errors', () => {
      const error = new TypeError('Failed to fetch');
      const result = errorHandler.handleApiError(error, {
        operation: 'fetch-data',
        showToUser: false
      });
      
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle server errors', () => {
      const error = new Error('Server error');
      error.status = 500;
      const result = errorHandler.handleApiError(error, {
        operation: 'save-data',
        showToUser: false
      });
      
      expect(result.shouldRetry).toBe(true);
    });

    it('should not retry client errors', () => {
      const error = new Error('Bad request');
      error.status = 400;
      const result = errorHandler.handleApiError(error, {
        operation: 'submit-form',
        showToUser: false
      });
      
      expect(result.shouldRetry).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format string errors', () => {
      const result = errorHandler.formatValidationErrors('Name is required');
      expect(result).toBe('Name is required');
    });

    it('should format array errors', () => {
      const errors = ['Name is required', 'Email is invalid'];
      const result = errorHandler.formatValidationErrors(errors);
      expect(result).toBe('Name is required, Email is invalid');
    });

    it('should format object errors', () => {
      const errors = {
        name: 'Name is required',
        email: 'Email is invalid'
      };
      const result = errorHandler.formatValidationErrors(errors);
      expect(result).toContain('name: Name is required');
      expect(result).toContain('email: Email is invalid');
    });

    it('should handle empty object', () => {
      const result = errorHandler.formatValidationErrors({});
      expect(result).toBe('Validation failed');
    });
  });

  describe('resetRetries', () => {
    it('should reset retry attempts for operation', () => {
      const error = new TypeError('Failed to fetch');
      const operation = 'test-reset';
      
      // Perform some retries
      errorHandler.shouldRetry(error, operation, 5, true);
      errorHandler.shouldRetry(error, operation, 5, true);
      
      // Reset
      errorHandler.resetRetries(operation);
      
      // Should start from 0 again
      const result = errorHandler.shouldRetry(error, operation, 5, true);
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBe(1000); // First retry delay
    });
  });
});
