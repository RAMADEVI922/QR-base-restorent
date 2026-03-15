/**
 * Comprehensive Unit Tests for Menu Page
 * Tests the integration of MenuDisplayController and OrderBuilderController
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import MenuDisplayController from './menuDisplayController.js';
import OrderBuilderController from './orderBuilderController.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Menu Page Integration Tests', () => {
  let menuController;
  let orderController;
  let dom;
  let document;

  beforeEach(() => {
    // Setup comprehensive DOM environment for menu page
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="menu-page">
            <div id="table-info"></div>
            <div id="menu-items"></div>
            <div id="order-summary">
              <div id="summary-items"></div>
              <span id="total-price">0.00</span>
              <button id="submit-order">Submit Order</button>
            </div>
          </div>
        </body>
      </html>
    `);
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.WebSocket = vi.fn();
    global.CustomEvent = dom.window.CustomEvent;
    
    // Mock navigation controller
    global.window.navigationController = {
      navigateTo: vi.fn(() => true)
    };
    
    document = dom.window.document;
    
    // Initialize both controllers
    menuController = new MenuDisplayController();
    orderController = new OrderBuilderController();
    
    menuController.init();
    orderController.init();
    
    // Reset fetch mock
    fetch.mockClear();
  });
  describe('Menu Item Display (Requirements 2.1, 2.2)', () => {
    it('should display all available menu items with complete details', async () => {
      const mockMenuItems = [
        {
          id: 'burger-1',
          name: 'Classic Burger',
          description: 'Juicy beef patty with lettuce, tomato, and special sauce',
          price: 1299,
          available: true
        },
        {
          id: 'pizza-1',
          name: 'Margherita Pizza',
          description: 'Fresh mozzarella, tomatoes, and basil on thin crust',
          price: 1599,
          available: true
        },
        {
          id: 'pasta-1',
          name: 'Chicken Alfredo',
          description: 'Grilled chicken with creamy alfredo sauce over fettuccine',
          price: 1799,
          available: false
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      await menuController.displayMenuItems();

      const container = menuController.menuItemsContainer;
      
      // Verify all items are displayed
      expect(container.children.length).toBe(3);
      
      // Verify available items show complete details
      expect(container.textContent).toContain('Classic Burger');
      expect(container.textContent).toContain('Juicy beef patty with lettuce, tomato, and special sauce');
      expect(container.textContent).toContain('$12.99');
      
      expect(container.textContent).toContain('Margherita Pizza');
      expect(container.textContent).toContain('Fresh mozzarella, tomatoes, and basil on thin crust');
      expect(container.textContent).toContain('$15.99');
      
      // Verify unavailable item shows proper status
      expect(container.textContent).toContain('Chicken Alfredo');
      expect(container.textContent).toContain('Grilled chicken with creamy alfredo sauce over fettuccine');
      expect(container.textContent).toContain('$17.99');
      expect(container.textContent).toContain('Currently unavailable');
      
      // Verify button states
      const availableButtons = container.querySelectorAll('.add-to-order-btn:not([disabled])');
      const unavailableButtons = container.querySelectorAll('.add-to-order-btn[disabled]');
      
      expect(availableButtons.length).toBe(2);
      expect(unavailableButtons.length).toBe(1);
    });

    it('should handle empty menu gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await menuController.displayMenuItems();

      const container = menuController.menuItemsContainer;
      expect(container.textContent).toContain('No menu items available');
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await menuController.displayMenuItems();

      const container = menuController.menuItemsContainer;
      expect(container.textContent).toContain('Failed to load menu items');
      expect(container.textContent).toContain('Try Again');
    });
  });
  describe('Item Selection and Order Building (Requirements 2.3, 2.4)', () => {
    it('should add items to order when selected from menu', async () => {
      const mockMenuItems = [
        {
          id: 'item-1',
          name: 'Test Burger',
          description: 'A test burger',
          price: 1299,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      await menuController.displayMenuItems();

      // Simulate clicking add to order button
      const addButton = menuController.menuItemsContainer.querySelector('.add-to-order-btn');
      addButton.click();

      // Verify item was added to order
      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      expect(orderController.getCurrentOrder().items[0]).toEqual({
        menuItemId: 'item-1',
        name: 'Test Burger',
        price: 1299,
        quantity: 1
      });

      // Verify order summary is updated
      const summaryContainer = orderController.summaryItemsContainer;
      expect(summaryContainer.textContent).toContain('Test Burger');
      expect(summaryContainer.textContent).toContain('x1');
      expect(summaryContainer.textContent).toContain('$12.99');
      expect(orderController.totalPriceElement.textContent).toBe('12.99');
    });

    it('should increase quantity when same item is selected multiple times', async () => {
      const mockMenuItems = [
        {
          id: 'item-1',
          name: 'Test Item',
          description: 'A test item',
          price: 1000,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      await menuController.displayMenuItems();

      // Click add button multiple times
      const addButton = menuController.menuItemsContainer.querySelector('.add-to-order-btn');
      addButton.click();
      addButton.click();
      addButton.click();

      // Verify quantity increased
      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      expect(orderController.getCurrentOrder().items[0].quantity).toBe(3);
      expect(orderController.getCurrentOrder().totalPrice).toBe(3000);

      // Verify display shows correct quantity and total
      const summaryContainer = orderController.summaryItemsContainer;
      expect(summaryContainer.textContent).toContain('x3');
      expect(orderController.totalPriceElement.textContent).toBe('30.00');
    });

    it('should handle multiple different items in order', async () => {
      const mockMenuItems = [
        {
          id: 'burger-1',
          name: 'Burger',
          description: 'A burger',
          price: 1299,
          available: true
        },
        {
          id: 'fries-1',
          name: 'Fries',
          description: 'French fries',
          price: 599,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      await menuController.displayMenuItems();

      // Add both items
      const buttons = menuController.menuItemsContainer.querySelectorAll('.add-to-order-btn');
      buttons[0].click(); // Burger
      buttons[1].click(); // Fries
      buttons[1].click(); // Fries again

      // Verify both items in order
      const order = orderController.getCurrentOrder();
      expect(order.items).toHaveLength(2);
      expect(order.totalPrice).toBe(2497); // 1299 + (599 * 2)

      // Verify display shows both items
      const summaryContainer = orderController.summaryItemsContainer;
      expect(summaryContainer.textContent).toContain('Burger');
      expect(summaryContainer.textContent).toContain('Fries');
      expect(summaryContainer.textContent).toContain('x1');
      expect(summaryContainer.textContent).toContain('x2');
      expect(orderController.totalPriceElement.textContent).toBe('24.97');
    });

    it('should remove items from order when remove button is clicked', async () => {
      // Add items to order first
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item 1',
        price: 1000,
        quantity: 2
      });
      orderController.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Test Item 2',
        price: 500,
        quantity: 1
      });

      // Verify initial state
      expect(orderController.getCurrentOrder().items).toHaveLength(2);
      expect(orderController.getCurrentOrder().totalPrice).toBe(2500);

      // Click remove button for first item
      const removeButtons = orderController.summaryItemsContainer.querySelectorAll('.remove-item-btn');
      removeButtons[0].click();

      // Verify item was removed
      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      expect(orderController.getCurrentOrder().items[0].menuItemId).toBe('item-2');
      expect(orderController.getCurrentOrder().totalPrice).toBe(500);

      // Verify display is updated
      const summaryContainer = orderController.summaryItemsContainer;
      expect(summaryContainer.textContent).not.toContain('Test Item 1');
      expect(summaryContainer.textContent).toContain('Test Item 2');
      expect(orderController.totalPriceElement.textContent).toBe('5.00');
    });

    it('should prevent selection of unavailable items', async () => {
      const mockMenuItems = [
        {
          id: 'unavailable-item',
          name: 'Unavailable Item',
          description: 'This item is not available',
          price: 1000,
          available: false
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      await menuController.displayMenuItems();

      // Try to click the disabled button
      const addButton = menuController.menuItemsContainer.querySelector('.add-to-order-btn');
      expect(addButton.disabled).toBe(true);
      
      // Simulate click (should not add to order)
      addButton.click();

      // Verify no item was added
      expect(orderController.getCurrentOrder().items).toHaveLength(0);
      expect(orderController.getCurrentOrder().totalPrice).toBe(0);
    });
  });
  describe('Order Total Calculation (Requirement 3.1)', () => {
    it('should calculate order total correctly with various price combinations', () => {
      const testCases = [
        {
          description: 'single item',
          items: [{ menuItemId: 'item-1', name: 'Item 1', price: 1299, quantity: 1 }],
          expectedTotal: 1299,
          expectedDisplay: '12.99'
        },
        {
          description: 'multiple quantities of same item',
          items: [{ menuItemId: 'item-1', name: 'Item 1', price: 599, quantity: 5 }],
          expectedTotal: 2995,
          expectedDisplay: '29.95'
        },
        {
          description: 'multiple different items',
          items: [
            { menuItemId: 'item-1', name: 'Item 1', price: 1599, quantity: 2 },
            { menuItemId: 'item-2', name: 'Item 2', price: 899, quantity: 3 },
            { menuItemId: 'item-3', name: 'Item 3', price: 299, quantity: 1 }
          ],
          expectedTotal: 6194, // (1599*2) + (899*3) + (299*1) = 3198 + 2697 + 299
          expectedDisplay: '61.94'
        },
        {
          description: 'edge case with cents',
          items: [
            { menuItemId: 'item-1', name: 'Item 1', price: 1, quantity: 99 },
            { menuItemId: 'item-2', name: 'Item 2', price: 99, quantity: 1 }
          ],
          expectedTotal: 198, // (1*99) + (99*1)
          expectedDisplay: '1.98'
        }
      ];

      testCases.forEach(({ description, items, expectedTotal, expectedDisplay }) => {
        // Clear order for each test
        orderController.clearOrder();

        // Add items
        items.forEach(item => {
          orderController.addItemToOrder(item);
        });

        // Verify calculations
        expect(orderController.getCurrentOrder().totalPrice).toBe(expectedTotal);
        expect(orderController.totalPriceElement.textContent).toBe(expectedDisplay);
      });
    });

    it('should update total when items are added and removed', () => {
      // Start with empty order
      expect(orderController.getCurrentOrder().totalPrice).toBe(0);
      expect(orderController.totalPriceElement.textContent).toBe('0.00');

      // Add first item
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Item 1',
        price: 1000,
        quantity: 2
      });
      expect(orderController.getCurrentOrder().totalPrice).toBe(2000);
      expect(orderController.totalPriceElement.textContent).toBe('20.00');

      // Add second item
      orderController.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Item 2',
        price: 500,
        quantity: 3
      });
      expect(orderController.getCurrentOrder().totalPrice).toBe(3500);
      expect(orderController.totalPriceElement.textContent).toBe('35.00');

      // Remove some quantity from first item
      orderController.removeItemFromOrder('item-1', 1);
      expect(orderController.getCurrentOrder().totalPrice).toBe(2500);
      expect(orderController.totalPriceElement.textContent).toBe('25.00');

      // Remove entire second item
      orderController.removeItemFromOrder('item-2');
      expect(orderController.getCurrentOrder().totalPrice).toBe(1000);
      expect(orderController.totalPriceElement.textContent).toBe('10.00');

      // Remove remaining item
      orderController.removeItemFromOrder('item-1');
      expect(orderController.getCurrentOrder().totalPrice).toBe(0);
      expect(orderController.totalPriceElement.textContent).toBe('0.00');
    });

    it('should handle decimal precision correctly', () => {
      // Test various price points to ensure no rounding errors
      const precisionTests = [
        { price: 1, quantity: 1, expectedTotal: 1, expectedDisplay: '0.01' },
        { price: 99, quantity: 1, expectedTotal: 99, expectedDisplay: '0.99' },
        { price: 100, quantity: 1, expectedTotal: 100, expectedDisplay: '1.00' },
        { price: 999, quantity: 1, expectedTotal: 999, expectedDisplay: '9.99' },
        { price: 1000, quantity: 1, expectedTotal: 1000, expectedDisplay: '10.00' },
        { price: 1599, quantity: 3, expectedTotal: 4797, expectedDisplay: '47.97' }
      ];

      precisionTests.forEach(({ price, quantity, expectedTotal, expectedDisplay }, index) => {
        orderController.clearOrder();
        
        orderController.addItemToOrder({
          menuItemId: `test-item-${index}`,
          name: `Test Item ${index}`,
          price: price,
          quantity: quantity
        });

        expect(orderController.getCurrentOrder().totalPrice).toBe(expectedTotal);
        expect(orderController.totalPriceElement.textContent).toBe(expectedDisplay);
      });
    });
  });
  describe('Order Submission Validation (Requirement 3.1)', () => {
    it('should prevent submission of empty orders', async () => {
      orderController.setTableContext('table-1');
      
      // Ensure order is empty
      orderController.clearOrder();
      expect(orderController.hasItems()).toBe(false);
      expect(orderController.submitOrderButton.disabled).toBe(true);

      // Try to submit empty order
      await orderController.handleSubmitOrder();

      // Should not make API call
      expect(fetch).not.toHaveBeenCalled();
      
      // Should show error message
      const errorElement = document.getElementById('order-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Please add items to your order');
    });

    it('should require table context for order submission', async () => {
      // Add items but no table context
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      // Ensure no table context
      orderController.setTableContext(null);

      await orderController.handleSubmitOrder();

      // Should not make API call
      expect(fetch).not.toHaveBeenCalled();
      
      // Should show error message
      const errorElement = document.getElementById('order-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Table information is missing');
    });

    it('should submit valid orders with correct data structure', async () => {
      orderController.setTableContext('table-123');
      
      // Add items to order
      orderController.addItemToOrder({
        menuItemId: 'burger-1',
        name: 'Classic Burger',
        price: 1299,
        quantity: 2
      });
      orderController.addItemToOrder({
        menuItemId: 'drink-1',
        name: 'Soda',
        price: 299,
        quantity: 1
      });

      const mockResponse = {
        id: 'order-456',
        status: 'pending',
        items: [
          { menuItemId: 'burger-1', name: 'Classic Burger', price: 1299, quantity: 2 },
          { menuItemId: 'drink-1', name: 'Soda', price: 299, quantity: 1 }
        ],
        totalPrice: 2897,
        tableId: 'table-123'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await orderController.handleSubmitOrder();

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
              menuItemId: 'drink-1',
              quantity: 1,
              price: 299,
              name: 'Soda'
            }
          ]
        })
      });

      // Verify order was cleared after successful submission
      expect(orderController.getCurrentOrder().items).toHaveLength(0);
      expect(orderController.getCurrentOrder().totalPrice).toBe(0);
      
      // Verify navigation was called
      expect(global.window.navigationController.navigateTo).toHaveBeenCalledWith('confirmation', expect.any(Object));
    });

    it('should handle submission errors gracefully', async () => {
      orderController.setTableContext('table-1');
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      // Mock API error
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' })
      });

      await orderController.handleSubmitOrder();

      // Order should not be cleared on error
      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      
      // Should show error message
      const errorElement = document.getElementById('order-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Failed to submit order');
      
      // Should not navigate on error
      expect(global.window.navigationController.navigateTo).not.toHaveBeenCalled();
    });

    it('should validate minimum order requirements', async () => {
      orderController.setTableContext('table-1');

      // Test with zero quantity items (edge case)
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 0
      });

      // Should not add item with zero quantity
      expect(orderController.getCurrentOrder().items).toHaveLength(0);
      expect(orderController.submitOrderButton.disabled).toBe(true);

      // Add valid item
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });

      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      expect(orderController.submitOrderButton.disabled).toBe(false);
    });
  });
  describe('Menu Page Integration Scenarios', () => {
    it('should handle complete order workflow from menu display to submission', async () => {
      // Set table context
      menuController.setTableContext('table-5');
      orderController.setTableContext('table-5');
      
      // Mock menu items
      const mockMenuItems = [
        {
          id: 'appetizer-1',
          name: 'Garlic Bread',
          description: 'Crispy bread with garlic butter',
          price: 699,
          available: true
        },
        {
          id: 'main-1',
          name: 'Chicken Parmesan',
          description: 'Breaded chicken with marinara sauce',
          price: 1899,
          available: true
        },
        {
          id: 'drink-1',
          name: 'Iced Tea',
          description: 'Fresh brewed iced tea',
          price: 299,
          available: true
        },
        {
          id: 'dessert-1',
          name: 'Chocolate Cake',
          description: 'Rich chocolate layer cake',
          price: 599,
          available: false
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      // Display menu items
      await menuController.displayMenuItems();

      // Verify menu display
      const container = menuController.menuItemsContainer;
      expect(container.children.length).toBe(4);
      expect(container.textContent).toContain('Garlic Bread');
      expect(container.textContent).toContain('Chicken Parmesan');
      expect(container.textContent).toContain('Iced Tea');
      expect(container.textContent).toContain('Chocolate Cake');
      expect(container.textContent).toContain('Currently unavailable');

      // Add items to order by clicking buttons
      const buttons = container.querySelectorAll('.add-to-order-btn:not([disabled])');
      expect(buttons.length).toBe(3); // Only available items

      buttons[0].click(); // Garlic Bread
      buttons[1].click(); // Chicken Parmesan
      buttons[1].click(); // Chicken Parmesan again
      buttons[2].click(); // Iced Tea
      buttons[2].click(); // Iced Tea again
      buttons[2].click(); // Iced Tea again

      // Verify order state
      const order = orderController.getCurrentOrder();
      expect(order.items).toHaveLength(3);
      expect(order.totalPrice).toBe(5394); // 699 + (1899*2) + (299*3) = 699 + 3798 + 897
      expect(orderController.getItemCount()).toBe(6); // 1 + 2 + 3

      // Verify order summary display
      const summaryContainer = orderController.summaryItemsContainer;
      expect(summaryContainer.textContent).toContain('Garlic Bread');
      expect(summaryContainer.textContent).toContain('Chicken Parmesan');
      expect(summaryContainer.textContent).toContain('Iced Tea');
      expect(summaryContainer.textContent).toContain('x1');
      expect(summaryContainer.textContent).toContain('x2');
      expect(summaryContainer.textContent).toContain('x3');
      expect(orderController.totalPriceElement.textContent).toBe('53.94');

      // Remove one item
      const removeButtons = summaryContainer.querySelectorAll('.remove-item-btn');
      removeButtons[0].click(); // Remove Garlic Bread

      // Verify updated order
      expect(orderController.getCurrentOrder().items).toHaveLength(2);
      expect(orderController.getCurrentOrder().totalPrice).toBe(4695); // (1899*2) + (299*3) = 3798 + 897
      expect(orderController.totalPriceElement.textContent).toBe('46.95');

      // Mock successful order submission
      const mockResponse = {
        id: 'order-789',
        status: 'pending',
        items: orderController.getCurrentOrder().items,
        totalPrice: orderController.getCurrentOrder().totalPrice,
        tableId: 'table-5'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Submit order
      await orderController.handleSubmitOrder();

      // Verify order was cleared after submission
      expect(orderController.getCurrentOrder().items).toHaveLength(0);
      expect(orderController.getCurrentOrder().totalPrice).toBe(0);
      expect(orderController.getCurrentOrder().tableId).toBe('table-5'); // Table context preserved
      expect(orderController.hasItems()).toBe(false);

      // Verify navigation was called
      expect(global.window.navigationController.navigateTo).toHaveBeenCalledWith('confirmation', expect.any(Object));
    });

    it('should handle real-time menu updates during ordering', async () => {
      // Initial menu display
      const initialMenuItems = [
        {
          id: 'item-1',
          name: 'Special Burger',
          description: 'Today\'s special burger',
          price: 1599,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialMenuItems
      });

      await menuController.displayMenuItems();

      // Add item to order
      const addButton = menuController.menuItemsContainer.querySelector('.add-to-order-btn');
      addButton.click();

      expect(orderController.getCurrentOrder().items).toHaveLength(1);

      // Simulate real-time update - item becomes unavailable
      const updatedItem = {
        id: 'item-1',
        name: 'Special Burger',
        description: 'Today\'s special burger',
        price: 1599,
        available: false
      };

      menuController.handleMenuItemUpdate(updatedItem);

      // Verify menu display is updated
      const container = menuController.menuItemsContainer;
      expect(container.textContent).toContain('Currently unavailable');
      
      const button = container.querySelector('.add-to-order-btn');
      expect(button.disabled).toBe(true);

      // Existing order should remain unchanged
      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      expect(orderController.getCurrentOrder().totalPrice).toBe(1599);
    });

    it('should handle edge cases and error scenarios', async () => {
      // Test with malformed menu data
      const malformedMenuItems = [
        {
          id: 'item-1',
          name: '<script>alert("xss")</script>',
          description: '<img src="x" onerror="alert(1)">',
          price: 1000,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedMenuItems
      });

      await menuController.displayMenuItems();

      // Verify XSS protection
      const container = menuController.menuItemsContainer;
      expect(container.innerHTML).not.toContain('<script>alert("xss")</script>');
      expect(container.innerHTML).not.toContain('<img src="x" onerror="alert(1)">');
      expect(container.innerHTML).toContain('&lt;script&gt;');
      expect(container.innerHTML).toContain('&lt;img src="x" onerror="alert(1)"&gt;');

      // Test order with escaped content
      const addButton = container.querySelector('.add-to-order-btn');
      addButton.click();

      expect(orderController.getCurrentOrder().items).toHaveLength(1);
      expect(orderController.getCurrentOrder().items[0].name).toBe('<script>alert("xss")</script>');

      // Verify order summary also escapes content
      const summaryContainer = orderController.summaryItemsContainer;
      expect(summaryContainer.innerHTML).not.toContain('<script>alert("xss")</script>');
      expect(summaryContainer.innerHTML).toContain('&lt;script&gt;');
    });

    it('should maintain proper state across multiple interactions', async () => {
      orderController.setTableContext('table-test');

      // Add multiple items with various quantities
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Item 1',
        price: 1000,
        quantity: 2
      });
      orderController.addItemToOrder({
        menuItemId: 'item-2',
        name: 'Item 2',
        price: 500,
        quantity: 3
      });
      orderController.addItemToOrder({
        menuItemId: 'item-3',
        name: 'Item 3',
        price: 750,
        quantity: 1
      });

      // Verify initial state
      expect(orderController.getCurrentOrder().items).toHaveLength(3);
      expect(orderController.getCurrentOrder().totalPrice).toBe(4250);
      expect(orderController.getItemCount()).toBe(6);
      expect(orderController.hasItems()).toBe(true);
      expect(orderController.submitOrderButton.disabled).toBe(false);

      // Remove partial quantity
      orderController.removeItemFromOrder('item-1', 1);
      expect(orderController.getCurrentOrder().totalPrice).toBe(3250);
      expect(orderController.getItemCount()).toBe(5);

      // Remove entire item
      orderController.removeItemFromOrder('item-3');
      expect(orderController.getCurrentOrder().items).toHaveLength(2);
      expect(orderController.getCurrentOrder().totalPrice).toBe(2500);
      expect(orderController.getItemCount()).toBe(4);

      // Add same item again
      orderController.addItemToOrder({
        menuItemId: 'item-1',
        name: 'Item 1',
        price: 1000,
        quantity: 1
      });

      // Should increase existing item quantity
      expect(orderController.getCurrentOrder().items).toHaveLength(2);
      expect(orderController.getCurrentOrder().items[0].quantity).toBe(2); // Back to 2
      expect(orderController.getCurrentOrder().totalPrice).toBe(3500);

      // Clear order
      orderController.clearOrder();
      expect(orderController.getCurrentOrder().items).toHaveLength(0);
      expect(orderController.getCurrentOrder().totalPrice).toBe(0);
      expect(orderController.getCurrentOrder().tableId).toBe('table-test'); // Table context preserved
      expect(orderController.hasItems()).toBe(false);
      expect(orderController.submitOrderButton.disabled).toBe(true);
    });
  });
});