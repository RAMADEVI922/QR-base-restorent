/**
 * Property-based tests for OrderBuilderController
 * Tests Properties 5, 6, and 8 from the design document
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fc from 'fast-check';
import OrderBuilderController from './orderBuilderController.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OrderBuilderController Property-Based Tests', () => {
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
        </body>
      </html>
    `);
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.CustomEvent = dom.window.CustomEvent;
    
    document = dom.window.document;
    
    // Create controller instance
    controller = new OrderBuilderController();
    controller.init();
  });

  // Generator for menu items
  const menuItemArb = fc.record({
    menuItemId: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    price: fc.integer({ min: 1, max: 10000 }), // 1 cent to $100
    quantity: fc.integer({ min: 1, max: 10 })
  });

  describe('Property 5: Item Selection Adds to Order', () => {
    it('should add any selected item to order and appear in summary', () => {
      // Feature: qr-restaurant-ordering, Property 5: Item Selection Adds to Order
      // Validates: Requirements 2.3
      
      fc.assert(fc.property(menuItemArb, (item) => {
        // Clear order before each test
        controller.clearOrder();
        
        // Add item to order
        controller.addItemToOrder(item);
        
        // Verify item is in order
        const currentOrder = controller.getCurrentOrder();
        expect(currentOrder.items).toHaveLength(1);
        expect(currentOrder.items[0]).toEqual(item);
        
        // Verify item appears in summary
        const summaryContainer = controller.summaryItemsContainer;
        expect(summaryContainer.textContent).toContain(item.name);
        expect(summaryContainer.textContent).toContain(`x${item.quantity}`);
      }), { numRuns: 100 });
    });
  });

  describe('Property 6: Item Removal from Order', () => {
    it('should remove any item from order and update summary', () => {
      // Feature: qr-restaurant-ordering, Property 6: Item Removal from Order
      // Validates: Requirements 2.4
      
      fc.assert(fc.property(fc.array(menuItemArb, { minLength: 2, maxLength: 5 }), (items) => {
        // Clear order before each test
        controller.clearOrder();
        
        // Add all items to order
        items.forEach(item => controller.addItemToOrder(item));
        
        // Remove first item
        const itemToRemove = items[0];
        controller.removeItemFromOrder(itemToRemove.menuItemId);
        
        // Verify item is removed
        const currentOrder = controller.getCurrentOrder();
        const remainingItem = currentOrder.items.find(item => item.menuItemId === itemToRemove.menuItemId);
        expect(remainingItem).toBeUndefined();
      }), { numRuns: 50 });
    });
  });

  describe('Property 8: Order Summary Accuracy', () => {
    it('should calculate total price correctly as sum of item prices', () => {
      // Feature: qr-restaurant-ordering, Property 8: Order Summary Accuracy
      // Validates: Requirements 3.1
      
      fc.assert(fc.property(fc.array(menuItemArb, { minLength: 1, maxLength: 10 }), (items) => {
        // Clear order before each test
        controller.clearOrder();
        
        // Add all items to order
        items.forEach(item => controller.addItemToOrder(item));
        
        // Calculate expected total
        const expectedTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
        
        // Verify order total matches expected
        const currentOrder = controller.getCurrentOrder();
        expect(currentOrder.totalPrice).toBe(expectedTotal);
        
        // Verify displayed total matches (formatted correctly)
        const formattedExpected = (expectedTotal / 100).toFixed(2);
        expect(controller.totalPriceElement.textContent).toBe(formattedExpected);
      }), { numRuns: 100 });
    });
  });
});