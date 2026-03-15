/**
 * Backend Data Validator
 * Validates all incoming API requests and data before persistence
 * Returns appropriate error responses
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

class DataValidator {
  /**
   * Validate menu item data
   * Requirements: 10.3, 10.4
   * @param {Object} menuItem - Menu item data
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateMenuItem(menuItem) {
    const errors = [];

    // Validate name
    if (!menuItem.name || typeof menuItem.name !== 'string') {
      errors.push('Menu item name is required and must be a string');
    } else if (menuItem.name.trim().length === 0) {
      errors.push('Menu item name cannot be empty');
    } else if (menuItem.name.length > 100) {
      errors.push('Menu item name must be at most 100 characters');
    }

    // Validate description
    if (!menuItem.description || typeof menuItem.description !== 'string') {
      errors.push('Description is required and must be a string');
    } else if (menuItem.description.trim().length === 0) {
      errors.push('Description cannot be empty');
    } else if (menuItem.description.length > 500) {
      errors.push('Description must be at most 500 characters');
    }

    // Validate price
    if (menuItem.price === undefined || menuItem.price === null) {
      errors.push('Price is required');
    } else if (typeof menuItem.price !== 'number') {
      errors.push('Price must be a number');
    } else if (isNaN(menuItem.price)) {
      errors.push('Price must be a valid number');
    } else if (menuItem.price < 0) {
      errors.push('Price cannot be negative');
    } else if (!Number.isInteger(menuItem.price)) {
      errors.push('Price must be an integer (in cents)');
    }

    // Validate available (if provided)
    if (menuItem.available !== undefined && typeof menuItem.available !== 'boolean') {
      errors.push('Available must be a boolean');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate order data
   * Requirements: 10.1, 10.2
   * @param {Object} order - Order data
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateOrder(order) {
    const errors = [];

    // Validate tableId
    if (!order.tableId || typeof order.tableId !== 'string') {
      errors.push('Table ID is required and must be a string');
    } else if (order.tableId.trim().length === 0) {
      errors.push('Table ID cannot be empty');
    }

    // Validate items
    if (!order.items || !Array.isArray(order.items)) {
      errors.push('Items must be an array');
    } else if (order.items.length === 0) {
      errors.push('Order must contain at least one item');
    } else {
      // Validate each item
      order.items.forEach((item, index) => {
        const itemErrors = this.validateOrderItem(item);
        if (!itemErrors.valid) {
          itemErrors.errors.forEach(error => {
            errors.push(`Item ${index + 1}: ${error}`);
          });
        }
      });
    }

    // Validate status (if provided)
    if (order.status !== undefined) {
      const validStatuses = ['pending', 'preparing', 'ready', 'served', 'completed'];
      if (!validStatuses.includes(order.status)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate order item data
   * Requirements: 10.1, 10.2
   * @param {Object} item - Order item data
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateOrderItem(item) {
    const errors = [];

    // Validate menuItemId
    if (!item.menuItemId || typeof item.menuItemId !== 'string') {
      errors.push('Menu item ID is required and must be a string');
    } else if (item.menuItemId.trim().length === 0) {
      errors.push('Menu item ID cannot be empty');
    }

    // Validate quantity
    if (item.quantity === undefined || item.quantity === null) {
      errors.push('Quantity is required');
    } else if (typeof item.quantity !== 'number') {
      errors.push('Quantity must be a number');
    } else if (!Number.isInteger(item.quantity)) {
      errors.push('Quantity must be an integer');
    } else if (item.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    // Validate price
    if (item.price === undefined || item.price === null) {
      errors.push('Price is required');
    } else if (typeof item.price !== 'number') {
      errors.push('Price must be a number');
    } else if (isNaN(item.price)) {
      errors.push('Price must be a valid number');
    } else if (item.price < 0) {
      errors.push('Price cannot be negative');
    } else if (!Number.isInteger(item.price)) {
      errors.push('Price must be an integer (in cents)');
    }

    // Validate name
    if (!item.name || typeof item.name !== 'string') {
      errors.push('Item name is required and must be a string');
    } else if (item.name.trim().length === 0) {
      errors.push('Item name cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate table data
   * Requirements: 10.3, 10.4
   * @param {Object} table - Table data
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateTable(table) {
    const errors = [];

    // Validate id (if provided for updates)
    if (table.id !== undefined) {
      if (typeof table.id !== 'string') {
        errors.push('Table ID must be a string');
      } else if (table.id.trim().length === 0) {
        errors.push('Table ID cannot be empty');
      }
    }

    // Validate status (if provided)
    if (table.status !== undefined) {
      const validStatuses = ['active', 'inactive'];
      if (!validStatuses.includes(table.status)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Validate qrCode (if provided)
    if (table.qrCode !== undefined) {
      if (typeof table.qrCode !== 'string') {
        errors.push('QR code must be a string');
      } else if (table.qrCode.trim().length === 0) {
        errors.push('QR code cannot be empty');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate order status transition
   * @param {string} currentStatus - Current order status
   * @param {string} newStatus - New order status
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateStatusTransition(currentStatus, newStatus) {
    const errors = [];

    const validTransitions = {
      'pending': ['preparing'],
      'preparing': ['ready'],
      'ready': ['served'],
      'served': ['completed'],
      'completed': []
    };

    if (!validTransitions[currentStatus]) {
      errors.push(`Invalid current status: ${currentStatus}`);
      return { valid: false, errors };
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      errors.push(`Cannot transition from ${currentStatus} to ${newStatus}`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Sanitize string input to prevent injection attacks
   * @param {string} input - Input string
   * @returns {string} Sanitized string
   */
  sanitizeString(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Sanitize object by sanitizing all string properties
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? this.sanitizeObject(item) : 
          typeof item === 'string' ? this.sanitizeString(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Create validation error response
   * @param {Array} errors - Array of error messages
   * @returns {Object} Error response object
   */
  createValidationErrorResponse(errors) {
    return {
      error: 'Validation failed',
      message: errors.length === 1 ? errors[0] : 'Multiple validation errors occurred',
      details: errors,
      status: 400
    };
  }

  /**
   * Validate request body exists
   * @param {Object} body - Request body
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateRequestBody(body) {
    if (!body || typeof body !== 'object') {
      return {
        valid: false,
        errors: ['Request body is required']
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate ID parameter
   * @param {string} id - ID parameter
   * @param {string} resourceName - Name of resource for error message
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateId(id, resourceName = 'Resource') {
    const errors = [];

    if (id === undefined || id === null || typeof id !== 'string') {
      errors.push(`${resourceName} ID is required and must be a string`);
    } else if (id.trim().length === 0) {
      errors.push(`${resourceName} ID cannot be empty`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @returns {Object} { valid: boolean, errors: Array, sanitized: Object }
   */
  validatePaginationParams(params) {
    const errors = [];
    const sanitized = {};

    // Validate limit
    if (params.limit !== undefined) {
      const limit = parseInt(params.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        errors.push('Limit must be a positive integer');
      } else if (limit > 100) {
        errors.push('Limit cannot exceed 100');
      } else {
        sanitized.limit = limit;
      }
    } else {
      sanitized.limit = 20; // Default limit
    }

    // Validate offset
    if (params.offset !== undefined) {
      const offset = parseInt(params.offset, 10);
      if (isNaN(offset) || offset < 0) {
        errors.push('Offset must be a non-negative integer');
      } else {
        sanitized.offset = offset;
      }
    } else {
      sanitized.offset = 0; // Default offset
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }
}

// Create and export default instance
const dataValidator = new DataValidator();

export default dataValidator;
export { DataValidator };

