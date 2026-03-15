/**
 * Unit tests for OrderBuilderController
 * Requirements: 2.3, 2.4, 3.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import OrderBuilderController from './orderBuilderController.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OrderBuilderController', () => {
  let controller;
  let dom;
  let document;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="order-summary">
            <div id="summary-items"></div>
            <span id="total-price">0.00</span>
            <button id="submit-order">Submit Order</button>
          </div>
          <div id="confirmation-order-id"></div>
          <div id="confirmation-items"></div>
          <span id="confirmation-total-price">0.00</span>
          <button id="place-another-order"></button>
          <button id="view-order-status"></button>
        </body>
      </html>
    `);
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.CustomEvent = dom.window.CustomEvent;
    
    // Mock navigation controller
    global.window.navigationController = {
      navigateTo: vi.fn(() => true)
    };
    
    document = dom.window.document;
    
    // Create controller instance
    controller = new OrderBuilderController();
    controller.init();
    
    // Reset fetch mock
    fetch.mockClear();
  });

  describe('initialization', () => {
    it('should initialize with correct DOM elements and empty order', () => {
      expect(controller.summaryItemsContainer).toBeTruthy();
      expect(controller.totalPriceElement).toBeTruthy();
      expect(controller.submitOrderButton).toBeTruthy();
      expect(controller.currentOrder.items).toEqual([]);
      expect(controller.currentOrder.totalPrice).toBe(0);
      expect(controller.currentOrder.tableId).toBeNull();
    });
  });

  describe('setTableContext', () => {
    it('should set table context for the order', () => {
      const tableId = 'table-1';
      
      controller.setTableContext(tableId);
      
      expect(controller.currentOrder.tableId).toBe(tableId);
    });
  });
  describe('addItemToOrder', () => {
    it('should add new item to empty order', () => {
      const itemData = {
        menuItemId: 'item-1',
        name: 'Test Burger',
        price: 1299,
        quantity: 1
      };

      controller.addItemToOrder(itemData);

      expect(controller.currentOrder.items).toHaveLength(1);
      expect(controller.currentOrder.items[0]).toEqual(itemData);
      expect(controller.currentOrder.totalPrice).toBe(1299);
    });

    it('should increase quantity for existing item', () => {
      const itemData = {
        menuItemId: 'item-1',
        name: 'Test Burger',
        price: 1299,
        quantity: 1
      };

      controller.addItemToOrder(itemData);
      controller.addItemToOrder(itemData);

      expect(controller.currentOrder.items).toHaveLength(1);
      expect(controller.currentOrder.items[0].quantity).toBe(2);
      expect(controller.currentOrder.totalPrice).toBe(2598);
    });

    it('should add multiple different items', () => {
      const item1 = {
        menuItemId: 'item-1',
        name: 'Burger',
        price: 1299,
        quantity: 1
      };

      const item2 = {
        menuItemId: 'item-2',
        name: 'Fries',
        price: 599,
        quantity: 2
      };

      controller.addItemToOrder(item1);
      controller.addItemToOrder(item2);

      expect(controller.currentOrder.items).toHaveLength(2);
      expect(controller.currentOrder.totalPrice).toBe(2497); // 1299 + (599 * 2)
    });

    it('should not add item with zero or negative quantity', () => {
      const itemData = {
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 0
      };

      controller.addItemToOrder(itemData);

      expect(controller.currentOrder.items).toHaveLength(0);
      expect(controller.currentOrder.totalPrice).toBe(0);
    });
  });

  describe('removeItemFromOrder', () => {
    beforeEach(() => {
      // Add some items to work with
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Burger',
        price: 1299,
        quantity: 2
      });
      controller.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Fries',
        price: 599,
        quantity: 1
      });
    });

    it('should remove entire item when no quantity specified', () => {
      controller.removeItemFromOrder('item-1');

      expect(controller.currentOrder.items).toHaveLength(1);
      expect(controller.currentOrder.items[0].menuItemId).toBe('item-2');
      expect(controller.currentOrder.totalPrice).toBe(599);
    });

    it('should reduce quantity when partial quantity specified', () => {
      controller.removeItemFromOrder('item-1', 1);

      expect(controller.currentOrder.items).toHaveLength(2);
      expect(controller.currentOrder.items[0].quantity).toBe(1);
      expect(controller.currentOrder.totalPrice).toBe(1898); // 1299 + 599
    });

    it('should remove entire item when quantity equals or exceeds current quantity', () => {
      controller.removeItemFromOrder('item-1', 3);

      expect(controller.currentOrder.items).toHaveLength(1);
      expect(controller.currentOrder.items[0].menuItemId).toBe('item-2');
    });

    it('should handle removing non-existent item gracefully', () => {
      const originalLength = controller.currentOrder.items.length;
      const originalTotal = controller.currentOrder.totalPrice;

      controller.removeItemFromOrder('non-existent');

      expect(controller.currentOrder.items).toHaveLength(originalLength);
      expect(controller.currentOrder.totalPrice).toBe(originalTotal);
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate correct total for multiple items', () => {
      controller.currentOrder.items = [
        { menuItemId: 'item-1', price: 1299, quantity: 2 },
        { menuItemId: 'item-2', price: 599, quantity: 3 },
        { menuItemId: 'item-3', price: 899, quantity: 1 }
      ];

      controller.calculateOrderTotal();

      expect(controller.currentOrder.totalPrice).toBe(5294); // (1299*2) + (599*3) + (899*1)
    });

    it('should return zero for empty order', () => {
      controller.currentOrder.items = [];

      controller.calculateOrderTotal();

      expect(controller.currentOrder.totalPrice).toBe(0);
    });
  });
  describe('updateOrderSummary', () => {
    it('should display empty state when no items in order', () => {
      controller.updateOrderSummary();

      const container = controller.summaryItemsContainer;
      expect(container.textContent).toContain('No items in your order yet');
      expect(controller.totalPriceElement.textContent).toBe('0.00');
      expect(controller.submitOrderButton.disabled).toBe(true);
    });

    it('should display items and total when order has items', () => {
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Burger',
        price: 1299,
        quantity: 2
      });

      const container = controller.summaryItemsContainer;
      expect(container.children.length).toBe(1);
      expect(container.textContent).toContain('Test Burger');
      expect(container.textContent).toContain('x2');
      expect(container.textContent).toContain('$25.98');
      expect(controller.totalPriceElement.textContent).toBe('25.98');
      expect(controller.submitOrderButton.disabled).toBe(false);
    });

    it('should escape HTML in item names', () => {
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: '<script>alert("xss")</script>',
        price: 1000,
        quantity: 1
      });

      const container = controller.summaryItemsContainer;
      expect(container.innerHTML).not.toContain('<script>alert("xss")</script>');
      expect(container.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('handleSubmitOrder', () => {
    beforeEach(() => {
      controller.setTableContext('table-1');
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });
    });

    it('should submit order successfully', async () => {
      const mockOrder = { id: 'order-123', status: 'pending', items: [], totalPrice: 1000 };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder
      });

      let orderSubmittedEvent = null;
      document.addEventListener('orderSubmitted', (event) => {
        orderSubmittedEvent = event;
      });

      await controller.handleSubmitOrder();

      expect(fetch).toHaveBeenCalledWith('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: 'table-1',
          items: [{
            menuItemId: 'item-1',
            quantity: 1,
            price: 1000,
            name: 'Test Item'
          }]
        })
      });

      // Order should be cleared after navigation
      expect(controller.currentOrder.items).toHaveLength(0);
      expect(orderSubmittedEvent).toBeTruthy();
      expect(orderSubmittedEvent.detail.order).toEqual(mockOrder);
      
      // Navigation should be called
      expect(global.window.navigationController.navigateTo).toHaveBeenCalledWith('confirmation', expect.any(Object));
    });

    it('should handle submission error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' })
      });

      await controller.handleSubmitOrder();

      // Order should not be cleared on error
      expect(controller.currentOrder.items).toHaveLength(1);
    });

    it('should prevent submission with empty order', async () => {
      controller.clearOrder();

      await controller.handleSubmitOrder();

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should prevent submission without table context', async () => {
      controller.setTableContext(null);

      await controller.handleSubmitOrder();

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('clearOrder', () => {
    it('should clear order items but keep table context', () => {
      controller.setTableContext('table-1');
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      controller.clearOrder();

      expect(controller.currentOrder.items).toHaveLength(0);
      expect(controller.currentOrder.totalPrice).toBe(0);
      expect(controller.currentOrder.tableId).toBe('table-1');
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Item 1',
        price: 1000,
        quantity: 2
      });
      controller.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Item 2',
        price: 500,
        quantity: 1
      });
    });

    it('should return current order data', () => {
      const orderData = controller.getCurrentOrder();
      
      expect(orderData.items).toHaveLength(2);
      expect(orderData.totalPrice).toBe(2500);
      expect(orderData).not.toBe(controller.currentOrder); // Should be a copy
    });

    it('should return correct item count', () => {
      expect(controller.getItemCount()).toBe(3); // 2 + 1
    });

    it('should return correct hasItems status', () => {
      expect(controller.hasItems()).toBe(true);
      
      controller.clearOrder();
      expect(controller.hasItems()).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const output = controller.escapeHtml(input);
      
      expect(output).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should handle empty strings', () => {
      expect(controller.escapeHtml('')).toBe('');
    });

    it('should handle normal text', () => {
      expect(controller.escapeHtml('Normal text')).toBe('Normal text');
    });
  });

  describe('order total calculation requirements', () => {
    it('should calculate order total correctly with multiple items (Requirement 3.1)', () => {
      // Test various combinations of items and quantities
      const testCases = [
        {
          items: [
            { menuItemId: 'item-1', price: 1000, quantity: 1 }
          ],
          expectedTotal: 1000
        },
        {
          items: [
            { menuItemId: 'item-1', price: 1299, quantity: 2 },
            { menuItemId: 'item-2', price: 599, quantity: 3 }
          ],
          expectedTotal: 4395 // (1299 * 2) + (599 * 3)
        },
        {
          items: [
            { menuItemId: 'item-1', price: 1599, quantity: 1 },
            { menuItemId: 'item-2', price: 899, quantity: 2 },
            { menuItemId: 'item-3', price: 299, quantity: 5 }
          ],
          expectedTotal: 4892 // 1599 + (899 * 2) + (299 * 5)
        }
      ];

      testCases.forEach(({ items, expectedTotal }, index) => {
        // Clear order for each test case
        controller.clearOrder();
        
        // Add items to order
        items.forEach(item => {
          controller.addItemToOrder({
            menuItemId: item.menuItemId,
            name: `Test Item ${item.menuItemId}`,
            price: item.price,
            quantity: item.quantity
          });
        });

        expect(controller.currentOrder.totalPrice).toBe(expectedTotal);
        
        // Verify display shows correct formatted total
        const formattedTotal = (expectedTotal / 100).toFixed(2);
        expect(controller.totalPriceElement.textContent).toBe(formattedTotal);
      });
    });

    it('should update total when items are removed (Requirements 2.4, 3.1)', () => {
      // Add multiple items
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Burger',
        price: 1299,
        quantity: 2
      });
      controller.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Fries',
        price: 599,
        quantity: 3
      });

      expect(controller.currentOrder.totalPrice).toBe(4395); // (1299*2) + (599*3)

      // Remove one quantity of item-1
      controller.removeItemFromOrder('item-1', 1);
      expect(controller.currentOrder.totalPrice).toBe(3096); // 1299 + (599*3)

      // Remove all of item-2
      controller.removeItemFromOrder('item-2');
      expect(controller.currentOrder.totalPrice).toBe(1299); // 1299 only

      // Remove remaining item
      controller.removeItemFromOrder('item-1');
      expect(controller.currentOrder.totalPrice).toBe(0);
    });

    it('should handle decimal precision correctly', () => {
      // Test edge cases with pricing
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1, // 1 cent
        quantity: 1
      });

      expect(controller.currentOrder.totalPrice).toBe(1);
      expect(controller.totalPriceElement.textContent).toBe('0.01');

      controller.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Another Item',
        price: 99, // 99 cents
        quantity: 1
      });

      expect(controller.currentOrder.totalPrice).toBe(100);
      expect(controller.totalPriceElement.textContent).toBe('1.00');
    });
  });

  describe('order submission validation requirements', () => {
    it('should prevent submission of empty orders (Requirement 3.1)', async () => {
      controller.setTableContext('table-1');
      // Ensure order is empty
      controller.clearOrder();

      await controller.handleSubmitOrder();

      // Should not make API call
      expect(fetch).not.toHaveBeenCalled();
      
      // Should show error message
      const errorElement = document.getElementById('order-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Please add items to your order');
    });

    it('should validate table context before submission (Requirement 3.2)', async () => {
      // Add items but no table context
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      controller.setTableContext(null);

      await controller.handleSubmitOrder();

      // Should not make API call
      expect(fetch).not.toHaveBeenCalled();
      
      // Should show error message
      const errorElement = document.getElementById('order-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Table information is missing');
    });

    it('should submit valid orders with correct data structure (Requirements 3.1, 3.2)', async () => {
      controller.setTableContext('table-123');
      
      // Add multiple items
      controller.addItemToOrder({
        menuItemId: 'burger-1',
        name: 'Classic Burger',
        price: 1299,
        quantity: 2
      });
      controller.addItemToOrder({
        menuItemId: 'fries-1',
        name: 'French Fries',
        price: 599,
        quantity: 1
      });

      const mockResponse = {
        id: 'order-456',
        status: 'pending',
        items: [
          { menuItemId: 'burger-1', name: 'Classic Burger', price: 1299, quantity: 2 },
          { menuItemId: 'fries-1', name: 'French Fries', price: 599, quantity: 1 }
        ],
        totalPrice: 3197,
        tableId: 'table-123'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await controller.handleSubmitOrder();

      // Verify API call structure
      expect(fetch).toHaveBeenCalledWith('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: 'table-123',
          items: [
            {
              menuItemId: 'burger-1',
              quantity: 2,
              price: 1299,
              name: 'Classic Burger'
            },
            {
              menuItemId: 'fries-1',
              quantity: 1,
              price: 599,
              name: 'French Fries'
            }
          ]
        })
      });
    });

    it('should handle submission errors gracefully', async () => {
      controller.setTableContext('table-1');
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      // Mock API error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid order data' })
      });

      await controller.handleSubmitOrder();

      // Order should not be cleared on error
      expect(controller.currentOrder.items).toHaveLength(1);
      
      // Should show error message
      const errorElement = document.getElementById('order-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Failed to submit order');
    });
  });

  describe('item selection and removal requirements', () => {
    it('should handle item selection correctly (Requirement 2.3)', () => {
      const testItems = [
        {
          menuItemId: 'pizza-1',
          name: 'Margherita Pizza',
          price: 1599,
          quantity: 1
        },
        {
          menuItemId: 'drink-1',
          name: 'Coca Cola',
          price: 299,
          quantity: 3
        }
      ];

      testItems.forEach(item => {
        controller.addItemToOrder(item);
      });

      // Verify items are added correctly
      expect(controller.currentOrder.items).toHaveLength(2);
      expect(controller.currentOrder.items[0]).toEqual(testItems[0]);
      expect(controller.currentOrder.items[1]).toEqual(testItems[1]);
      
      // Verify total is calculated
      expect(controller.currentOrder.totalPrice).toBe(2496); // 1599 + (299 * 3)
      
      // Verify UI is updated
      const container = controller.summaryItemsContainer;
      expect(container.textContent).toContain('Margherita Pizza');
      expect(container.textContent).toContain('Coca Cola');
      expect(container.textContent).toContain('x1');
      expect(container.textContent).toContain('x3');
    });

    it('should handle item removal correctly (Requirement 2.4)', () => {
      // Add items first
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item 1',
        price: 1000,
        quantity: 3
      });
      controller.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Test Item 2',
        price: 500,
        quantity: 2
      });

      expect(controller.currentOrder.items).toHaveLength(2);
      expect(controller.currentOrder.totalPrice).toBe(4000); // (1000*3) + (500*2)

      // Test partial removal
      controller.removeItemFromOrder('item-1', 1);
      expect(controller.currentOrder.items[0].quantity).toBe(2);
      expect(controller.currentOrder.totalPrice).toBe(3000); // (1000*2) + (500*2)

      // Test complete removal
      controller.removeItemFromOrder('item-2');
      expect(controller.currentOrder.items).toHaveLength(1);
      expect(controller.currentOrder.totalPrice).toBe(2000); // (1000*2)

      // Verify UI is updated
      const container = controller.summaryItemsContainer;
      expect(container.textContent).toContain('Test Item 1');
      expect(container.textContent).not.toContain('Test Item 2');
    });

    it('should update submit button state based on order contents', () => {
      // Initially empty order
      expect(controller.submitOrderButton.disabled).toBe(true);
      expect(controller.submitOrderButton.textContent).toBe('Add items to order');

      // Add item
      controller.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      expect(controller.submitOrderButton.disabled).toBe(false);
      expect(controller.submitOrderButton.textContent).toBe('Submit Order');

      // Remove item
      controller.removeItemFromOrder('item-1');

      expect(controller.submitOrderButton.disabled).toBe(true);
      expect(controller.submitOrderButton.textContent).toBe('Add items to order');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete order workflow', async () => {
      // Set table context
      controller.setTableContext('table-5');
      
      // Add multiple items
      controller.addItemToOrder({
        menuItemId: 'appetizer-1',
        name: 'Garlic Bread',
        price: 699,
        quantity: 1
      });
      controller.addItemToOrder({
        menuItemId: 'main-1',
        name: 'Chicken Parmesan',
        price: 1899,
        quantity: 2
      });
      controller.addItemToOrder({
        menuItemId: 'drink-1',
        name: 'Iced Tea',
        price: 299,
        quantity: 3
      });

      // Verify order state
      expect(controller.currentOrder.items).toHaveLength(3);
      expect(controller.currentOrder.totalPrice).toBe(5394); // 699 + (1899*2) + (299*3)
      expect(controller.getItemCount()).toBe(6); // 1 + 2 + 3
      expect(controller.hasItems()).toBe(true);

      // Mock successful submission
      const mockResponse = {
        id: 'order-789',
        status: 'pending',
        items: controller.currentOrder.items,
        totalPrice: controller.currentOrder.totalPrice,
        tableId: 'table-5'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Submit order
      await controller.handleSubmitOrder();

      // Verify order is cleared after submission
      expect(controller.currentOrder.items).toHaveLength(0);
      expect(controller.currentOrder.totalPrice).toBe(0);
      expect(controller.currentOrder.tableId).toBe('table-5'); // Table context preserved
      expect(controller.hasItems()).toBe(false);

      // Verify navigation was called
      expect(global.window.navigationController.navigateTo).toHaveBeenCalledWith('confirmation', expect.any(Object));
    });
  });
});