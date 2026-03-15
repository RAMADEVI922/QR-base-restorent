/**
 * Unit tests for WebSocket Client
 * Tests connection management, reconnection logic, and event listeners
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from './websocketClient.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen();
      }
    }, 10);
  }

  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure' });
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  // Helper to simulate error
  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

describe('WebSocketClient', () => {
  let client;
  let originalWebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;
    
    // Mock WebSocket globally
    global.WebSocket = MockWebSocket;
    
    // Create fresh client instance
    client = new WebSocketClient({
      url: 'ws://localhost:3000',
      initialReconnectDelay: 100,
      maxReconnectDelay: 1000
    });
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    
    // Clean up client
    if (client) {
      client.disconnect();
    }
    
    // Clear all timers
    vi.clearAllTimers();
  });

  describe('Connection Management', () => {
    it('should initialize with disconnected state', () => {
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should connect to WebSocket server', async () => {
      await client.connect();
      
      expect(client.getState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
    });

    it('should not create multiple connections if already connecting', async () => {
      const promise1 = client.connect();
      const promise2 = client.connect();
      
      await Promise.all([promise1, promise2]);
      
      expect(client.getState()).toBe('connected');
    });

    it('should disconnect from WebSocket server', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      client.disconnect();
      
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should set shouldReconnect to false on disconnect', async () => {
      await client.connect();
      client.disconnect();
      
      expect(client.shouldReconnect).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    it('should register event listener', () => {
      const callback = vi.fn();
      
      client.on('orderCreated', callback);
      
      expect(client.listeners.has('orderCreated')).toBe(true);
      expect(client.listeners.get('orderCreated').has(callback)).toBe(true);
    });

    it('should throw error if callback is not a function', () => {
      expect(() => {
        client.on('orderCreated', 'not a function');
      }).toThrow('Callback must be a function');
    });

    it('should unregister event listener', () => {
      const callback = vi.fn();
      
      client.on('orderCreated', callback);
      client.off('orderCreated', callback);
      
      expect(client.listeners.has('orderCreated')).toBe(false);
    });

    it('should handle multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      client.on('orderCreated', callback1);
      client.on('orderCreated', callback2);
      
      expect(client.listeners.get('orderCreated').size).toBe(2);
    });

    it('should emit event to registered listeners', async () => {
      await client.connect();
      
      const callback = vi.fn();
      client.on('orderCreated', callback);
      
      const testData = { orderId: '123', tableId: 'T1' };
      client.ws.simulateMessage({
        type: 'orderCreated',
        data: testData,
        timestamp: Date.now()
      });
      
      expect(callback).toHaveBeenCalledWith(testData, expect.any(Number));
    });

    it('should not emit event if no listeners registered', async () => {
      await client.connect();
      
      // Should not throw error
      client.ws.simulateMessage({
        type: 'orderCreated',
        data: { orderId: '123' },
        timestamp: Date.now()
      });
    });

    it('should handle errors in event listeners gracefully', async () => {
      await client.connect();
      
      const errorCallback = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalCallback = vi.fn();
      
      client.on('orderCreated', errorCallback);
      client.on('orderCreated', normalCallback);
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      client.ws.simulateMessage({
        type: 'orderCreated',
        data: { orderId: '123' },
        timestamp: Date.now()
      });
      
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    it('should parse and handle incoming messages', async () => {
      await client.connect();
      
      const callback = vi.fn();
      client.on('menuItemUpdated', callback);
      
      const testData = { itemId: 'M1', available: false };
      client.ws.simulateMessage({
        type: 'menuItemUpdated',
        data: testData,
        timestamp: 1234567890
      });
      
      expect(callback).toHaveBeenCalledWith(testData, 1234567890);
    });

    it('should handle invalid JSON messages gracefully', async () => {
      await client.connect();
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      if (client.ws.onmessage) {
        client.ws.onmessage({ data: 'invalid json' });
      }
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle different event types', async () => {
      await client.connect();
      
      const orderCallback = vi.fn();
      const menuCallback = vi.fn();
      const metricsCallback = vi.fn();
      
      client.on('orderStatusChanged', orderCallback);
      client.on('menuItemUpdated', menuCallback);
      client.on('metricsUpdated', metricsCallback);
      
      client.ws.simulateMessage({ type: 'orderStatusChanged', data: { orderId: '1' }, timestamp: 1 });
      client.ws.simulateMessage({ type: 'menuItemUpdated', data: { itemId: 'M1' }, timestamp: 2 });
      client.ws.simulateMessage({ type: 'metricsUpdated', data: { revenue: 1000 }, timestamp: 3 });
      
      expect(orderCallback).toHaveBeenCalledTimes(1);
      expect(menuCallback).toHaveBeenCalledTimes(1);
      expect(metricsCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection after connection loss', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      // Simulate connection loss
      client.ws.close();
      
      // Wait a bit for the close handler to execute
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(client.getState()).toBe('reconnecting');
      expect(client.reconnectTimeout).not.toBeNull();
    });

    it('should not reconnect if disconnect was intentional', async () => {
      await client.connect();
      
      client.disconnect();
      
      expect(client.shouldReconnect).toBe(false);
      expect(client.reconnectTimeout).toBeNull();
    });

    it('should use exponential backoff for reconnection delays', () => {
      client.reconnectAttempts = 0;
      const delay1 = client.calculateReconnectDelay();
      
      client.reconnectAttempts = 1;
      const delay2 = client.calculateReconnectDelay();
      
      client.reconnectAttempts = 2;
      const delay3 = client.calculateReconnectDelay();
      
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap reconnection delay at maxReconnectDelay', () => {
      client.reconnectAttempts = 100;
      const delay = client.calculateReconnectDelay();
      
      expect(delay).toBeLessThanOrEqual(client.maxReconnectDelay);
    });

    it('should reset reconnect attempts after successful connection', async () => {
      client.reconnectAttempts = 5;
      
      await client.connect();
      
      expect(client.reconnectAttempts).toBe(0);
    });

    it('should stop reconnecting after max attempts', () => {
      const clientWithLimit = new WebSocketClient({
        url: 'ws://localhost:3000',
        maxReconnectAttempts: 2,
        initialReconnectDelay: 100
      });

      clientWithLimit.reconnectAttempts = 2;
      clientWithLimit.shouldReconnect = true;
      
      // Try to schedule reconnect when at max attempts
      clientWithLimit.scheduleReconnect();
      
      expect(clientWithLimit.getState()).toBe('disconnected');
      expect(clientWithLimit.reconnectTimeout).toBeNull();
    });
  });

  describe('Connection State', () => {
    it('should return correct state during connection lifecycle', async () => {
      expect(client.getState()).toBe('disconnected');
      
      const connectPromise = client.connect();
      expect(client.getState()).toBe('connecting');
      
      await connectPromise;
      expect(client.getState()).toBe('connected');
      
      client.disconnect();
      expect(client.getState()).toBe('disconnected');
    });

    it('should report isConnected correctly', async () => {
      expect(client.isConnected()).toBe(false);
      
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Send Message', () => {
    it('should send message when connected', async () => {
      await client.connect();
      
      const sendSpy = vi.spyOn(client.ws, 'send');
      
      client.send('testEvent', { data: 'test' });
      
      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining('"type":"testEvent"')
      );
    });

    it('should throw error when sending while disconnected', () => {
      expect(() => {
        client.send('testEvent', { data: 'test' });
      }).toThrow('WebSocket is not connected');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration if not provided', () => {
      const defaultClient = new WebSocketClient();
      
      expect(defaultClient.maxReconnectAttempts).toBe(Infinity);
      expect(defaultClient.initialReconnectDelay).toBe(1000);
      expect(defaultClient.maxReconnectDelay).toBe(30000);
    });

    it('should use custom configuration', () => {
      const customClient = new WebSocketClient({
        url: 'ws://custom:8080',
        maxReconnectAttempts: 5,
        initialReconnectDelay: 500,
        maxReconnectDelay: 10000
      });
      
      expect(customClient.url).toBe('ws://custom:8080');
      expect(customClient.maxReconnectAttempts).toBe(5);
      expect(customClient.initialReconnectDelay).toBe(500);
      expect(customClient.maxReconnectDelay).toBe(10000);
    });

    it('should generate default WebSocket URL', () => {
      // Mock window.location
      global.window = {
        location: {
          protocol: 'http:',
          host: 'localhost:3000'
        }
      };
      
      const client = new WebSocketClient();
      expect(client.url).toBe('ws://localhost:3000');
      
      delete global.window;
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      await client.connect();
      client.disconnect();
      await client.connect();
      client.disconnect();
      await client.connect();
      
      expect(client.isConnected()).toBe(true);
    });

    it('should clean up listeners when removing last listener for event type', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      client.on('orderCreated', callback1);
      client.on('orderCreated', callback2);
      
      client.off('orderCreated', callback1);
      expect(client.listeners.has('orderCreated')).toBe(true);
      
      client.off('orderCreated', callback2);
      expect(client.listeners.has('orderCreated')).toBe(false);
    });

    it('should handle off() for non-existent event type', () => {
      const callback = vi.fn();
      
      // Should not throw error
      client.off('nonExistentEvent', callback);
    });

    it('should clear reconnect timeout on successful connection', async () => {
      client.reconnectTimeout = setTimeout(() => {}, 1000);
      
      await client.connect();
      
      expect(client.reconnectTimeout).toBeNull();
    });
  });
});
