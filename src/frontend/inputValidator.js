/**
 * Input Validation Layer
 * Validates all user inputs before submission
 * Displays user-friendly error messages
 * Prevents invalid data from reaching API
 * Requirements: 2.5, 3.1
 */

class InputValidator {
  constructor() {
    this.validationRules = {
      required: (value) => value !== null && value !== undefined && value.toString().trim() !== '',
      minLength: (value, min) => value.toString().length >= min,
      maxLength: (value, max) => value.toString().length <= max,
      min: (value, min) => Number(value) >= min,
      max: (value, max) => Number(value) <= max,
      number: (value) => !isNaN(Number(value)),
      integer: (value) => Number.isInteger(Number(value)),
      positive: (value) => Number(value) > 0,
      nonNegative: (value) => Number(value) >= 0,
      email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      pattern: (value, pattern) => new RegExp(pattern).test(value)
    };
  }

  /**
   * Validate a single field
   * @param {any} value - Field value to validate
   * @param {Object} rules - Validation rules
   * @param {string} fieldName - Human-readable field name for error messages
   * @returns {Object} { valid: boolean, error: string|null }
   */
  validateField(value, rules, fieldName = 'Field') {
    // Check required rule first
    if (rules.required && !this.validationRules.required(value)) {
      return {
        valid: false,
        error: `${fieldName} is required`
      };
    }

    // If not required and empty, skip other validations
    if (!rules.required && !this.validationRules.required(value)) {
      return { valid: true, error: null };
    }

    // Check minLength
    if (rules.minLength !== undefined && !this.validationRules.minLength(value, rules.minLength)) {
      return {
        valid: false,
        error: `${fieldName} must be at least ${rules.minLength} characters`
      };
    }

    // Check maxLength
    if (rules.maxLength !== undefined && !this.validationRules.maxLength(value, rules.maxLength)) {
      return {
        valid: false,
        error: `${fieldName} must be at most ${rules.maxLength} characters`
      };
    }

    // Check number
    if (rules.number && !this.validationRules.number(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a valid number`
      };
    }

    // Check integer
    if (rules.integer && !this.validationRules.integer(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a whole number`
      };
    }

    // Check min
    if (rules.min !== undefined && !this.validationRules.min(value, rules.min)) {
      return {
        valid: false,
        error: `${fieldName} must be at least ${rules.min}`
      };
    }

    // Check max
    if (rules.max !== undefined && !this.validationRules.max(value, rules.max)) {
      return {
        valid: false,
        error: `${fieldName} must be at most ${rules.max}`
      };
    }

    // Check positive
    if (rules.positive && !this.validationRules.positive(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a positive number`
      };
    }

    // Check nonNegative
    if (rules.nonNegative && !this.validationRules.nonNegative(value)) {
      return {
        valid: false,
        error: `${fieldName} cannot be negative`
      };
    }

    // Check email
    if (rules.email && !this.validationRules.email(value)) {
      return {
        valid: false,
        error: `${fieldName} must be a valid email address`
      };
    }

    // Check pattern
    if (rules.pattern && !this.validationRules.pattern(value, rules.pattern)) {
      return {
        valid: false,
        error: rules.patternMessage || `${fieldName} format is invalid`
      };
    }

    // Custom validator function
    if (rules.custom && typeof rules.custom === 'function') {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        return {
          valid: false,
          error: typeof customResult === 'string' ? customResult : `${fieldName} is invalid`
        };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Validate multiple fields
   * @param {Object} data - Object with field values
   * @param {Object} schema - Object with validation rules for each field
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validateForm(data, schema) {
    const errors = {};
    let isValid = true;

    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = data[fieldName];
      const displayName = rules.displayName || fieldName;
      const result = this.validateField(value, rules, displayName);

      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
      }
    }

    return { valid: isValid, errors };
  }

  /**
   * Validate menu item data
   * Requirements: 2.5
   * @param {Object} menuItem - Menu item data
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validateMenuItem(menuItem) {
    const schema = {
      name: {
        required: true,
        minLength: 1,
        maxLength: 100,
        displayName: 'Menu item name'
      },
      description: {
        required: true,
        minLength: 1,
        maxLength: 500,
        displayName: 'Description'
      },
      price: {
        required: true,
        number: true,
        nonNegative: true,
        displayName: 'Price'
      }
    };

    return this.validateForm(menuItem, schema);
  }

  /**
   * Validate order data
   * Requirements: 3.1
   * @param {Object} order - Order data
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validateOrder(order) {
    const errors = {};
    let isValid = true;

    // Validate tableId
    if (!order.tableId || order.tableId.trim() === '') {
      errors.tableId = 'Table ID is required';
      isValid = false;
    }

    // Validate items array
    if (!order.items || !Array.isArray(order.items)) {
      errors.items = 'Order must contain items';
      isValid = false;
    } else if (order.items.length === 0) {
      errors.items = 'Order must contain at least one item';
      isValid = false;
    } else {
      // Validate each item
      const itemErrors = [];
      order.items.forEach((item, index) => {
        const itemValidation = this.validateOrderItem(item);
        if (!itemValidation.valid) {
          itemErrors.push({ index, errors: itemValidation.errors });
          isValid = false;
        }
      });

      if (itemErrors.length > 0) {
        errors.items = itemErrors;
      }
    }

    return { valid: isValid, errors };
  }

  /**
   * Validate order item data
   * Requirements: 3.1
   * @param {Object} item - Order item data
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validateOrderItem(item) {
    const schema = {
      menuItemId: {
        required: true,
        displayName: 'Menu item ID'
      },
      quantity: {
        required: true,
        number: true,
        integer: true,
        positive: true,
        displayName: 'Quantity'
      },
      price: {
        required: true,
        number: true,
        nonNegative: true,
        displayName: 'Price'
      },
      name: {
        required: true,
        minLength: 1,
        displayName: 'Item name'
      }
    };

    return this.validateForm(item, schema);
  }

  /**
   * Validate table data
   * @param {Object} table - Table data
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validateTable(table) {
    const schema = {
      id: {
        required: true,
        minLength: 1,
        displayName: 'Table ID'
      }
    };

    return this.validateForm(table, schema);
  }

  /**
   * Validate order status transition
   * @param {string} currentStatus - Current order status
   * @param {string} newStatus - New order status
   * @returns {Object} { valid: boolean, error: string|null }
   */
  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'pending': ['preparing'],
      'preparing': ['ready'],
      'ready': ['served'],
      'served': ['completed'],
      'completed': []
    };

    if (!validTransitions[currentStatus]) {
      return {
        valid: false,
        error: `Invalid current status: ${currentStatus}`
      };
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return {
        valid: false,
        error: `Cannot transition from ${currentStatus} to ${newStatus}`
      };
    }

    return { valid: true, error: null };
  }

  /**
   * Sanitize string input to prevent XSS
   * @param {string} input - Input string
   * @returns {string} Sanitized string
   */
  sanitizeString(input) {
    if (typeof input !== 'string') {
      return input;
    }

    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Display validation errors on a form
   * @param {HTMLFormElement} form - Form element
   * @param {Object} errors - Validation errors object
   */
  displayFormErrors(form, errors) {
    // Clear existing errors
    this.clearFormErrors(form);

    // Display new errors
    for (const [fieldName, errorMessage] of Object.entries(errors)) {
      const field = form.elements[fieldName];
      if (field) {
        this.displayFieldError(field, errorMessage);
      }
    }
  }

  /**
   * Display error for a specific field
   * @param {HTMLElement} field - Form field element
   * @param {string} errorMessage - Error message
   */
  displayFieldError(field, errorMessage) {
    // Add error class to field
    field.classList.add('field-error');
    field.setAttribute('aria-invalid', 'true');

    // Create or update error message element
    let errorElement = field.parentElement.querySelector('.field-error-message');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'field-error-message';
      errorElement.setAttribute('role', 'alert');
      field.parentElement.appendChild(errorElement);
    }

    errorElement.textContent = errorMessage;
  }

  /**
   * Clear all validation errors from a form
   * @param {HTMLFormElement} form - Form element
   */
  clearFormErrors(form) {
    // Remove error classes from fields
    const errorFields = form.querySelectorAll('.field-error');
    errorFields.forEach(field => {
      field.classList.remove('field-error');
      field.removeAttribute('aria-invalid');
    });

    // Remove error message elements
    const errorMessages = form.querySelectorAll('.field-error-message');
    errorMessages.forEach(message => message.remove());
  }

  /**
   * Clear error for a specific field
   * @param {HTMLElement} field - Form field element
   */
  clearFieldError(field) {
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');

    const errorElement = field.parentElement.querySelector('.field-error-message');
    if (errorElement) {
      errorElement.remove();
    }
  }
}

// Create and export default instance
const inputValidator = new InputValidator();

export default inputValidator;
export { InputValidator };
