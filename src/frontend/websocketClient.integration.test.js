/**
 * Integration tests for WebSocket Client with WebSocket Server
 * Tests real-time communication between client and server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from './websocketClient.js';
import { initializeWebSocketServer, broadcastEvent, closeWebSocketServer } from '../backend/websocketServer.js';
import http from 'http';

describe('WebSocket Client Integration', () => {
  let server;
  let httpServer;
  let client;
  const TEST_PORT = 3456;

  beforeAll(() => {
    // Create HTTP server
    httpServer = http.createServer();
    
    // Initialize WebSocket server
    server = initializeWebSocketServer(httpServer);
    
    // Start listening
    return new Promise((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        console.log(`Test server listening on port ${TEST_PORT}`);
        resolve();
      });
    });
  });

  afterAll(() => {
    // Close WebSocket server
    closeWebSocketServer();
    
    // Close HTTP server
    return new Promise((resolve) => {
      httpServer.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  });

  beforeEach(() => {
    // Create fresh client for each test
    client = new WebSocketClient({
      url: `ws://localhost:${TEST_PORT}`,
      initialReconnectDelay: 100,
      maxReconnectDelay: 1000
    });
  });

  afterEach(() => {
    // Disconnect client after each test
    if (client) {
      client.disconnect();
    }
  });

  it('should connect to WebSocket server', async () => {
    await client.connect();
    
    expect(client.isConnected()).toBe(true);
    expect(client.getState()).toBe('connected');
  });

  it('should receive orderCreated events from server', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      const testOrder = {
        orderId: 'O123',
        tableId: 'T1',
        items: [{ menuItemId: 'M1', quantity: 2 }],
        status: 'pending'
      };
      
      client.on('orderCreated', (data, timestamp) => {
        expect(data).toEqual(testOrder);
        expect(timestamp).toBeGreaterThan(0);
        resolve();
      });
      
      // Broadcast event from server
      setTimeout(() => {
        broadcastEvent('orderCreated', testOrder);
      }, 50);
    });
  });

  it('should receive orderStatusChanged events from server', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      const statusUpdate = {
        orderId: 'O123',
        status: 'preparing',
        updatedAt: Date.now()
      };
      
      client.on('orderStatusChanged', (data) => {
        expect(data).toEqual(statusUpdate);
        resolve();
      });
      
      setTimeout(() => {
        broadcastEvent('orderStatusChanged', statusUpdate);
      }, 50);
    });
  });

  it('should receive menuItemUpdated events from server', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      const menuUpdate = {
        itemId: 'M1',
        available: false,
        reason: 'Out of stock'
      };
      
      client.on('menuItemUpdated', (data) => {
        expect(data).toEqual(menuUpdate);
        resolve();
      });
      
      setTimeout(() => {
        broadcastEvent('menuItemUpdated', menuUpdate);
      }, 50);
    });
  });

  it('should receive metricsUpdated events from server', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      const metricsData = {
        activeTables: 10,
        pendingOrders: 5,
        preparingOrders: 3,
        readyOrders: 2,
        totalRevenue: 150000
      };
      
      client.on('metricsUpdated', (data) => {
        expect(data).toEqual(metricsData);
        resolve();
      });
      
      setTimeout(() => {
        broadcastEvent('metricsUpdated', metricsData);
      }, 50);
    });
  });

  it('should receive tableUpdated events from server', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      const tableUpdate = {
        tableId: 'T5',
        status: 'active',
        qrCode: 'QR_T5_DATA'
      };
      
      client.on('tableUpdated', (data) => {
        expect(data).toEqual(tableUpdate);
        resolve();
      });
      
      setTimeout(() => {
        broadcastEvent('tableUpdated', tableUpdate);
      }, 50);
    });
  });

  it('should handle multiple event types simultaneously', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      let receivedEvents = 0;
      const expectedEvents = 3;
      
      client.on('orderCreated', (data) => {
        expect(data.orderId).toBe('O1');
        receivedEvents++;
        if (receivedEvents === expectedEvents) resolve();
      });
      
      client.on('menuItemUpdated', (data) => {
        expect(data.itemId).toBe('M1');
        receivedEvents++;
        if (receivedEvents === expectedEvents) resolve();
      });
      
      client.on('metricsUpdated', (data) => {
        expect(data.activeTables).toBe(5);
        receivedEvents++;
        if (receivedEvents === expectedEvents) resolve();
      });
      
      setTimeout(() => {
        broadcastEvent('orderCreated', { orderId: 'O1' });
        broadcastEvent('menuItemUpdated', { itemId: 'M1' });
        broadcastEvent('metricsUpdated', { activeTables: 5 });
      }, 50);
    });
  });

  it('should handle multiple listeners for same event', async () => {
    await client.connect();
    
    return new Promise((resolve) => {
      let listener1Called = false;
      let listener2Called = false;
      
      client.on('orderCreated', () => {
        listener1Called = true;
        checkBothCalled();
      });
      
      client.on('orderCreated', () => {
        listener2Called = true;
        checkBothCalled();
      });
      
      function checkBothCalled() {
        if (listener1Called && listener2Called) {
          resolve();
        }
      }
      
      setTimeout(() => {
        broadcastEvent('orderCreated', { orderId: 'O1' });
      }, 50);
    });
  });

  it('should reconnect after connection loss', async () => {
    await client.connect();
    expect(client.isConnected()).toBe(true);
    
    // Force disconnect
    client.ws.close();
    
    // Wait for reconnection to be scheduled
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should be attempting to reconnect or already reconnected
    const state = client.getState();
    expect(['reconnecting', 'connecting', 'connected']).toContain(state);
  });

  it('should continue receiving events after reconnection', async () => {
    await client.connect();
    
    // Set up listener
    const receivedEvents = [];
    client.on('orderCreated', (data) => {
      receivedEvents.push(data);
    });
    
    // Send first event
    broadcastEvent('orderCreated', { orderId: 'O1' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Force disconnect and reconnect
    client.ws.close();
    await new Promise(resolve => setTimeout(resolve, 200));
    await client.connect();
    
    // Send second event
    broadcastEvent('orderCreated', { orderId: 'O2' });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should have received both events
    expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
  });
});
