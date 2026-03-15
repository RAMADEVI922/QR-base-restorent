/**
 * Unit tests for Input Validation Layer
 * Requirements: 2.5, 3.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator } from './inputValidator.js';

describe('InputValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('validateField', () => {
    it('should validate required fields', () => {
      const result = validator.validateField('', { required: true }, 'Name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should pass validation for non-empty required fields', () => {
      const result = validator.validateField('John', { required: true }, 'Name');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should validate minLength', () => {
      const result = validator.validateField('ab', { minLength: 3 }, 'Name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at least 3 characters');
    });

    it('should validate maxLength', () => {
      const result = validator.validateField('abcdef', { maxLength: 5 }, 'Name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at most 5 characters');
    });

    it('should validate number type', () => {
      const result = validator.validateField('abc', { number: true }, 'Price');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Price must be a valid number');
    });

    it('should validate integer type', () => {
      const result = validator.validateField('3.14', { integer: true }, 'Quantity');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Quantity must be a whole number');
    });

    it('should validate min value', () => {
      const result = validator.validateField('5', { min: 10 }, 'Age');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Age must be at least 10');
    });

    it('should validate max value', () => {
      const result = validator.validateField('15', { max: 10 }, 'Age');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Age must be at most 10');
    });

    it('should validate positive numbers', () => {
      const result = validator.validateField('-5', { positive: true }, 'Quantity');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Quantity must be a positive number');
    });

    it('should validate non-negative numbers', () => {
      const result = validator.validateField('-1', { nonNegative: true }, 'Price');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Price cannot be negative');
    });

    it('should validate email format', () => {
      const result = validator.validateField('invalid-email', { email: true }, 'Email');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email must be a valid email address');
    });

    it('should validate pattern', () => {
      const result = validator.validateField('abc', { pattern: '^[0-9]+$' }, 'Code');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code format is invalid');
    });

    it('should use custom pattern message', () => {
      const result = validator.validateField('abc', { 
        pattern: '^[0-9]+$',
        patternMessage: 'Code must contain only digits'
      }, 'Code');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Code must contain only digits');
    });

    it('should validate with custom function', () => {
      const customValidator = (value) => value === 'valid' || 'Value must be "valid"';
      const result = validator.validateField('invalid', { custom: customValidator }, 'Field');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Value must be "valid"');
    });

    it('should skip validation for non-required empty fields', () => {
      const result = validator.validateField('', { minLength: 5 }, 'Optional');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  describe('validateForm', () => {
    it('should validate multiple fields', () => {
      const data = {
        name: '',
        age: 'abc',
        email: 'invalid'
      };

      const schema = {
        name: { required: true, displayName: 'Name' },
        age: { required: true, number: true, displayName: 'Age' },
        email: { required: true, email: true, displayName: 'Email' }
      };

      const result = validator.validateForm(data, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe('Name is required');
      expect(result.errors.age).toBe('Age must be a valid number');
      expect(result.errors.email).toBe('Email must be a valid email address');
    });

    it('should pass validation for valid form data', () => {
      const data = {
        name: 'John Doe',
        age: '25',
        email: 'john@example.com'
      };

      const schema = {
        name: { required: true, displayName: 'Name' },
        age: { required: true, number: true, displayName: 'Age' },
        email: { required: true, email: true, displayName: 'Email' }
      };

      const result = validator.validateForm(data, schema);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });
  });

  describe('validateMenuItem', () => {
    it('should validate valid menu item', () => {
      const menuItem = {
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato and mozzarella',
        price: 12.99
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should reject menu item with empty name', () => {
      const menuItem = {
        name: '',
        description: 'Classic pizza',
        price: 12.99
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe('Menu item name is required');
    });

    it('should reject menu item with empty description', () => {
      const menuItem = {
        name: 'Pizza',
        description: '',
        price: 12.99
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors.description).toBe('Description is required');
    });

    it('should reject menu item with negative price', () => {
      const menuItem = {
        name: 'Pizza',
        description: 'Classic pizza',
        price: -5
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBe('Price cannot be negative');
    });

    it('should reject menu item with invalid price', () => {
      const menuItem = {
        name: 'Pizza',
        description: 'Classic pizza',
        price: 'invalid'
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBe('Price must be a valid number');
    });

    it('should reject menu item with name too long', () => {
      const menuItem = {
        name: 'A'.repeat(101),
        description: 'Classic pizza',
        price: 12.99
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe('Menu item name must be at most 100 characters');
    });

    it('should reject menu item with description too long', () => {
      const menuItem = {
        name: 'Pizza',
        description: 'A'.repeat(501),
        price: 12.99
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors.description).toBe('Description must be at most 500 characters');
    });
  });

  describe('validateOrder', () => {
    it('should validate valid order', () => {
      const order = {
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1299,
            name: 'Pizza'
          }
        ]
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should reject order without tableId', () => {
      const order = {
        tableId: '',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1299,
            name: 'Pizza'
          }
        ]
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(result.errors.tableId).toBe('Table ID is required');
    });

    it('should reject order without items', () => {
      const order = {
        tableId: 'table-1',
        items: []
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(result.errors.items).toBe('Order must contain at least one item');
    });

    it('should reject order with invalid items array', () => {
      const order = {
        tableId: 'table-1',
        items: null
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(result.errors.items).toBe('Order must contain items');
    });

    it('should reject order with invalid item data', () => {
      const order = {
        tableId: 'table-1',
        items: [
          {
            menuItemId: '',
            quantity: -1,
            price: 'invalid',
            name: ''
          }
        ]
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(Array.isArray(result.errors.items)).toBe(true);
    });
  });

  describe('validateOrderItem', () => {
    it('should validate valid order item', () => {
      const item = {
        menuItemId: 'item-1',
        quantity: 2,
        price: 1299,
        name: 'Pizza'
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should reject item without menuItemId', () => {
      const item = {
        menuItemId: '',
        quantity: 2,
        price: 1299,
        name: 'Pizza'
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.menuItemId).toBe('Menu item ID is required');
    });

    it('should reject item with zero quantity', () => {
      const item = {
        menuItemId: 'item-1',
        quantity: 0,
        price: 1299,
        name: 'Pizza'
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.quantity).toBe('Quantity must be a positive number');
    });

    it('should reject item with negative quantity', () => {
      const item = {
        menuItemId: 'item-1',
        quantity: -1,
        price: 1299,
        name: 'Pizza'
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.quantity).toBe('Quantity must be a positive number');
    });

    it('should reject item with fractional quantity', () => {
      const item = {
        menuItemId: 'item-1',
        quantity: 2.5,
        price: 1299,
        name: 'Pizza'
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.quantity).toBe('Quantity must be a whole number');
    });

    it('should reject item with negative price', () => {
      const item = {
        menuItemId: 'item-1',
        quantity: 2,
        price: -100,
        name: 'Pizza'
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.price).toBe('Price cannot be negative');
    });

    it('should reject item without name', () => {
      const item = {
        menuItemId: 'item-1',
        quantity: 2,
        price: 1299,
        name: ''
      };

      const result = validator.validateOrderItem(item);
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe('Item name is required');
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid transition from pending to preparing', () => {
      const result = validator.validateStatusTransition('pending', 'preparing');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should allow valid transition from preparing to ready', () => {
      const result = validator.validateStatusTransition('preparing', 'ready');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should allow valid transition from ready to served', () => {
      const result = validator.validateStatusTransition('ready', 'served');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should allow valid transition from served to completed', () => {
      const result = validator.validateStatusTransition('served', 'completed');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should reject invalid transition from pending to ready', () => {
      const result = validator.validateStatusTransition('pending', 'ready');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot transition from pending to ready');
    });

    it('should reject invalid transition from ready to pending', () => {
      const result = validator.validateStatusTransition('ready', 'pending');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot transition from ready to pending');
    });

    it('should reject transition from completed', () => {
      const result = validator.validateStatusTransition('completed', 'pending');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot transition from completed to pending');
    });

    it('should reject invalid current status', () => {
      const result = validator.validateStatusTransition('invalid', 'preparing');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid current status: invalid');
    });
  });

  describe('sanitizeString', () => {
    it('should sanitize HTML tags', () => {
      const input = '<script>alert("xss")</script>';
      const result = validator.sanitizeString(input);
      expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should sanitize special characters', () => {
      const input = '<div>Test & "quotes"</div>';
      const result = validator.sanitizeString(input);
      expect(result).toBe('&lt;div&gt;Test &amp; "quotes"&lt;/div&gt;');
    });

    it('should return non-string values unchanged', () => {
      expect(validator.sanitizeString(123)).toBe(123);
      expect(validator.sanitizeString(null)).toBe(null);
      expect(validator.sanitizeString(undefined)).toBe(undefined);
    });
  });
});
