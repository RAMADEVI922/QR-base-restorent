/**
 * Unit tests for Status Update Controller
 * Tests status update functionality and API communication
 * 
 * Requirements: 4.3, 4.4, 5.2, 12.1, 12.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StatusUpdateController from './statusUpdateController.js';

// Mock fetch
global.fetch = vi.fn();

describe('StatusUpdateController', () => {
  let controller;
  let mockButton;
  let mockDocument;

  beforeEach(() => {
    // Mock DOM elements
    mockButton = {
      getAttribute: vi.fn(),
      disabled: false,
      setAttribute: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn() },
      innerHTML: '',
      textContent: 'Original Text',
      dataset: {}
    };

    mockDocument = {
      addEventListener: vi.fn(),
      getElementById: vi.fn(),
      createElement: vi.fn(() => ({
        id: '',
        className: '',
        innerHTML: '',
        setAttribute: vi.fn(),
        remove: vi.fn(),
        parentNode: { insertBefore: vi.fn() }
      }))
    };

    global.document = mockDocument;
    global.setTimeout = vi.fn((fn) => fn());

    controller = new StatusUpdateController();
    controller.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
    fetch.mockClear();
  });

  describe('Initialization', () => {
    it('should setup event listeners', () => {
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should initialize with default state', () => {
      expect(controller.isCurrentlyUpdating()).toBe(false);
      expect(controller.updateCallbacks).toEqual([]);
    });
  });

  describe('Status Update Handling', () => {
    beforeEach(() => {
      mockButton.getAttribute.mockImplementation((attr) => {
        if (attr === 'data-order-id') return '123';
        if (attr === 'data-new-status') return 'preparing';
        return null;
      });
      mockButton.classList.contains = vi.fn(() => true);
    });

    it('should handle successful status update', async () => {
      const updatedOrder = { id: '123', status: 'preparing', tableId: 'T1' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedOrder)
      });

      const callback = vi.fn();
      controller.onStatusUpdate(callback);

      await controller.handleStatusUpdate(mockButton);

      expect(fetch).toHaveBeenCalledWith('/api/orders/123/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' })
      });
      expect(callback).toHaveBeenCalledWith('statusUpdated', updatedOrder);
    });

    it('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      });

      const callback = vi.fn();
      controller.onStatusUpdate(callback);

      await controller.handleStatusUpdate(mockButton);

      expect(callback).toHaveBeenCalledWith('statusUpdateError', {
        orderId: '123',
        newStatus: 'preparing',
        error: expect.any(Error)
      });
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn();
      controller.onStatusUpdate(callback);

      await controller.handleStatusUpdate(mockButton);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating order status:', expect.any(Error));
      expect(callback).toHaveBeenCalledWith('statusUpdateError', expect.any(Object));
      consoleSpy.mockRestore();
    });

    it('should prevent multiple simultaneous updates', async () => {
      controller.isUpdating = true;

      await controller.handleStatusUpdate(mockButton);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate required attributes', async () => {
      mockButton.getAttribute.mockReturnValue(null);

      await controller.handleStatusUpdate(mockButton);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate status transitions', async () => {
      mockButton.getAttribute.mockImplementation((attr) => {
        if (attr === 'data-order-id') return '123';
        if (attr === 'data-new-status') return 'invalid-status';
        return null;
      });

      await controller.handleStatusUpdate(mockButton);

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Button Loading States', () => {
    it('should set button to loading state', () => {
      controller.setButtonLoading(mockButton, true);

      expect(mockButton.disabled).toBe(true);
      expect(mockButton.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
      expect(mockButton.innerHTML).toContain('Updating...');
      expect(mockButton.dataset.originalText).toBe('Original Text');
    });

    it('should restore button from loading state', () => {
      mockButton.dataset.originalText = 'Original Text';
      
      controller.setButtonLoading(mockButton, false);

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.setAttribute).toHaveBeenCalledWith('aria-busy', 'false');
      expect(mockButton.textContent).toBe('Original Text');
      expect(mockButton.dataset.originalText).toBeUndefined();
    });
  });

  describe('Success Feedback', () => {
    it('should show success feedback', () => {
      controller.showSuccessFeedback(mockButton, 'preparing');

      expect(mockButton.classList.add).toHaveBeenCalledWith('success-feedback');
      expect(mockButton.innerHTML).toContain('Started!');
      expect(mockButton.innerHTML).toContain('✓');
    });

    it('should format status text correctly', () => {
      expect(controller.formatStatusText('preparing')).toBe('Started!');
      expect(controller.formatStatusText('ready')).toBe('Ready!');
      expect(controller.formatStatusText('served')).toBe('Served!');
      expect(controller.formatStatusText('completed')).toBe('Completed!');
      expect(controller.formatStatusText('unknown')).toBe('Updated!');
    });
  });

  describe('Error Display', () => {
    it('should show error notification', () => {
      const mockQueuePage = { insertBefore: vi.fn() };
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'queue-page') return mockQueuePage;
        return null;
      });

      controller.showError('Test error message');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });

    it('should update existing error notification', () => {
      const mockErrorElement = { innerHTML: '' };
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'status-error-notification') return mockErrorElement;
        return null;
      });

      controller.showError('Updated error message');

      expect(mockErrorElement.innerHTML).toContain('Updated error message');
    });
  });

  describe('Callback Management', () => {
    it('should add and remove callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      controller.onStatusUpdate(callback1);
      controller.onStatusUpdate(callback2);

      expect(controller.updateCallbacks).toHaveLength(2);

      controller.offStatusUpdate(callback1);

      expect(controller.updateCallbacks).toHaveLength(1);
      expect(controller.updateCallbacks[0]).toBe(callback2);
    });

    it('should handle non-function callbacks gracefully', () => {
      controller.onStatusUpdate('not a function');

      expect(controller.updateCallbacks).toHaveLength(0);
    });

    it('should notify all callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn(() => { throw new Error('Callback error'); });

      controller.onStatusUpdate(callback1);
      controller.onStatusUpdate(callback2);
      controller.onStatusUpdate(callback3);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      controller.notifyUpdateCallbacks('test', { data: 'test' });

      expect(callback1).toHaveBeenCalledWith('test', { data: 'test' });
      expect(callback2).toHaveBeenCalledWith('test', { data: 'test' });
      expect(consoleSpy).toHaveBeenCalledWith('Error in status update callback:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Batch Updates', () => {
    it('should handle batch updates successfully', async () => {
      const updates = [
        { orderId: '1', newStatus: 'preparing' },
        { orderId: '2', newStatus: 'ready' }
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: '1', status: 'preparing' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: '2', status: 'ready' })
        });

      const results = await controller.batchUpdateOrders(updates);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle batch update failures', async () => {
      const updates = [
        { orderId: '1', newStatus: 'preparing' },
        { orderId: '2', newStatus: 'ready' }
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: '1', status: 'preparing' })
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await controller.batchUpdateOrders(updates);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeInstanceOf(Error);
    });
  });

  describe('Status Validation', () => {
    it('should validate valid statuses', () => {
      expect(controller.isValidStatusTransition('pending')).toBe(true);
      expect(controller.isValidStatusTransition('preparing')).toBe(true);
      expect(controller.isValidStatusTransition('ready')).toBe(true);
      expect(controller.isValidStatusTransition('served')).toBe(true);
      expect(controller.isValidStatusTransition('completed')).toBe(true);
    });

    it('should reject invalid statuses', () => {
      expect(controller.isValidStatusTransition('invalid')).toBe(false);
      expect(controller.isValidStatusTransition('')).toBe(false);
      expect(controller.isValidStatusTransition(null)).toBe(false);
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML correctly', () => {
      const maliciousText = '<script>alert("xss")</script>';
      const escaped = controller.escapeHtml(maliciousText);

      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });
  });
});