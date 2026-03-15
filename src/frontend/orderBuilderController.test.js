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
          <div id="summary-items"></div>
          <span id="total-price">0.00</span>
          <button id="submit-order">Submit Order</button>
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
});