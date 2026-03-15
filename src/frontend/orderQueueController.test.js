/**
 * Unit tests for Order Queue Controller
 * Tests queue display, status updates, and real-time functionality
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import OrderQueueController from './orderQueueController.js';

// Mock the sub-controllers
vi.mock('./queueDisplayController.js', () => ({
  default: class MockQueueDisplayController {
    constructor() {
      this.orders = [];
    }
    init() {}
    fetchAndDisplayOrders() {
      return Promise.resolve([]);
    }
    displayOrders() {}
    updateOrder(order) {
      const index = this.orders.findIndex(o => o.id === order.id);
      if (index !== -1) {
        this.orders[index] = order;
      } else {
        this.orders.push(order);
      }
    }
    removeOrder(orderId) {
      this.orders = this.orders.filter(o => o.id !== orderId);
    }
    getOrders() {
      return [...this.orders];
    }
  }
}));

vi.mock('./statusUpdateController.js', () => ({
  default: class MockStatusUpdateController {
    constructor() {
      this.callbacks = [];
    }
    init() {}
    onStatusUpdate(callback) {
      this.callbacks.push(callback);
    }
    offStatusUpdate(callback) {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    }
    // Helper method for testing
    triggerStatusUpdate(eventType, data) {
      this.callbacks.forEach(cb => cb(eventType, data));
    }
  }
}));

vi.mock('./realTimeQueueUpdatesHandler.js', () => ({
  default: class MockRealTimeUpdatesHandler {
    constructor() {
      this.updateCallbacks = [];
      this.connectionCallbacks = [];
      this.isConnected = false;
    }
    init() {}
    onUpdate(callback) {
      this.updateCallbacks.push(callback);
    }
    offUpdate(callback) {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    }
    onConnection(callback) {
      this.connectionCallbacks.push(callback);
    }
    offConnection(callback) {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    }
    getConnectionStatus() {
      return { isConnected: this.isConnected, reconnectAttempts: 0 };
    }
    reconnect() {}
    disconnect() {}
    // Helper methods for testing
    triggerUpdate(eventType, data) {
      this.updateCallbacks.forEach(cb => cb(eventType, data));
    }
    triggerConnection(eventType, data) {
      this.connectionCallbacks.forEach(cb => cb(eventType, data));
    }
  }
}));

describe('OrderQueueController', () => {
  let controller;
  let mockDocument;

  beforeEach(() => {
    // Mock DOM elements
    mockDocument = {
      getElementById: vi.fn((id) => {
        const mockElement = {
          id,
          innerHTML: '',
          className: '',
          appendChild: vi.fn(),
          insertAdjacentElement: vi.fn(),
          querySelector: vi.fn(),
          setAttribute: vi.fn(),
          remove: vi.fn()
        };
        
        if (id === 'queue-page') {
          mockElement.querySelector = vi.fn(() => ({ insertAdjacentElement: vi.fn() }));
        }
        
        return mockElement;
      }),
      createElement: vi.fn(() => ({
        id: '',
        className: '',
        innerHTML: '',
        setAttribute: vi.fn(),
        remove: vi.fn()
      }))
    };
    
    global.document = mockDocument;
    global.window = { AudioContext: undefined, webkitAudioContext: undefined };
    
    controller = new OrderQueueController();
  });

  afterEach(() => {
    if (controller) {
      controller.destroy();
    }
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize all sub-controllers', () => {
      expect(controller.isReady()).toBe(false);
      
      controller.init();
      
      expect(controller.isReady()).toBe(true);
    });

    it('should setup connection status indicator', () => {
      const mockQueuePage = {
        querySelector: vi.fn(() => ({ insertAdjacentElement: vi.fn() })),
        insertBefore: vi.fn()
      };
      
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'queue-page') return mockQueuePage;
        if (id === 'connection-status') return null; // Not found initially
        return null;
      });
      
      controller.init();
      
      expect(mockDocument.getElementById).toHaveBeenCalledWith('queue-page');
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });

    it('should not initialize twice', () => {
      controller.init();
      const firstInitState = controller.isReady();
      
      controller.init();
      
      expect(controller.isReady()).toBe(firstInitState);
    });
  });

  describe('Queue Loading and Display', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should load queue successfully', async () => {
      const mockOrders = [
        { id: '1', tableId: 'T1', status: 'pending', items: [], createdAt: Date.now() }
      ];
      
      controller.queueDisplayController.fetchAndDisplayOrders = vi.fn().mockResolvedValue(mockOrders);
      
      await controller.loadQueue();
      
      expect(controller.queueDisplayController.fetchAndDisplayOrders).toHaveBeenCalled();
    });

    it('should handle queue loading errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      controller.queueDisplayController.fetchAndDisplayOrders = vi.fn().mockRejectedValue(new Error('Network error'));
      
      await controller.loadQueue();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error loading queue:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should refresh queue', async () => {
      controller.queueDisplayController.fetchAndDisplayOrders = vi.fn().mockResolvedValue([]);
      
      await controller.refreshQueue();
      
      expect(controller.queueDisplayController.fetchAndDisplayOrders).toHaveBeenCalled();
    });
  });

  describe('Status Update Integration', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should handle successful status updates', () => {
      const updatedOrder = { id: '1', status: 'preparing', tableId: 'T1' };
      
      controller.statusUpdateController.triggerStatusUpdate('statusUpdated', updatedOrder);
      
      const orders = controller.queueDisplayController.getOrders();
      expect(orders).toContainEqual(updatedOrder);
    });

    it('should handle status update errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorData = { orderId: '1', error: 'Network error' };
      
      controller.statusUpdateController.triggerStatusUpdate('statusUpdateError', errorData);
      
      expect(consoleSpy).toHaveBeenCalledWith('Status update error:', errorData);
      consoleSpy.mockRestore();
    });
  });

  describe('Real-Time Updates Integration', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should handle new order arrivals', () => {
      const newOrder = { id: '2', tableId: 'T2', status: 'pending', items: [] };
      
      controller.realTimeUpdatesHandler.triggerUpdate('orderAdded', newOrder);
      
      const orders = controller.queueDisplayController.getOrders();
      expect(orders).toContainEqual(newOrder);
    });

    it('should handle order status updates', () => {
      // Add initial order
      const initialOrder = { id: '1', status: 'pending', tableId: 'T1' };
      controller.queueDisplayController.updateOrder(initialOrder);
      
      // Update order status
      const updatedOrder = { id: '1', status: 'preparing', tableId: 'T1' };
      controller.realTimeUpdatesHandler.triggerUpdate('orderUpdated', updatedOrder);
      
      const orders = controller.queueDisplayController.getOrders();
      expect(orders.find(o => o.id === '1')).toEqual(updatedOrder);
    });

    it('should handle order removal when served/completed', () => {
      // Add initial order
      const order = { id: '1', status: 'ready', tableId: 'T1' };
      controller.queueDisplayController.updateOrder(order);
      
      // Mark as served
      const servedOrder = { id: '1', status: 'served', tableId: 'T1' };
      controller.realTimeUpdatesHandler.triggerUpdate('orderRemoved', servedOrder);
      
      const orders = controller.queueDisplayController.getOrders();
      expect(orders.find(o => o.id === '1')).toBeUndefined();
    });

    it('should handle metrics updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const metrics = { activeOrders: 5, totalRevenue: 12500 };
      
      controller.realTimeUpdatesHandler.triggerUpdate('metricsUpdated', metrics);
      
      expect(consoleSpy).toHaveBeenCalledWith('Metrics updated:', metrics);
      consoleSpy.mockRestore();
    });
  });

  describe('Connection Status Management', () => {
    beforeEach(() => {
      // Setup connection status element mock
      const mockConnectionStatusElement = {
        className: '',
        innerHTML: ''
      };
      
      const mockQueuePage = {
        querySelector: vi.fn(() => ({ insertAdjacentElement: vi.fn() })),
        insertBefore: vi.fn()
      };
      
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'queue-page') return mockQueuePage;
        if (id === 'connection-status') return null; // Not found initially
        return null;
      });
      
      controller.init();
      controller.connectionStatusElement = mockConnectionStatusElement; // Set manually for testing
    });

    it('should update connection status on connect', () => {
      controller.realTimeUpdatesHandler.triggerConnection('connected');
      
      expect(controller.connectionStatusElement.className).toBe('connection-status connected');
      expect(controller.connectionStatusElement.innerHTML).toContain('Real-time updates active');
    });

    it('should update connection status on disconnect', () => {
      controller.realTimeUpdatesHandler.triggerConnection('disconnected');
      
      expect(controller.connectionStatusElement.className).toBe('connection-status disconnected');
      expect(controller.connectionStatusElement.innerHTML).toContain('Connection lost');
    });

    it('should update connection status on error', () => {
      controller.realTimeUpdatesHandler.triggerConnection('error', new Error('Connection failed'));
      
      expect(controller.connectionStatusElement.className).toBe('connection-status error');
      expect(controller.connectionStatusElement.innerHTML).toContain('Connection error');
    });

    it('should handle max reconnect attempts reached', () => {
      controller.realTimeUpdatesHandler.triggerConnection('maxReconnectAttemptsReached');
      
      expect(controller.connectionStatusElement.className).toBe('connection-status error');
      expect(controller.connectionStatusElement.innerHTML).toContain('Unable to connect');
    });
  });

  describe('New Order Notifications', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should show notification for new orders', () => {
      const newOrder = { id: '3', tableId: 'T3', status: 'pending' };
      
      controller.showNewOrderNotification(newOrder);
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });

    it('should attempt to play notification sound', () => {
      const mockAudioContext = vi.fn(() => ({
        createOscillator: vi.fn(() => ({
          connect: vi.fn(),
          frequency: { value: 0 },
          start: vi.fn(),
          stop: vi.fn()
        })),
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          }
        })),
        destination: {},
        currentTime: 0
      }));
      
      global.window.AudioContext = mockAudioContext;
      
      const newOrder = { id: '4', tableId: 'T4', status: 'pending' };
      controller.showNewOrderNotification(newOrder);
      
      expect(mockAudioContext).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should return current orders', () => {
      const orders = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'preparing' }
      ];
      
      orders.forEach(order => controller.queueDisplayController.updateOrder(order));
      
      expect(controller.getCurrentOrders()).toEqual(orders);
    });

    it('should return connection status', () => {
      const status = controller.getConnectionStatus();
      
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('reconnectAttempts');
    });

    it('should handle reconnection', () => {
      const reconnectSpy = vi.spyOn(controller.realTimeUpdatesHandler, 'reconnect');
      
      controller.reconnect();
      
      expect(reconnectSpy).toHaveBeenCalled();
    });

    it('should cleanup resources on destroy', () => {
      const disconnectSpy = vi.spyOn(controller.realTimeUpdatesHandler, 'disconnect');
      
      controller.destroy();
      
      expect(disconnectSpy).toHaveBeenCalled();
      expect(controller.isReady()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should handle missing DOM elements gracefully', () => {
      mockDocument.getElementById.mockReturnValue(null);
      
      expect(() => {
        controller.updateConnectionStatus('connected');
      }).not.toThrow();
    });

    it('should handle audio context errors gracefully', () => {
      global.window.AudioContext = vi.fn(() => {
        throw new Error('Audio not supported');
      });
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      expect(() => {
        controller.playNotificationSound();
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Audio notification not available');
      consoleSpy.mockRestore();
    });
  });
});