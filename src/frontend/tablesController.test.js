/**
 * Unit tests for TablesController
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import TablesController from './tablesController.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('TablesController', () => {
  let controller;
  let dom;
  let document;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="tables-page">
            <div class="page-header"></div>
            <div id="tables-list"></div>
            <button id="create-table-btn">Create Table</button>
          </div>
          <div id="modal-overlay" class="hidden">
            <div class="modal-content">
              <h3 id="modal-title"></h3>
              <button id="modal-close">&times;</button>
              <div id="modal-body"></div>
            </div>
          </div>
        </body>
      </html>
    `);
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.confirm = vi.fn();
    
    document = dom.window.document;
    
    // Create controller instance
    controller = new TablesController();
    controller.init();
    
    // Reset fetch mock
    fetch.mockClear();
    global.confirm.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct DOM elements', () => {
      expect(controller.tablesListContainer).toBeTruthy();
      expect(controller.createTableButton).toBeTruthy();
      expect(controller.modalOverlay).toBeTruthy();
      expect(controller.modalTitle).toBeTruthy();
      expect(controller.modalBody).toBeTruthy();
      expect(controller.modalClose).toBeTruthy();
      expect(controller.tables).toEqual([]);
      expect(controller.selectedTableId).toBeNull();
    });

    it('should setup event listeners', () => {
      const createBtn = document.getElementById('create-table-btn');
      expect(createBtn).toBeTruthy();
    });
  });

  describe('fetchTables - Requirement 8.1', () => {
    it('should fetch tables from API successfully', async () => {
      const mockTables = [
        {
          id: 'table-1',
          qrCode: 'data:image/png;base64,abc123',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'table-2',
          qrCode: 'data:image/png;base64,def456',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTables
      });

      const result = await controller.fetchTables();

      expect(fetch).toHaveBeenCalledWith('/api/tables');
      expect(result).toEqual(mockTables);
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(controller.fetchTables()).rejects.toThrow('Failed to fetch tables: 500 Internal Server Error');
    });
  });

  describe('displayTables - Requirement 8.1', () => {
    it('should display all tables with identifiers and status', async () => {
      const mockTables = [
        {
          id: 'table-1',
          qrCode: 'data:image/png;base64,abc123',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'table-2',
          qrCode: 'data:image/png;base64,def456',
          status: 'inactive',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTables
      });

      await controller.displayTables();

      const container = controller.tablesListContainer;
      expect(container.children.length).toBe(2);
      expect(container.textContent).toContain('Table table-1');
      expect(container.textContent).toContain('Table table-2');
      expect(container.textContent).toContain('active');
      expect(container.textContent).toContain('inactive');
    });

    it('should display empty state when no tables exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await controller.displayTables();

      const container = controller.tablesListContainer;
      expect(container.textContent).toContain('No tables configured yet');
    });

    it('should display error message when fetch fails', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await controller.displayTables();

      const container = controller.tablesListContainer;
      expect(container.textContent).toContain('Failed to load tables');
      expect(container.textContent).toContain('Try Again');
    });
  });

  describe('createTableElement - Requirements 8.1, 8.4', () => {
    it('should create table element with all controls', () => {
      const table = {
        id: 'table-1',
        qrCode: 'data:image/png;base64,abc123',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const element = controller.createTableElement(table);

      expect(element.className).toBe('table-card');
      expect(element.getAttribute('data-table-id')).toBe('table-1');
      expect(element.textContent).toContain('Table table-1');
      expect(element.textContent).toContain('active');
      expect(element.textContent).toContain('Print QR');
      expect(element.textContent).toContain('Download QR');
      expect(element.textContent).toContain('View History');
      expect(element.textContent).toContain('Delete');

      // Check QR code image
      const img = element.querySelector('.table-qr-image');
      expect(img).toBeTruthy();
      expect(img.src).toBe('data:image/png;base64,abc123');
    });

    it('should escape HTML in table ID', () => {
      const table = {
        id: '<script>alert("xss")</script>',
        qrCode: 'data:image/png;base64,abc123',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const element = controller.createTableElement(table);

      expect(element.innerHTML).not.toContain('<script>alert("xss")</script>');
      expect(element.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('handleCreateTable - Requirement 8.2', () => {
    it('should create new table and display QR code', async () => {
      const newTable = {
        id: 'table-new',
        qrCode: 'data:image/png;base64,newqr',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Mock create table API call
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newTable
      });

      // Mock fetch tables API call (for refresh)
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [newTable]
      });

      // Show create modal first
      controller.showCreateTableModal();

      // Submit form
      await controller.handleCreateTable();

      expect(fetch).toHaveBeenCalledWith('/api/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle creation errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' })
      });

      controller.showCreateTableModal();
      await controller.handleCreateTable();

      // Check that error is displayed in modal
      expect(controller.modalBody.textContent).toContain('Failed to create table');
    });
  });

  describe('handleDeleteTable - Requirement 8.3', () => {
    it('should delete table when confirmed', async () => {
      global.confirm.mockReturnValueOnce(true);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await controller.handleDeleteTable('table-1');

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete table table-1? This action cannot be undone.'
      );
      expect(fetch).toHaveBeenCalledWith('/api/tables/table-1', {
        method: 'DELETE'
      });
    });

    it('should not delete table when cancelled', async () => {
      global.confirm.mockReturnValueOnce(false);

      await controller.handleDeleteTable('table-1');

      expect(global.confirm).toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      global.confirm.mockReturnValueOnce(true);

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' })
      });

      await controller.handleDeleteTable('table-1');

      // Error should be shown
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('handlePrintQRCode - Requirement 8.4', () => {
    it('should open print window with QR code', () => {
      const mockPrintWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn()
        },
        print: vi.fn(),
        onload: null
      };

      global.window.open = vi.fn().mockReturnValue(mockPrintWindow);

      const table = {
        id: 'table-1',
        qrCode: 'data:image/png;base64,abc123',
        status: 'active'
      };

      controller.handlePrintQRCode(table);

      expect(global.window.open).toHaveBeenCalledWith('', '_blank');
      expect(mockPrintWindow.document.write).toHaveBeenCalled();
      expect(mockPrintWindow.document.close).toHaveBeenCalled();

      // Check that the written content contains the table ID and QR code
      const writtenContent = mockPrintWindow.document.write.mock.calls[0][0];
      expect(writtenContent).toContain('Table table-1');
      expect(writtenContent).toContain('data:image/png;base64,abc123');
    });

    it('should handle popup blocker gracefully', () => {
      global.window.open = vi.fn().mockReturnValue(null);

      const table = {
        id: 'table-1',
        qrCode: 'data:image/png;base64,abc123',
        status: 'active'
      };

      controller.handlePrintQRCode(table);

      // Should not throw error
      expect(global.window.open).toHaveBeenCalled();
    });
  });

  describe('handleDownloadQRCode - Requirement 8.4', () => {
    it('should trigger QR code download', () => {
      const table = {
        id: 'table-1',
        qrCode: 'data:image/png;base64,abc123',
        status: 'active'
      };

      // Mock link element with proper DOM methods
      const mockLink = document.createElement('a');
      mockLink.click = vi.fn();

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      controller.handleDownloadQRCode(table);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('data:image/png;base64,abc123');
      expect(mockLink.download).toBe('table-table-1-qr-code.png');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('handleViewOrderHistory - Requirement 8.5', () => {
    it('should fetch and display order history for table', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 }
          ],
          status: 'completed',
          totalPrice: 2000,
          createdAt: Date.now()
        },
        {
          id: 'order-2',
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
          ],
          status: 'served',
          totalPrice: 500,
          createdAt: Date.now()
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders
      });

      await controller.handleViewOrderHistory('table-1');

      expect(fetch).toHaveBeenCalledWith('/api/tables/table-1/orders');
      expect(controller.modalTitle.textContent).toContain('Order History - Table table-1');
      expect(controller.modalBody.textContent).toContain('Order #order-1');
      expect(controller.modalBody.textContent).toContain('Order #order-2');
      expect(controller.modalBody.textContent).toContain('Burger');
      expect(controller.modalBody.textContent).toContain('Fries');
    });

    it('should display empty state when no orders exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await controller.handleViewOrderHistory('table-1');

      expect(controller.modalBody.textContent).toContain('No orders found for table table-1');
    });

    it('should handle fetch errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await controller.handleViewOrderHistory('table-1');

      expect(controller.modalBody.textContent).toContain('Failed to load order history');
    });
  });

  describe('displayOrderHistory - Requirement 8.5', () => {
    it('should display all orders with items and totals', () => {
      const orders = [
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 },
            { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
          ],
          status: 'completed',
          totalPrice: 2500,
          createdAt: Date.now()
        }
      ];

      controller.displayOrderHistory('table-1', orders);

      expect(controller.modalBody.textContent).toContain('Order #order-1');
      expect(controller.modalBody.textContent).toContain('completed');
      expect(controller.modalBody.textContent).toContain('Burger x2');
      expect(controller.modalBody.textContent).toContain('Fries x1');
      expect(controller.modalBody.textContent).toContain('Total: $25.00');
    });
  });

  describe('modal operations', () => {
    it('should show modal', () => {
      controller.showModal();

      expect(controller.modalOverlay.classList.contains('hidden')).toBe(false);
      expect(controller.modalOverlay.getAttribute('aria-hidden')).toBe('false');
    });

    it('should hide modal', () => {
      controller.showModal();
      controller.hideModal();

      expect(controller.modalOverlay.classList.contains('hidden')).toBe(true);
      expect(controller.modalOverlay.getAttribute('aria-hidden')).toBe('true');
    });

    it('should close modal when clicking close button', () => {
      controller.showModal();
      
      const closeBtn = document.getElementById('modal-close');
      closeBtn.click();

      expect(controller.modalOverlay.classList.contains('hidden')).toBe(true);
    });
  });

  describe('message display', () => {
    it('should show success message', () => {
      controller.showSuccess('Table created successfully!');

      const successElement = document.getElementById('tables-success');
      expect(successElement).toBeTruthy();
      expect(successElement.textContent).toBe('Table created successfully!');
      expect(successElement.style.display).toBe('block');
    });

    it('should show error message', () => {
      controller.showError('Failed to delete table');

      const errorElement = document.getElementById('tables-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toBe('Failed to delete table');
      expect(errorElement.style.display).toBe('block');
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

  describe('refresh', () => {
    it('should refresh tables display', async () => {
      const mockTables = [
        {
          id: 'table-1',
          qrCode: 'data:image/png;base64,abc123',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTables
      });

      await controller.refresh();

      expect(fetch).toHaveBeenCalledWith('/api/tables');
      expect(controller.tablesListContainer.children.length).toBe(1);
    });
  });
});
