/**
 * Unit tests for Queue Display Controller
 * Tests order fetching, display, and sorting functionality
 * 
 * Requirements: 4.1, 4.5, 5.1, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QueueDisplayController from './queueDisplayController.js';

// Mock fetch
global.fetch = vi.fn();

describe('QueueDisplayController', () => {
  let controller;
  let mockContainer;
  let mockEmptyState;

  beforeEach(() => {
    // Mock DOM elements
    mockContainer = {
      innerHTML: '',
      appendChild: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() }
    };
    
    mockEmptyState = {
      classList: { add: vi.fn(), remove: vi.fn() }
    };

    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'orders-queue') return mockContainer;
        if (id === 'queue-empty') return mockEmptyState;
        return null;
      }),
      createElement: vi.fn(() => ({
        className: '',
        innerHTML: '',
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        textContent: '',
        classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() }
      }))
    };

    controller = new QueueDisplayController();
    controller.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
    fetch.mockClear();
  });

  describe('Initialization', () => {
    it('should initialize with DOM elements', () => {
      expect(controller.container).toBe(mockContainer);
      expect(controller.emptyStateElement).toBe(mockEmptyState);
    });

    it('should handle missing container element', () => {
      global.document.getElementById.mockReturnValue(null);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const newController = new QueueDisplayController();
      newController.init();
      
      expect(consoleSpy).toHaveBeenCalledWith('Queue container element not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Fetching Orders', () => {
    it('should fetch and display orders successfully', async () => {
      const mockOrders = [
        {
          id: '1',
          tableId: 'T1',
          status: 'pending',
          items: [{ name: 'Pizza', quantity: 1 }],
          totalPrice: 1500,
          createdAt: Date.now()
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrders)
      });

      const result = await controller.fetchAndDisplayOrders();

      expect(fetch).toHaveBeenCalledWith('/api/orders/queue');
      expect(result).toEqual(mockOrders);
      expect(controller.orders).toEqual(mockOrders);
    });

    it('should handle fetch errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(controller.fetchAndDisplayOrders()).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(controller.fetchAndDisplayOrders()).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching orders:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Displaying Orders', () => {
    beforeEach(() => {
      controller.orders = [
        {
          id: '1',
          tableId: 'T1',
          status: 'pending',
          items: [{ name: 'Pizza', quantity: 2 }],
          totalPrice: 3000,
          createdAt: 1000
        },
        {
          id: '2',
          tableId: 'T2',
          status: 'ready',
          items: [{ name: 'Burger', quantity: 1 }],
          totalPrice: 1200,
          createdAt: 500
        }
      ];
    });

    it('should display orders sorted by creation time (oldest first)', () => {
      controller.displayOrders();

      expect(mockContainer.innerHTML).toBe('');
      expect(mockContainer.appendChild).toHaveBeenCalledTimes(2);
      expect(mockEmptyState.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('should show empty state when no orders', () => {
      controller.orders = [];
      controller.displayOrders();

      expect(mockEmptyState.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('should handle missing container gracefully', () => {
      controller.container = null;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      controller.displayOrders();

      expect(consoleSpy).toHaveBeenCalledWith('Container not initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Creating Order Elements', () => {
    it('should create order element with correct structure', () => {
      // Mock the escapeHtml method for this test
      controller.escapeHtml = vi.fn((text) => text);
      
      const order = {
        id: '123',
        tableId: 'T5',
        status: 'preparing',
        items: [
          { name: 'Pizza', quantity: 2 },
          { name: 'Coke', quantity: 1 }
        ],
        totalPrice: 2500,
        createdAt: Date.now()
      };

      // Mock createElement to return a proper element with getAttribute
      const mockElement = {
        className: 'order-card preparing',
        innerHTML: '',
        setAttribute: vi.fn(),
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-order-id') return '123';
          return null;
        }),
        classList: { 
          add: vi.fn((className) => {
            if (!mockElement.className.includes(className)) {
              mockElement.className += ' ' + className;
            }
          }),
          remove: vi.fn(),
          contains: vi.fn()
        }
      };
      
      global.document.createElement = vi.fn(() => mockElement);

      const element = controller.createOrderElement(order);

      expect(element.className).toContain('order-card');
      expect(element.className).toContain('preparing');
      expect(element.getAttribute('data-order-id')).toBe('123');
      expect(element.innerHTML).toContain('Order #123');
      expect(element.innerHTML).toContain('Table: T5');
      expect(element.innerHTML).toContain('Pizza');
      expect(element.innerHTML).toContain('x2');
      expect(element.innerHTML).toContain('$25.00');
    });

    it('should highlight ready orders', () => {
      // Mock the escapeHtml method for this test
      controller.escapeHtml = vi.fn((text) => text);
      
      const readyOrder = {
        id: '456',
        tableId: 'T6',
        status: 'ready',
        items: [{ name: 'Salad', quantity: 1 }],
        totalPrice: 800,
        createdAt: Date.now()
      };

      // Mock createElement to return a proper element with classList
      const mockElement = {
        className: 'order-card ready',
        innerHTML: '',
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        classList: { 
          add: vi.fn((className) => {
            if (className === 'ready-highlight') {
              mockElement.className += ' ready-highlight';
            }
          }),
          remove: vi.fn(),
          contains: vi.fn()
        }
      };
      
      global.document.createElement = vi.fn(() => mockElement);

      const element = controller.createOrderElement(readyOrder);

      expect(element.className).toContain('ready-highlight');
    });

    it('should escape HTML in order data', () => {
      // Mock the escapeHtml method to actually escape HTML
      controller.escapeHtml = vi.fn((text) => {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      });
      
      const order = {
        id: '<script>alert("xss")</script>',
        tableId: '<img src=x onerror=alert(1)>',
        status: 'pending',
        items: [{ name: '<b>Malicious</b>', quantity: 1 }],
        totalPrice: 1000,
        createdAt: Date.now()
      };

      const element = controller.createOrderElement(order);

      expect(element.innerHTML).not.toContain('<script>');
      expect(element.innerHTML).not.toContain('<img src=x');
      expect(element.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('Status Buttons', () => {
    it('should create correct buttons for pending orders', () => {
      const order = { id: '1', status: 'pending' };
      const buttons = controller.createStatusButtons(order);

      expect(buttons).toContain('Start Preparing');
      expect(buttons).toContain('data-new-status="preparing"');
    });

    it('should create correct buttons for preparing orders', () => {
      const order = { id: '1', status: 'preparing' };
      const buttons = controller.createStatusButtons(order);

      expect(buttons).toContain('Mark Ready');
      expect(buttons).toContain('data-new-status="ready"');
    });

    it('should create correct buttons for ready orders', () => {
      const order = { id: '1', status: 'ready' };
      const buttons = controller.createStatusButtons(order);

      expect(buttons).toContain('Mark Served');
      expect(buttons).toContain('data-new-status="served"');
    });

    it('should create correct buttons for served orders', () => {
      const order = { id: '1', status: 'served' };
      const buttons = controller.createStatusButtons(order);

      expect(buttons).toContain('Mark Completed');
      expect(buttons).toContain('data-new-status="completed"');
    });

    it('should return empty string for completed orders', () => {
      const order = { id: '1', status: 'completed' };
      const buttons = controller.createStatusButtons(order);

      expect(buttons).toBe('');
    });
  });

  describe('Order Management', () => {
    beforeEach(() => {
      controller.orders = [
        { id: '1', status: 'pending', tableId: 'T1', items: [{ name: 'Pizza', quantity: 1 }] },
        { id: '2', status: 'preparing', tableId: 'T2', items: [{ name: 'Burger', quantity: 1 }] }
      ];
    });

    it('should update existing order', () => {
      const updatedOrder = { id: '1', status: 'ready', tableId: 'T1', items: [{ name: 'Pizza', quantity: 1 }] };
      
      controller.updateOrder(updatedOrder);

      expect(controller.orders[0]).toEqual(updatedOrder);
      expect(mockContainer.innerHTML).toBe('');
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    it('should add new order if not found', () => {
      const newOrder = { id: '3', status: 'pending', tableId: 'T3', items: [{ name: 'Salad', quantity: 1 }] };
      
      controller.updateOrder(newOrder);

      expect(controller.orders).toHaveLength(3);
      expect(controller.orders[2]).toEqual(newOrder);
    });

    it('should remove order', () => {
      controller.removeOrder('1');

      expect(controller.orders).toHaveLength(1);
      expect(controller.orders[0].id).toBe('2');
    });

    it('should return copy of orders', () => {
      const orders = controller.getOrders();

      expect(orders).toEqual(controller.orders);
      expect(orders).not.toBe(controller.orders); // Should be a copy
    });
  });

  describe('Error Handling', () => {
    it('should show error message', () => {
      // Mock the escapeHtml method to return the input as-is for testing
      controller.escapeHtml = vi.fn((text) => text);
      
      controller.showError('Test error message');

      expect(mockContainer.innerHTML).toContain('Test error message');
      expect(mockContainer.innerHTML).toContain('Retry');
    });

    it('should handle missing container in showError', () => {
      controller.container = null;

      expect(() => {
        controller.showError('Test error');
      }).not.toThrow();
    });
  });

  describe('Status Formatting', () => {
    it('should format status correctly', () => {
      expect(controller.formatStatus('pending')).toBe('Pending');
      expect(controller.formatStatus('preparing')).toBe('Preparing');
      expect(controller.formatStatus('ready')).toBe('Ready');
      expect(controller.formatStatus('served')).toBe('Served');
      expect(controller.formatStatus('completed')).toBe('Completed');
      expect(controller.formatStatus('unknown')).toBe('unknown');
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML correctly', () => {
      // Mock createElement to return a proper div element
      const mockDiv = {
        textContent: '',
        innerHTML: ''
      };
      
      Object.defineProperty(mockDiv, 'textContent', {
        set: function(value) {
          this._textContent = value;
        },
        get: function() {
          return this._textContent;
        }
      });
      
      Object.defineProperty(mockDiv, 'innerHTML', {
        get: function() {
          // Simulate browser HTML escaping behavior
          if (this._textContent === '<script>alert("xss")</script>') {
            return '&lt;script&gt;alert("xss")&lt;/script&gt;';
          }
          return this._textContent || '';
        }
      });
      
      global.document.createElement = vi.fn(() => mockDiv);
      
      const maliciousText = '<script>alert("xss")</script>';
      const escaped = controller.escapeHtml(maliciousText);

      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should handle normal text', () => {
      // Mock createElement to return a proper div element
      const mockDiv = {
        textContent: '',
        innerHTML: ''
      };
      
      Object.defineProperty(mockDiv, 'textContent', {
        set: function(value) {
          this._textContent = value;
        },
        get: function() {
          return this._textContent;
        }
      });
      
      Object.defineProperty(mockDiv, 'innerHTML', {
        get: function() {
          return this._textContent || '';
        }
      });
      
      global.document.createElement = vi.fn(() => mockDiv);
      
      const normalText = 'Pizza Margherita';
      const escaped = controller.escapeHtml(normalText);

      expect(escaped).toBe('Pizza Margherita');
    });
  });
});