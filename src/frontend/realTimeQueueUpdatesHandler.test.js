/**
 * Unit tests for Real-Time Queue Updates Handler
 * Tests WebSocket connection and real-time update handling
 * 
 * Requirements: 4.2, 5.3, 12.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RealTimeQueueUpdatesHandler from './realTimeQueueUpdatesHandler.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    // Mock send method
  }

  close(code, reason) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }
}

// WebSocket constants
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;

describe('RealTimeQueueUpdatesHandler', () => {
  let handler;
  let mockWindow;
  let mockDocument;

  beforeEach(() => {
    mockWindow = {
      location: {
        protocol: 'http:',
        host: 'localhost:3000'
      }
    };

    mockDocument = {
      addEventListener: vi.fn(),
      hidden: false
    };

    global.window = mockWindow;
    global.document = mockDocument;
    global.setTimeout = vi.fn((fn, delay) => {
      // Execute immediately for testing
      fn();
      return 1;
    });

    handler = new RealTimeQueueUpdatesHandler();
  });

  afterEach(() => {
    if (handler) {
      handler.disconnect();
    }
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(handler.isConnected).toBe(false);
      expect(handler.reconnectAttempts).toBe(0);
      expect(handler.updateCallbacks).toEqual([]);
      expect(handler.connectionCallbacks).toEqual([]);
    });

    it('should setup visibility handling', () => {
      handler.init();
      
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('WebSocket Connection', () => {
    it('should create WebSocket connection with correct URL', () => {
      handler.connect();
      
      expect(handler.websocket).toBeInstanceOf(MockWebSocket);
      expect(handler.websocket.url).toBe('ws://localhost:3000');
    });

    it('should use wss for HTTPS', () => {
      mockWindow.location.protocol = 'https:';
      
      handler.connect();
      
      expect(handler.websocket.url).toBe('wss://localhost:3000');
    });

    it('should handle connection success', (done) => {
      const connectionCallback = vi.fn();
      handler.onConnection(connectionCallback);
      
      handler.connect();
      
      setTimeout(() => {
        expect(handler.isConnected).toBe(true);
        expect(handler.reconnectAttempts).toBe(0);
        expect(connectionCallback).toHaveBeenCalledWith('connected');
        done();
      }, 20);
    });

    it('should handle connection errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock WebSocket constructor to throw
      global.WebSocket = vi.fn(() => {
        throw new Error('Connection failed');
      });
      
      handler.connect();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error creating WebSocket connection:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      handler.init();
    });

    it('should handle orderCreated messages', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      const order = { id: '1', status: 'pending', tableId: 'T1' };
      const message = { type: 'orderCreated', data: order };
      
      handler.handleWebSocketMessage(message);
      
      expect(updateCallback).toHaveBeenCalledWith('orderAdded', order);
    });

    it('should handle orderStatusUpdate messages for queue orders', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      const order = { id: '1', status: 'preparing', tableId: 'T1' };
      const message = { type: 'orderStatusUpdate', data: order };
      
      handler.handleWebSocketMessage(message);
      
      expect(updateCallback).toHaveBeenCalledWith('orderUpdated', order);
    });

    it('should handle orderStatusUpdate messages for served orders', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      const order = { id: '1', status: 'served', tableId: 'T1' };
      const message = { type: 'orderStatusUpdate', data: order };
      
      handler.handleWebSocketMessage(message);
      
      expect(updateCallback).toHaveBeenCalledWith('orderRemoved', order);
    });

    it('should handle orderStatusUpdate messages for completed orders', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      const order = { id: '1', status: 'completed', tableId: 'T1' };
      const message = { type: 'orderStatusUpdate', data: order };
      
      handler.handleWebSocketMessage(message);
      
      expect(updateCallback).toHaveBeenCalledWith('orderRemoved', order);
    });

    it('should handle metricsUpdate messages', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      const metrics = { activeOrders: 5, totalRevenue: 12500 };
      const message = { type: 'metricsUpdate', data: metrics };
      
      handler.handleWebSocketMessage(message);
      
      expect(updateCallback).toHaveBeenCalledWith('metricsUpdated', metrics);
    });

    it('should handle menuItemUpdate messages', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      const menuItem = { id: '1', name: 'Pizza', available: false };
      const message = { type: 'menuItemUpdate', data: menuItem };
      
      handler.handleWebSocketMessage(message);
      
      expect(updateCallback).toHaveBeenCalledWith('menuItemUpdated', menuItem);
    });

    it('should handle unknown message types gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const message = { type: 'unknown', data: {} };
      handler.handleWebSocketMessage(message);
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown WebSocket message type:', 'unknown');
      consoleSpy.mockRestore();
    });

    it('should handle malformed messages gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate receiving malformed JSON
      const mockEvent = { data: 'invalid json' };
      handler.websocket = { onmessage: null };
      handler.setupWebSocketEventListeners();
      
      handler.websocket.onmessage(mockEvent);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error parsing WebSocket message:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should only show pending/preparing orders in queue', () => {
      const updateCallback = vi.fn();
      handler.onUpdate(updateCallback);
      
      // Test different statuses
      const readyOrder = { id: '1', status: 'ready', tableId: 'T1' };
      const servedOrder = { id: '2', status: 'served', tableId: 'T2' };
      
      handler.handleNewOrder(readyOrder);
      handler.handleNewOrder(servedOrder);
      
      // Should not trigger orderAdded for ready/served orders
      expect(updateCallback).not.toHaveBeenCalled();
      
      const pendingOrder = { id: '3', status: 'pending', tableId: 'T3' };
      handler.handleNewOrder(pendingOrder);
      
      expect(updateCallback).toHaveBeenCalledWith('orderAdded', pendingOrder);
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      handler.init();
    });

    it('should schedule reconnection on connection loss', () => {
      const connectionCallback = vi.fn();
      handler.onConnection(connectionCallback);
      
      // Simulate connection loss
      handler.websocket.onclose({ code: 1006, reason: 'Connection lost' });
      
      expect(handler.isConnected).toBe(false);
      expect(connectionCallback).toHaveBeenCalledWith('disconnected');
      expect(handler.reconnectAttempts).toBe(1);
    });

    it('should not reconnect on clean close', () => {
      const connectionCallback = vi.fn();
      handler.onConnection(connectionCallback);
      
      // Simulate clean close
      handler.websocket.onclose({ code: 1000, reason: 'Normal closure' });
      
      expect(handler.reconnectAttempts).toBe(0);
    });

    it('should stop reconnecting after max attempts', () => {
      const connectionCallback = vi.fn();
      handler.onConnection(connectionCallback);
      
      handler.reconnectAttempts = handler.maxReconnectAttempts;
      handler.scheduleReconnect();
      
      expect(connectionCallback).toHaveBeenCalledWith('maxReconnectAttemptsReached');
    });

    it('should use exponential backoff for reconnection', () => {
      handler.reconnectAttempts = 2;
      handler.reconnectDelay = 1000;
      
      handler.scheduleReconnect();
      
      // Should use exponential backoff: 1000 * 2^(2-1) = 2000ms
      expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
    });
  });

  describe('Callback Management', () => {
    it('should add and remove update callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      handler.onUpdate(callback1);
      handler.onUpdate(callback2);
      
      expect(handler.updateCallbacks).toHaveLength(2);
      
      handler.offUpdate(callback1);
      
      expect(handler.updateCallbacks).toHaveLength(1);
      expect(handler.updateCallbacks[0]).toBe(callback2);
    });

    it('should add and remove connection callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      handler.onConnection(callback1);
      handler.onConnection(callback2);
      
      expect(handler.connectionCallbacks).toHaveLength(2);
      
      handler.offConnection(callback1);
      
      expect(handler.connectionCallbacks).toHaveLength(1);
      expect(handler.connectionCallbacks[0]).toBe(callback2);
    });

    it('should handle callback errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      const normalCallback = vi.fn();
      
      handler.onUpdate(errorCallback);
      handler.onUpdate(normalCallback);
      
      handler.notifyUpdateCallbacks('test', {});
      
      expect(consoleSpy).toHaveBeenCalledWith('Error in real-time update callback:', expect.any(Error));
      expect(normalCallback).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should ignore non-function callbacks', () => {
      handler.onUpdate('not a function');
      handler.onConnection(123);
      
      expect(handler.updateCallbacks).toHaveLength(0);
      expect(handler.connectionCallbacks).toHaveLength(0);
    });
  });

  describe('Connection Status', () => {
    it('should return connection status', () => {
      handler.isConnected = true;
      handler.reconnectAttempts = 2;
      handler.websocket = { readyState: WebSocket.OPEN };
      
      const status = handler.getConnectionStatus();
      
      expect(status).toEqual({
        isConnected: true,
        reconnectAttempts: 2,
        websocketState: WebSocket.OPEN
      });
    });
  });

  describe('Manual Operations', () => {
    beforeEach(() => {
      handler.init();
    });

    it('should manually reconnect', () => {
      const closeSpy = vi.spyOn(handler.websocket, 'close');
      
      handler.reconnect();
      
      expect(closeSpy).toHaveBeenCalled();
      expect(handler.reconnectAttempts).toBe(0);
    });

    it('should disconnect cleanly', () => {
      const closeSpy = vi.spyOn(handler.websocket, 'close');
      
      handler.disconnect();
      
      expect(closeSpy).toHaveBeenCalledWith(1000, 'Manual disconnect');
      expect(handler.websocket).toBeNull();
      expect(handler.isConnected).toBe(false);
    });

    it('should send messages when connected', () => {
      handler.isConnected = true;
      handler.websocket = { send: vi.fn() };
      
      handler.sendMessage('test', { data: 'test' });
      
      expect(handler.websocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test', data: { data: 'test' }, timestamp: expect.any(Number) })
      );
    });

    it('should not send messages when disconnected', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      handler.isConnected = false;
      
      handler.sendMessage('test', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Cannot send message: WebSocket not connected');
      consoleSpy.mockRestore();
    });
  });

  describe('Page Visibility Handling', () => {
    it('should handle page visibility changes', () => {
      handler.init();
      
      // Get the visibility change handler
      const visibilityHandler = mockDocument.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')[1];
      
      // Simulate page becoming hidden
      mockDocument.hidden = true;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      visibilityHandler();
      
      expect(consoleSpy).toHaveBeenCalledWith('Page hidden, WebSocket remains active');
      consoleSpy.mockRestore();
    });

    it('should reconnect when page becomes visible and disconnected', () => {
      handler.init();
      handler.isConnected = false;
      handler.websocket = { readyState: WebSocket.CLOSED };
      
      const connectSpy = vi.spyOn(handler, 'connect');
      
      // Get the visibility change handler
      const visibilityHandler = mockDocument.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')[1];
      
      // Simulate page becoming visible
      mockDocument.hidden = false;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      visibilityHandler();
      
      expect(consoleSpy).toHaveBeenCalledWith('Page visible, reconnecting WebSocket');
      expect(connectSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});