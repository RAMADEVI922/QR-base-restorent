/**
 * HTTP Client for API calls
 * Provides GET, POST, PUT, DELETE methods with error handling and retry logic
 * 
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Proper error handling for 4xx and 5xx responses
 * - Promise-based async operations
 * - Configurable retry attempts and delays
 */

class ApiClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '';
    this.maxRetries = config.maxRetries || 3;
    this.initialRetryDelay = config.initialRetryDelay || 1000; // 1 second
    this.maxRetryDelay = config.maxRetryDelay || 10000; // 10 seconds
  }

  /**
   * Perform GET request
   * @param {string} url - The endpoint URL
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async get(url, options = {}) {
    return this.request(url, {
      ...options,
      method: 'GET'
    });
  }

  /**
   * Perform POST request
   * @param {string} url - The endpoint URL
   * @param {any} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });
  }

  /**
   * Perform PUT request
   * @param {string} url - The endpoint URL
   * @param {any} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });
  }

  /**
   * Perform DELETE request
   * @param {string} url - The endpoint URL
   * @param {Object} options - Additional fetch options
   * @returns {Promise<any>} Response data
   */
  async delete(url, options = {}) {
    return this.request(url, {
      ...options,
      method: 'DELETE'
    });
  }

  /**
   * Core request method with retry logic and error handling
   * @param {string} url - The endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(url, options = {}) {
    const fullUrl = this.baseUrl + url;
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(fullUrl, options);

        // Handle successful responses (2xx)
        if (response.ok) {
          return await this.parseResponse(response);
        }

        // Handle client errors (4xx) - don't retry
        if (response.status >= 400 && response.status < 500) {
          throw await this.createHttpError(response);
        }

        // Handle server errors (5xx) - retry
        if (response.status >= 500) {
          lastError = await this.createHttpError(response);
          
          // Don't retry on last attempt
          if (attempt < this.maxRetries) {
            await this.delay(this.calculateRetryDelay(attempt));
            continue;
          }
          
          throw lastError;
        }

      } catch (error) {
        // Network errors or other exceptions
        if (this.isRetryableError(error)) {
          lastError = error;
          
          // Don't retry on last attempt
          if (attempt < this.maxRetries) {
            await this.delay(this.calculateRetryDelay(attempt));
            continue;
          }
        }
        
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Parse response based on content type
   * @param {Response} response - Fetch response object
   * @returns {Promise<any>} Parsed response data
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }

  /**
   * Create detailed HTTP error object
   * @param {Response} response - Fetch response object
   * @returns {Promise<Error>} HTTP error with details
   */
  async createHttpError(response) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorDetails = null;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorDetails = await response.json();
        if (errorDetails.message) {
          errorMessage = `HTTP ${response.status}: ${errorDetails.message}`;
        }
      } else {
        const text = await response.text();
        if (text) {
          errorMessage = `HTTP ${response.status}: ${text}`;
        }
      }
    } catch (parseError) {
      // If parsing fails, use default error message
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    error.statusText = response.statusText;
    error.details = errorDetails;
    error.url = response.url;
    
    return error;
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current retry attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    const delay = this.initialRetryDelay * Math.pow(2, attempt);
    return Math.min(delay, this.maxRetryDelay);
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if error should trigger retry
   */
  isRetryableError(error) {
    // Network errors (no response received)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }
    
    // Server errors (5xx)
    if (error.status >= 500) {
      return true;
    }
    
    return false;
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create and export default instance
const apiClient = new ApiClient();

export default apiClient;
export { ApiClient };
