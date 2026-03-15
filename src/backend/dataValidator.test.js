/**
 * Unit tests for Backend Data Validator
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import dataValidator, { DataValidator } from './dataValidator.js';

describe('DataValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('validateMenuItem', () => {
    it('should validate valid menu item', () => {
      const menuItem = {
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato and mozzarella',
        price: 1299
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject menu item without name', () => {
      const menuItem = {
        description: 'Classic pizza',
        price: 1299
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu item name is required and must be a string');
    });

    it('should reject menu item with empty name', () => {
      const menuItem = {
        name: '   ',
        description: 'Classic pizza',
        price: 1299
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu item name cannot be empty');
    });

    it('should reject menu item with name too long', () => {
      const menuItem = {
        name: 'A'.repeat(101),
        description: 'Classic pizza',
        price: 1299
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu item name must be at most 100 characters');
    });

    it('should reject menu item without description', () => {
      const menuItem = {
        name: 'Pizza',
        price: 1299
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description is required and must be a string');
    });

    it('should reject menu item with negative price', () => {
      const menuItem = {
        name: 'Pizza',
        description: 'Classic pizza',
        price: -100
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Price cannot be negative');
    });

    it('should reject menu item with non-integer price', () => {
      const menuItem = {
        name: 'Pizza',
        description: 'Classic pizza',
        price: 12.99
      };

      const result = validator.validateMenuItem(menuItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Price must be an integer (in cents)');
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
      expect(result.errors.length).toBe(0);
    });

    it('should reject order without tableId', () => {
      const order = {
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
      expect(result.errors).toContain('Table ID is required and must be a string');
    });

    it('should reject order without items', () => {
      const order = {
        tableId: 'table-1',
        items: []
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Order must contain at least one item');
    });

    it('should reject order with invalid status', () => {
      const order = {
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1299,
            name: 'Pizza'
          }
        ],
        status: 'invalid'
      };

      const result = validator.validateOrder(order);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Status must be one of'))).toBe(true);
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
      expect(result.errors.length).toBe(0);
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
      expect(result.errors).toContain('Quantity must be positive');
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
      expect(result.errors).toContain('Quantity must be an integer');
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid transition from pending to preparing', () => {
      const result = validator.validateStatusTransition('pending', 'preparing');
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject invalid transition from pending to ready', () => {
      const result = validator.validateStatusTransition('pending', 'ready');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot transition from pending to ready');
    });

    it('should reject transition from completed', () => {
      const result = validator.validateStatusTransition('completed', 'pending');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot transition from completed to pending');
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes', () => {
      const input = 'test\0string';
      const result = validator.sanitizeString(input);
      expect(result).toBe('teststring');
    });

    it('should trim whitespace', () => {
      const input = '  test string  ';
      const result = validator.sanitizeString(input);
      expect(result).toBe('test string');
    });

    it('should return non-string values unchanged', () => {
      expect(validator.sanitizeString(123)).toBe(123);
      expect(validator.sanitizeString(null)).toBe(null);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string properties', () => {
      const obj = {
        name: '  test  ',
        description: 'desc\0ription',
        price: 100
      };

      const result = validator.sanitizeObject(obj);
      expect(result.name).toBe('test');
      expect(result.description).toBe('description');
      expect(result.price).toBe(100);
    });

    it('should sanitize nested objects', () => {
      const obj = {
        item: {
          name: '  nested  '
        }
      };

      const result = validator.sanitizeObject(obj);
      expect(result.item.name).toBe('nested');
    });

    it('should sanitize arrays', () => {
      const obj = {
        items: ['  item1  ', '  item2  ']
      };

      const result = validator.sanitizeObject(obj);
      expect(result.items[0]).toBe('item1');
      expect(result.items[1]).toBe('item2');
    });
  });

  describe('validateId', () => {
    it('should validate valid ID', () => {
      const result = validator.validateId('item-123', 'Menu Item');
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject empty ID', () => {
      const result = validator.validateId('', 'Menu Item');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu Item ID cannot be empty');
    });

    it('should reject non-string ID', () => {
      const result = validator.validateId(123, 'Menu Item');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu Item ID is required and must be a string');
    });
  });

  describe('validatePaginationParams', () => {
    it('should validate valid pagination params', () => {
      const params = { limit: 10, offset: 20 };
      const result = validator.validatePaginationParams(params);
      
      expect(result.valid).toBe(true);
      expect(result.sanitized.limit).toBe(10);
      expect(result.sanitized.offset).toBe(20);
    });

    it('should use default values when params not provided', () => {
      const result = validator.validatePaginationParams({});
      
      expect(result.valid).toBe(true);
      expect(result.sanitized.limit).toBe(20);
      expect(result.sanitized.offset).toBe(0);
    });

    it('should reject limit exceeding maximum', () => {
      const params = { limit: 150 };
      const result = validator.validatePaginationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Limit cannot exceed 100');
    });

    it('should reject negative offset', () => {
      const params = { offset: -5 };
      const result = validator.validatePaginationParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Offset must be a non-negative integer');
    });
  });
});
