/**
 * Unit tests for MenuDisplayController
 * Requirements: 2.1, 2.2, 2.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import MenuDisplayController from './menuDisplayController.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('MenuDisplayController', () => {
  let controller;
  let dom;
  let document;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="menu-items"></div>
          <div id="table-info"></div>
        </body>
      </html>
    `);
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.WebSocket = vi.fn();
    global.CustomEvent = dom.window.CustomEvent;
    
    document = dom.window.document;
    
    // Create controller instance
    controller = new MenuDisplayController();
    controller.init();
    
    // Reset fetch mock
    fetch.mockClear();
  });

  describe('initialization', () => {
    it('should initialize with correct DOM elements', () => {
      expect(controller.menuItemsContainer).toBeTruthy();
      expect(controller.tableInfo).toBeTruthy();
      expect(controller.menuItems).toEqual([]);
      expect(controller.currentTableId).toBeNull();
    });
  });

  describe('setTableContext', () => {
    it('should set table context and update table info display', () => {
      const tableId = 'table-1';
      
      controller.setTableContext(tableId);
      
      expect(controller.currentTableId).toBe(tableId);
      expect(controller.tableInfo.textContent).toBe('Table: table-1');
    });
  });

  describe('fetchMenuItems', () => {
    it('should fetch menu items from API successfully', async () => {
      const mockMenuItems = [
        {
          id: 'item-1',
          name: 'Test Item',
          description: 'Test Description',
          price: 1000,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      const result = await controller.fetchMenuItems();

      expect(fetch).toHaveBeenCalledWith('/api/menu-items');
      expect(result).toEqual(mockMenuItems);
      expect(controller.menuItems).toEqual(mockMenuItems);
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(controller.fetchMenuItems()).rejects.toThrow('Failed to fetch menu items: 500 Internal Server Error');
    });

    it('should handle network errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(controller.fetchMenuItems()).rejects.toThrow('Network error');
    });
  });

  describe('createMenuItemElement', () => {
    it('should create menu item element for available item', () => {
      const menuItem = {
        id: 'item-1',
        name: 'Test Burger',
        description: 'A delicious test burger',
        price: 1299,
        available: true
      };

      const element = controller.createMenuItemElement(menuItem);

      expect(element.className).toBe('menu-item ');
      expect(element.getAttribute('data-menu-item-id')).toBe('item-1');
      expect(element.textContent).toContain('Test Burger');
      expect(element.textContent).toContain('A delicious test burger');
      expect(element.textContent).toContain('$12.99');
      expect(element.textContent).toContain('Add to Order');
      
      const button = element.querySelector('.add-to-order-btn');
      expect(button.disabled).toBe(false);
    });

    it('should create menu item element for unavailable item', () => {
      const menuItem = {
        id: 'item-2',
        name: 'Unavailable Item',
        description: 'This item is not available',
        price: 999,
        available: false
      };

      const element = controller.createMenuItemElement(menuItem);

      expect(element.className).toBe('menu-item menu-item-unavailable');
      expect(element.textContent).toContain('Currently unavailable');
      expect(element.textContent).toContain('Unavailable');
      
      const button = element.querySelector('.add-to-order-btn');
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });

    it('should escape HTML in menu item content', () => {
      const menuItem = {
        id: 'item-3',
        name: '<script>alert("xss")</script>',
        description: '<img src="x" onerror="alert(1)">',
        price: 500,
        available: true
      };

      const element = controller.createMenuItemElement(menuItem);

      // Check that the dangerous scripts are escaped in the content
      expect(element.innerHTML).not.toContain('<script>alert("xss")</script>');
      expect(element.innerHTML).not.toContain('<img src="x" onerror="alert(1)">');
      
      // Check that the escaped content is present
      expect(element.innerHTML).toContain('&lt;script&gt;');
      expect(element.innerHTML).toContain('&lt;img src="x" onerror="alert(1)"&gt;');
    });
  });

  describe('displayMenuItems', () => {
    it('should display menu items when items are available', async () => {
      const mockMenuItems = [
        {
          id: 'item-1',
          name: 'Item 1',
          description: 'Description 1',
          price: 1000,
          available: true
        },
        {
          id: 'item-2',
          name: 'Item 2',
          description: 'Description 2',
          price: 1500,
          available: false
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      await controller.displayMenuItems();

      const container = controller.menuItemsContainer;
      expect(container.children.length).toBe(2);
      expect(container.textContent).toContain('Item 1');
      expect(container.textContent).toContain('Item 2');
    });

    it('should display empty state when no items are available', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await controller.displayMenuItems();

      const container = controller.menuItemsContainer;
      expect(container.textContent).toContain('No menu items available');
    });
  });

  describe('handleAddToOrder', () => {
    it('should dispatch menuItemSelected event', () => {
      const menuItem = {
        id: 'item-1',
        name: 'Test Item',
        price: 1000
      };

      let eventFired = false;
      let eventDetail = null;

      document.addEventListener('menuItemSelected', (event) => {
        eventFired = true;
        eventDetail = event.detail;
      });

      controller.handleAddToOrder(menuItem);

      expect(eventFired).toBe(true);
      expect(eventDetail).toEqual({
        menuItemId: 'item-1',
        name: 'Test Item',
        price: 1000,
        quantity: 1
      });
    });
  });

  describe('handleMenuItemUpdate', () => {
    it('should update existing menu item in cache and DOM', async () => {
      // Setup initial menu items
      const initialItems = [
        {
          id: 'item-1',
          name: 'Original Name',
          description: 'Original Description',
          price: 1000,
          available: true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialItems
      });

      await controller.displayMenuItems();

      // Update the item
      const updatedItem = {
        id: 'item-1',
        name: 'Updated Name',
        description: 'Updated Description',
        price: 1200,
        available: false
      };

      controller.handleMenuItemUpdate(updatedItem);

      // Check that cache is updated
      expect(controller.menuItems[0]).toEqual(updatedItem);

      // Check that DOM is updated
      const container = controller.menuItemsContainer;
      expect(container.textContent).toContain('Updated Name');
      expect(container.textContent).toContain('Updated Description');
      expect(container.textContent).toContain('$12.00');
      expect(container.textContent).toContain('Currently unavailable');
    });
  });

  describe('error handling', () => {
    it('should display error message when fetch fails', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await controller.displayMenuItems();

      const container = controller.menuItemsContainer;
      expect(container.textContent).toContain('Failed to load menu items');
      expect(container.textContent).toContain('Try Again');
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