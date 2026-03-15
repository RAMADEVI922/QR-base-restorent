/**
 * Error Handler
 * Centralized error handling for API and application errors
 * Displays user-friendly error messages
 * Implements retry logic for transient failures
 * Requirements: 10.1, 10.2
 */

class ErrorHandler {
  constructor() {
    this.errorContainer = null;
    this.retryAttempts = new Map(); // Track retry attempts per operation
  }

  /**
   * Initialize error handler with container element
   * @param {string} containerId - ID of error container element
   */
  init(containerId = 'error-container') {
    this.errorContainer = document.getElementById(containerId);
    
    if (!this.errorContainer) {
      // Create error container if it doesn't exist
      this.errorContainer = document.createElement('div');
      this.errorContainer.id = containerId;
      this.errorContainer.className = 'error-container';
      this.errorContainer.setAttribute('role', 'alert');
      this.errorContainer.setAttribute('aria-live', 'assertive');
      document.body.insertBefore(this.errorContainer, document.body.firstChild);
    }
  }

  /**
   * Handle API error and display user-friendly message
   * Requirements: 10.1, 10.2
   * @param {Error} error - Error object
   * @param {Object} options - Error handling options
   * @returns {Object} { shouldRetry: boolean, retryDelay: number }
   */
  handleApiError(error, options = {}) {
    const {
      operation = 'operation',
      showToUser = true,
      allowRetry = true,
      maxRetries = 3
    } = options;

    // Determine error type and user message
    const errorInfo = this.categorizeError(error);
    
    // Check if retry is appropriate
    const retryInfo = this.shouldRetry(error, operation, maxRetries, allowRetry);

    // Display error to user if requested
    if (showToUser) {
      this.displayError(errorInfo.userMessage, {
        type: errorInfo.type,
        canRetry: retryInfo.shouldRetry,
        operation
      });
    }

    // Log detailed error for debugging
    this.logError(error, operation, errorInfo);

    return retryInfo;
  }

  /**
   * Categorize error and generate user-friendly message
   * @param {Error} error - Error object
   * @returns {Object} { type: string, userMessage: string, technicalMessage: string }
   */
  categorizeError(error) {
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'network',
        userMessage: 'Unable to connect to the server. Please check your internet connection.',
        technicalMessage: error.message
      };
    }

    // HTTP errors
    if (error.status) {
      // Client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        return this.categorizeClientError(error);
      }

      // Server errors (5xx)
      if (error.status >= 500) {
        return {
          type: 'server',
          userMessage: 'The server encountered an error. Please try again in a moment.',
          technicalMessage: error.message
        };
      }
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      return {
        type: 'validation',
        userMessage: error.message || 'Please check your input and try again.',
        technicalMessage: error.message
      };
    }

    // Generic errors
    return {
      type: 'unknown',
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message || 'Unknown error'
    };
  }

  /**
   * Categorize client errors (4xx)
   * @param {Error} error - Error object with status
   * @returns {Object} Error info
   */
  categorizeClientError(error) {
    switch (error.status) {
      case 400:
        return {
          type: 'validation',
          userMessage: error.details?.message || 'Invalid request. Please check your input.',
          technicalMessage: error.message
        };
      
      case 401:
        return {
          type: 'authentication',
          userMessage: 'You need to log in to perform this action.',
          technicalMessage: error.message
        };
      
      case 403:
        return {
          type: 'authorization',
          userMessage: 'You do not have permission to perform this action.',
          technicalMessage: error.message
        };
      
      case 404:
        return {
          type: 'notFound',
          userMessage: 'The requested resource was not found.',
          technicalMessage: error.message
        };
      
      case 409:
        return {
          type: 'conflict',
          userMessage: 'This action conflicts with existing data. Please refresh and try again.',
          technicalMessage: error.message
        };
      
      case 422:
        return {
          type: 'validation',
          userMessage: error.details?.message || 'The data provided is invalid.',
          technicalMessage: error.message
        };
      
      default:
        return {
          type: 'client',
          userMessage: 'There was a problem with your request. Please try again.',
          technicalMessage: error.message
        };
    }
  }

  /**
   * Determine if operation should be retried
   * @param {Error} error - Error object
   * @param {string} operation - Operation identifier
   * @param {number} maxRetries - Maximum retry attempts
   * @param {boolean} allowRetry - Whether retry is allowed
   * @returns {Object} { shouldRetry: boolean, retryDelay: number }
   */
  shouldRetry(error, operation, maxRetries, allowRetry) {
    if (!allowRetry) {
      return { shouldRetry: false, retryDelay: 0 };
    }

    // Get current retry count
    const retryKey = operation;
    const currentRetries = this.retryAttempts.get(retryKey) || 0;

    // Check if max retries exceeded
    if (currentRetries >= maxRetries) {
      this.retryAttempts.delete(retryKey);
      return { shouldRetry: false, retryDelay: 0 };
    }

    // Determine if error is retryable
    const isRetryable = this.isRetryableError(error);

    if (isRetryable) {
      // Increment retry count
      this.retryAttempts.set(retryKey, currentRetries + 1);

      // Calculate exponential backoff delay
      const baseDelay = 1000; // 1 second
      const maxDelay = 10000; // 10 seconds
      const delay = Math.min(baseDelay * Math.pow(2, currentRetries), maxDelay);

      return { shouldRetry: true, retryDelay: delay };
    }

    return { shouldRetry: false, retryDelay: 0 };
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if error should trigger retry
   */
  isRetryableError(error) {
    // Network errors are retryable
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Timeout errors are retryable
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return true;
    }

    // Rate limit errors (429) are retryable
    if (error.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Display error message to user
   * @param {string} message - Error message
   * @param {Object} options - Display options
   */
  displayError(message, options = {}) {
    const {
      type = 'error',
      canRetry = false,
      operation = null,
      duration = 5000
    } = options;

    if (!this.errorContainer) {
      this.init();
    }

    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = `error-message error-${type}`;
    errorElement.setAttribute('role', 'alert');

    // Create message content
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    errorElement.appendChild(messageElement);

    // Add retry button if applicable
    if (canRetry && operation) {
      const retryButton = document.createElement('button');
      retryButton.className = 'btn btn-small btn-secondary retry-btn';
      retryButton.textContent = 'Retry';
      retryButton.onclick = () => {
        this.dispatchRetryEvent(operation);
        errorElement.remove();
      };
      errorElement.appendChild(retryButton);
    }

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'error-close';
    closeButton.setAttribute('aria-label', 'Close error message');
    closeButton.textContent = '×';
    closeButton.onclick = () => errorElement.remove();
    errorElement.appendChild(closeButton);

    // Add to container
    this.errorContainer.appendChild(errorElement);

    // Auto-remove after duration (if no retry button)
    if (!canRetry && duration > 0) {
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.remove();
        }
      }, duration);
    }
  }

  /**
   * Display success message to user
   * @param {string} message - Success message
   * @param {number} duration - Display duration in milliseconds
   */
  displaySuccess(message, duration = 3000) {
    if (!this.errorContainer) {
      this.init();
    }

    const successElement = document.createElement('div');
    successElement.className = 'error-message error-success';
    successElement.setAttribute('role', 'status');
    successElement.setAttribute('aria-live', 'polite');

    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    successElement.appendChild(messageElement);

    const closeButton = document.createElement('button');
    closeButton.className = 'error-close';
    closeButton.setAttribute('aria-label', 'Close message');
    closeButton.textContent = '×';
    closeButton.onclick = () => successElement.remove();
    successElement.appendChild(closeButton);

    this.errorContainer.appendChild(successElement);

    if (duration > 0) {
      setTimeout(() => {
        if (successElement.parentNode) {
          successElement.remove();
        }
      }, duration);
    }
  }

  /**
   * Clear all error messages
   */
  clearErrors() {
    if (this.errorContainer) {
      this.errorContainer.innerHTML = '';
    }
  }

  /**
   * Dispatch retry event for operation
   * @param {string} operation - Operation identifier
   */
  dispatchRetryEvent(operation) {
    const event = new CustomEvent('errorRetry', {
      detail: { operation }
    });
    document.dispatchEvent(event);
  }

  /**
   * Log error for debugging
   * @param {Error} error - Error object
   * @param {string} operation - Operation identifier
   * @param {Object} errorInfo - Categorized error info
   */
  logError(error, operation, errorInfo) {
    console.error(`[${operation}] ${errorInfo.type} error:`, {
      userMessage: errorInfo.userMessage,
      technicalMessage: errorInfo.technicalMessage,
      error: error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Reset retry attempts for an operation
   * @param {string} operation - Operation identifier
   */
  resetRetries(operation) {
    this.retryAttempts.delete(operation);
  }

  /**
   * Handle validation errors from backend
   * @param {Object} validationErrors - Validation errors object
   * @returns {string} Formatted error message
   */
  formatValidationErrors(validationErrors) {
    if (typeof validationErrors === 'string') {
      return validationErrors;
    }

    if (Array.isArray(validationErrors)) {
      return validationErrors.join(', ');
    }

    if (typeof validationErrors === 'object') {
      const messages = Object.entries(validationErrors)
        .map(([field, message]) => `${field}: ${message}`)
        .join(', ');
      return messages || 'Validation failed';
    }

    return 'Validation failed';
  }
}

// Create and export default instance
const errorHandler = new ErrorHandler();

export default errorHandler;
export { ErrorHandler };
