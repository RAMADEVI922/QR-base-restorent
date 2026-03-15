/**
 * Unit tests for API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from './apiClient.js';

describe('ApiClient', () => {
  let apiClient;
  let fetchMock;

  // Helper to create mock headers
  const createMockHeaders = (headersMap) => ({
    get: (key) => headersMap.get(key)
  });

  beforeEach(() => {
    apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      maxRetries: 3,
      initialRetryDelay: 100,
      maxRetryDelay: 1000
    });
    
    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET requests', () => {
    it('should perform successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      const headers = new Map([['content-type', 'application/json']]);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key) => headers.get(key)
        },
        json: async () => mockData
      });

      const result = await apiClient.get('/api/test');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockData);
    });

    it('should handle GET request with text response', async () => {
      const headers = new Map([['content-type', 'text/plain']]);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(headers),
        text: async () => 'Success'
      });

      const result = await apiClient.get('/api/test');
      expect(result).toBe('Success');
    });
  });

  describe('POST requests', () => {
    it('should perform successful POST request', async () => {
      const postData = { name: 'New Item' };
      const mockResponse = { id: 1, ...postData };
      const headers = new Map([['content-type', 'application/json']]);
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: createMockHeaders(headers),
        json: async () => mockResponse
      });

      const result = await apiClient.post('/api/items', postData);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/items',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(postData)
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('PUT requests', () => {
    it('should perform successful PUT request', async () => {
      const updateData = { name: 'Updated Item' };
      const mockResponse = { id: 1, ...updateData };
      const headers = new Map([['content-type', 'application/json']]);
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(headers),
        json: async () => mockResponse
      });

      const result = await apiClient.put('/api/items/1', updateData);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/items/1',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(updateData)
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('DELETE requests', () => {
    it('should perform successful DELETE request', async () => {
      const headers = new Map();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: createMockHeaders(headers),
        text: async () => ''
      });

      const result = await apiClient.delete('/api/items/1');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/items/1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should throw error for 404 without retry', async () => {
      const headers = new Map([['content-type', 'application/json']]);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        url: 'http://localhost:3000/api/test',
        headers: createMockHeaders(headers),
        json: async () => ({ message: 'Resource not found' })
      });

      await expect(apiClient.get('/api/test')).rejects.toThrow('HTTP 404: Resource not found');
      expect(fetchMock).toHaveBeenCalledTimes(1); // No retry for 4xx
    });

    it('should throw error for 400 bad request without retry', async () => {
      const headers = new Map([['content-type', 'application/json']]);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        url: 'http://localhost:3000/api/test',
        headers: createMockHeaders(headers),
        json: async () => ({ message: 'Invalid data' })
      });

      await expect(apiClient.post('/api/test', {})).rejects.toThrow('HTTP 400: Invalid data');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should include error details in thrown error', async () => {
      const errorDetails = { message: 'Validation failed', errors: ['field1', 'field2'] };
      const headers = new Map([['content-type', 'application/json']]);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        url: 'http://localhost:3000/api/test',
        headers: createMockHeaders(headers),
        json: async () => errorDetails
      });

      try {
        await apiClient.post('/api/test', {});
      } catch (error) {
        expect(error.status).toBe(422);
        expect(error.details).toEqual(errorDetails);
        expect(error.url).toBe('http://localhost:3000/api/test');
      }
    });
  });

  describe('Retry logic with exponential backoff', () => {
    it('should retry on 500 server error and succeed', async () => {
      const mockData = { success: true };
      const headers = new Map([['content-type', 'application/json']]);
      
      // First call fails with 500
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'http://localhost:3000/api/test',
        headers: createMockHeaders(headers),
        json: async () => ({ message: 'Server error' })
      });
      
      // Second call succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(headers),
        json: async () => mockData
      });

      const result = await apiClient.get('/api/test');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockData);
    });

    it('should retry on network error and succeed', async () => {
      const mockData = { success: true };
      const headers = new Map([['content-type', 'application/json']]);
      
      // First call fails with network error
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      
      // Second call succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(headers),
        json: async () => mockData
      });

      const result = await apiClient.get('/api/test');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockData);
    });

    it('should exhaust retries and throw error', async () => {
      const headers = new Map([['content-type', 'application/json']]);
      // All calls fail with 500
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'http://localhost:3000/api/test',
        headers: createMockHeaders(headers),
        json: async () => ({ message: 'Server error' })
      });

      await expect(apiClient.get('/api/test')).rejects.toThrow('HTTP 500: Server error');
      expect(fetchMock).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should calculate exponential backoff delays correctly', () => {
      expect(apiClient.calculateRetryDelay(0)).toBe(100); // 100 * 2^0
      expect(apiClient.calculateRetryDelay(1)).toBe(200); // 100 * 2^1
      expect(apiClient.calculateRetryDelay(2)).toBe(400); // 100 * 2^2
      expect(apiClient.calculateRetryDelay(3)).toBe(800); // 100 * 2^3
    });

    it('should cap retry delay at maxRetryDelay', () => {
      expect(apiClient.calculateRetryDelay(10)).toBe(1000); // Capped at maxRetryDelay
    });
  });

  describe('Retryable error detection', () => {
    it('should identify network errors as retryable', () => {
      const networkError = new TypeError('Failed to fetch');
      expect(apiClient.isRetryableError(networkError)).toBe(true);
    });

    it('should identify 500 errors as retryable', () => {
      const serverError = new Error('Server error');
      serverError.status = 500;
      expect(apiClient.isRetryableError(serverError)).toBe(true);
    });

    it('should identify 503 errors as retryable', () => {
      const serviceError = new Error('Service unavailable');
      serviceError.status = 503;
      expect(apiClient.isRetryableError(serviceError)).toBe(true);
    });

    it('should not identify 400 errors as retryable', () => {
      const clientError = new Error('Bad request');
      clientError.status = 400;
      expect(apiClient.isRetryableError(clientError)).toBe(false);
    });

    it('should not identify 404 errors as retryable', () => {
      const notFoundError = new Error('Not found');
      notFoundError.status = 404;
      expect(apiClient.isRetryableError(notFoundError)).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when not provided', () => {
      const defaultClient = new ApiClient();
      expect(defaultClient.baseUrl).toBe('');
      expect(defaultClient.maxRetries).toBe(3);
      expect(defaultClient.initialRetryDelay).toBe(1000);
      expect(defaultClient.maxRetryDelay).toBe(10000);
    });

    it('should accept custom configuration', () => {
      const customClient = new ApiClient({
        baseUrl: 'https://api.example.com',
        maxRetries: 5,
        initialRetryDelay: 500,
        maxRetryDelay: 5000
      });
      
      expect(customClient.baseUrl).toBe('https://api.example.com');
      expect(customClient.maxRetries).toBe(5);
      expect(customClient.initialRetryDelay).toBe(500);
      expect(customClient.maxRetryDelay).toBe(5000);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response body', async () => {
      const headers = new Map();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: createMockHeaders(headers),
        text: async () => ''
      });

      const result = await apiClient.get('/api/test');
      expect(result).toBe('');
    });

    it('should handle malformed JSON in error response', async () => {
      const headers = new Map([['content-type', 'application/json']]);
      
      // Mock all retry attempts with the same error
      for (let i = 0; i <= 3; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          url: 'http://localhost:3000/api/test',
          headers: createMockHeaders(headers),
          json: async () => {
            throw new Error('Invalid JSON');
          }
        });
      }

      await expect(apiClient.get('/api/test')).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should preserve custom headers in requests', async () => {
      const headers = new Map([['content-type', 'application/json']]);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders(headers),
        json: async () => ({})
      });

      await apiClient.post('/api/test', {}, {
        headers: { 'X-Custom-Header': 'value' }
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'value'
          })
        })
      );
    });
  });
});
