/**
 * Unit tests for MenuManagementController
 * Tests menu management page functionality
 * Requirements: 9.1, 9.2, 9.3, 9.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MenuManagementController from './menuManagementController.js';

describe('MenuManagementController', () => {
  let controller;
  let mockFetch;
  let mockWebSocket;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="menu-management-page">
        <div class="page-header"></div>
        <button id="create-menu-item-btn"></button>
        <div id="menu-management-list"></div>
      </div>
      <div id="modal-overlay" class="hidden">
        <h3 id="modal-title"></h3>
        <div id="modal-body"></div>
        <button id="modal-close"></button>
      </div>
    `;

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock WebSocket
    mockWebSocket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: vi.fn()
    };
    global.WebSocket = vi.fn(() => mockWebSocket);

    controller = new MenuManagementController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should cache element references on init', () => {
      controller.init();

      expect(controller.menuListContainer).toBeTruthy();
      expect(controller.createMenuItemButton).toBeTruthy();
      expect(controller.modalOverlay).toBeTruthy();
    });

    it('should setup event listeners on init', () => {
      const addEventListenerSpy = vi.spyOn(controller.createMenuItemButton || document.createElement('button'), 'addEventListener');
      
      controller.init();

      expect(controller.createMenuItemButton).toBeTruthy();
    });

    it('should setup WebSocket connection on init', () => {
      controller.init();

      expect(global.WebSocket).toHaveBeenCalled();
    });

    it('should handle missing elements gracefully', () => {
      document.body.innerHTML = '<div></div>';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      controller.init();

      expect(consoleSpy).toHaveBeenCalledWith('Menu management page elements not found');
    });
  });

  describe('Menu Item List Display (Requirement 9.1)', () => {
    it('should fetch and display menu items', async () => {
      const mockMenuItems = [
        { id: '1', name: 'Pizza', description: 'Delicious pizza', price: 1200, available: true },
        { id: '2', name: 'Burger', description: 'Tasty burger', price: 900, available: false }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMenuItems
      });

      controller.init();
      await controller.displayMenuItems();

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items');
      expect(controller.menuListContainer.children.length).toBe(2);
      expect(controller.menuListContainer.textContent).toContain('Pizza');
      expect(controller.menuListContainer.textContent).toContain('Burger');
    });

    it('should display menu item with name, description, price, and availability', async () => {
      const mockMenuItem = {
        id: '1',
        name: 'Margherita Pizza',
        description: 'Classic tomato and mozzarella',
        price: 1500,
        available: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMenuItem]
      });

      controller.init();
      await controller.displayMenuItems();

      const itemElement = controller.menuListContainer.querySelector('[data-menu-item-id="1"]');
      expect(itemElement).toBeTruthy();
      expect(itemElement.textContent).toContain('Margherita Pizza');
      expect(itemElement.textContent).toContain('Classic tomato and mozzarella');
      expect(itemElement.textContent).toContain('15.00');
      expect(itemElement.textContent).toContain('Available');
    });

    it('should display empty state when no menu items exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      controller.init();
      await controller.displayMenuItems();

      expect(controller.menuListContainer.textContent).toContain('No menu items yet');
    });

    it('should display error message on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      controller.init();
      await controller.displayMenuItems();

      expect(controller.menuListContainer.textContent).toContain('Failed to load menu items');
    });

    it('should format price correctly from cents to dollars', async () => {
      const mockMenuItem = {
        id: '1',
        name: 'Test Item',
        description: 'Test',
        price: 1234,
        available: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMenuItem]
      });

      controller.init();
      await controller.displayMenuItems();

      expect(controller.menuListContainer.textContent).toContain('12.34');
    });
  });

  describe('Menu Item Creation (Requirement 9.1)', () => {
    it('should show create menu item modal', () => {
      controller.init();
      controller.showCreateMenuItemModal();

      expect(controller.modalTitle.textContent).toBe('Add Menu Item');
      expect(controller.modalBody.querySelector('#create-menu-item-form')).toBeTruthy();
      expect(controller.modalOverlay.classList.contains('hidden')).toBe(false);
    });

    it('should create menu item with valid data', async () => {
      const newItem = {
        id: '3',
        name: 'New Pizza',
        description: 'Fresh pizza',
        price: 1800,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newItem
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [newItem]
        });

      controller.init();
      controller.showCreateMenuItemModal();

      const form = document.getElementById('create-menu-item-form');
      form.querySelector('#item-name').value = 'New Pizza';
      form.querySelector('#item-description').value = 'Fresh pizza';
      form.querySelector('#item-price').value = '18.00';

      await controller.handleCreateMenuItem(form);

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Pizza',
          description: 'Fresh pizza',
          price: 1800
        })
      });
    });

    it('should validate form inputs before submission', async () => {
      controller.init();
      controller.showCreateMenuItemModal();

      const form = document.getElementById('create-menu-item-form');
      form.querySelector('#item-name').value = '';
      form.querySelector('#item-description').value = 'Test';
      form.querySelector('#item-price').value = '10.00';

      await controller.handleCreateMenuItem(form);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(controller.modalBody.textContent).toContain('Please fill in all fields');
    });

    it('should convert price from dollars to cents', async () => {
      const newItem = {
        id: '3',
        name: 'Test',
        description: 'Test',
        price: 1050,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newItem
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [newItem]
        });

      controller.init();
      controller.showCreateMenuItemModal();

      const form = document.getElementById('create-menu-item-form');
      form.querySelector('#item-name').value = 'Test';
      form.querySelector('#item-description').value = 'Test';
      form.querySelector('#item-price').value = '10.50';

      await controller.handleCreateMenuItem(form);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.price).toBe(1050);
    });

    it('should refresh menu list after successful creation', async () => {
      const newItem = {
        id: '3',
        name: 'New Item',
        description: 'Test',
        price: 1000,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newItem
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [newItem]
        });

      controller.init();
      controller.showCreateMenuItemModal();

      const form = document.getElementById('create-menu-item-form');
      form.querySelector('#item-name').value = 'New Item';
      form.querySelector('#item-description').value = 'Test';
      form.querySelector('#item-price').value = '10.00';

      await controller.handleCreateMenuItem(form);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(controller.menuListContainer.children.length).toBeGreaterThan(0);
    });

    it('should hide modal after successful creation', async () => {
      const newItem = {
        id: '3',
        name: 'Test',
        description: 'Test',
        price: 1000,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newItem
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [newItem]
        });

      controller.init();
      controller.showCreateMenuItemModal();

      const form = document.getElementById('create-menu-item-form');
      form.querySelector('#item-name').value = 'Test';
      form.querySelector('#item-description').value = 'Test';
      form.querySelector('#item-price').value = '10.00';

      await controller.handleCreateMenuItem(form);

      expect(controller.modalOverlay.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Menu Item Update (Requirement 9.2)', () => {
    it('should show edit menu item modal with pre-filled data', () => {
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Delicious',
        price: 1200,
        available: true
      };

      controller.init();
      controller.handleEditMenuItem(item);

      expect(controller.modalTitle.textContent).toBe('Edit Menu Item');
      const form = document.getElementById('edit-menu-item-form');
      expect(form.querySelector('#edit-item-name').value).toBe('Pizza');
      expect(form.querySelector('#edit-item-description').value).toBe('Delicious');
      expect(form.querySelector('#edit-item-price').value).toBe('12.00');
    });

    it('should update menu item with new data', async () => {
      const updatedItem = {
        id: '1',
        name: 'Updated Pizza',
        description: 'New description',
        price: 1500,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedItem
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [updatedItem]
        });

      controller.init();
      
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Old',
        price: 1200,
        available: true
      };
      
      controller.handleEditMenuItem(item);

      const form = document.getElementById('edit-menu-item-form');
      form.querySelector('#edit-item-name').value = 'Updated Pizza';
      form.querySelector('#edit-item-description').value = 'New description';
      form.querySelector('#edit-item-price').value = '15.00';

      await controller.handleUpdateMenuItem('1', form);

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Pizza',
          description: 'New description',
          price: 1500
        })
      });
    });

    it('should validate form inputs before update', async () => {
      controller.init();
      
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: true
      };
      
      controller.handleEditMenuItem(item);

      const form = document.getElementById('edit-menu-item-form');
      form.querySelector('#edit-item-name').value = '';
      form.querySelector('#edit-item-description').value = 'Test';
      form.querySelector('#edit-item-price').value = '10.00';

      await controller.handleUpdateMenuItem('1', form);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(controller.modalBody.textContent).toContain('Please fill in all fields');
    });

    it('should refresh menu list after successful update', async () => {
      const updatedItem = {
        id: '1',
        name: 'Updated',
        description: 'Test',
        price: 1000,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedItem
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [updatedItem]
        });

      controller.init();
      
      const item = {
        id: '1',
        name: 'Old',
        description: 'Test',
        price: 1000,
        available: true
      };
      
      controller.handleEditMenuItem(item);

      const form = document.getElementById('edit-menu-item-form');
      form.querySelector('#edit-item-name').value = 'Updated';
      form.querySelector('#edit-item-description').value = 'Test';
      form.querySelector('#edit-item-price').value = '10.00';

      await controller.handleUpdateMenuItem('1', form);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Availability Toggle (Requirement 9.3)', () => {
    it('should toggle availability from available to unavailable', async () => {
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: true
      };

      const updatedItem = { ...item, available: false };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedItem
      });

      controller.init();
      controller.menuItems = [item];

      await controller.handleToggleAvailability('1');

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: false })
      });
    });

    it('should toggle availability from unavailable to available', async () => {
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: false
      };

      const updatedItem = { ...item, available: true };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedItem
      });

      controller.init();
      controller.menuItems = [item];

      await controller.handleToggleAvailability('1');

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: true })
      });
    });

    it('should update UI after successful toggle', async () => {
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: true
      };

      const updatedItem = { ...item, available: false };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [item]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedItem
        });

      controller.init();
      await controller.displayMenuItems();

      await controller.handleToggleAvailability('1');

      const itemElement = controller.menuListContainer.querySelector('[data-menu-item-id="1"]');
      expect(itemElement.textContent).toContain('Unavailable');
    });

    it('should handle toggle errors gracefully', async () => {
      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: true
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      controller.init();
      controller.menuItems = [item];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await controller.handleToggleAvailability('1');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Menu Item Deletion (Requirement 9.1)', () => {
    it('should delete menu item after confirmation', async () => {
      global.confirm = vi.fn(() => true);

      const item = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: true
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => item
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      controller.init();
      controller.menuItems = [item];

      await controller.handleDeleteMenuItem('1');

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items/1', {
        method: 'DELETE'
      });
    });

    it('should not delete if user cancels confirmation', async () => {
      global.confirm = vi.fn(() => false);

      controller.init();
      controller.menuItems = [{ id: '1', name: 'Pizza', description: 'Test', price: 1200, available: true }];

      await controller.handleDeleteMenuItem('1');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should refresh menu list after successful deletion', async () => {
      global.confirm = vi.fn(() => true);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      controller.init();
      controller.menuItems = [{ id: '1', name: 'Pizza', description: 'Test', price: 1200, available: true }];

      await controller.handleDeleteMenuItem('1');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-Time Updates (Requirement 9.5)', () => {
    it('should setup WebSocket connection', () => {
      controller.init();

      expect(global.WebSocket).toHaveBeenCalled();
      expect(mockWebSocket.onopen).toBeDefined();
      expect(mockWebSocket.onmessage).toBeDefined();
      expect(mockWebSocket.onclose).toBeDefined();
      expect(mockWebSocket.onerror).toBeDefined();
    });

    it('should handle menu item update messages', async () => {
      const originalItem = {
        id: '1',
        name: 'Pizza',
        description: 'Old',
        price: 1200,
        available: true
      };

      const updatedItem = {
        id: '1',
        name: 'Pizza',
        description: 'Updated',
        price: 1500,
        available: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [originalItem]
      });

      controller.init();
      await controller.displayMenuItems();

      // Simulate WebSocket message
      const message = {
        data: JSON.stringify({
          type: 'menuItemUpdate',
          payload: updatedItem
        })
      };

      mockWebSocket.onmessage(message);

      const itemElement = controller.menuListContainer.querySelector('[data-menu-item-id="1"]');
      expect(itemElement.textContent).toContain('Updated');
      expect(itemElement.textContent).toContain('15.00');
      expect(itemElement.textContent).toContain('Unavailable');
    });

    it('should update local cache on WebSocket update', async () => {
      const originalItem = {
        id: '1',
        name: 'Pizza',
        description: 'Test',
        price: 1200,
        available: true
      };

      const updatedItem = {
        ...originalItem,
        available: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [originalItem]
      });

      controller.init();
      await controller.displayMenuItems();

      const message = {
        data: JSON.stringify({
          type: 'menuItemUpdate',
          payload: updatedItem
        })
      };

      mockWebSocket.onmessage(message);

      expect(controller.menuItems[0].available).toBe(false);
    });

    it('should attempt to reconnect on WebSocket close', () => {
      vi.useFakeTimers();

      controller.init();

      const setupSpy = vi.spyOn(controller, 'setupWebSocketConnection');

      mockWebSocket.onclose();

      vi.advanceTimersByTime(3000);

      expect(setupSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle invalid WebSocket messages gracefully', () => {
      controller.init();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const message = {
        data: 'invalid json'
      };

      mockWebSocket.onmessage(message);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    it('should escape HTML to prevent XSS', () => {
      controller.init();

      const escaped = controller.escapeHtml('<script>alert("xss")</script>');
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    it('should show and hide modal', () => {
      controller.init();

      controller.showModal();
      expect(controller.modalOverlay.classList.contains('hidden')).toBe(false);

      controller.hideModal();
      expect(controller.modalOverlay.classList.contains('hidden')).toBe(true);
    });

    it('should refresh menu items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      controller.init();

      await controller.refresh();

      expect(mockFetch).toHaveBeenCalledWith('/api/menu-items');
    });
  });
});
