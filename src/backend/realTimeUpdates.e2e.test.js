/**
 * Real-Time Update Integration Tests
 * Tests WebSocket updates across multiple clients
 * 
 * Requirements: 4.2, 7.4, 9.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import app, { httpServer } from './server.js';
import { writeTables, writeMenuItems, writeOrders } from './persistenceManager.js';

describe('Real-Time Update Integration Tests', () => {
  let wsClients = [];
  const WS_PORT = 3000;
  const WS_URL = `ws://localhost:${WS_PORT}`;

  beforeEach(async () => {
    // Clean up data
    await writeTables([]);
    await writeMenuItems([]);
    await writeOrders([]);
    
    // Ensure server is listening
    if (!httpServer.listening) {
      await new Promise((resolve) => {
        httpServer.listen(WS_PORT, resolve);
      });
    }
  });

  afterEach(async () => {
    // Close all WebSocket clients
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    wsClients = [];
    
    // Small delay to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Helper function to create a WebSocket client and wait for connection
   */
  function createWebSocketClient() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        wsClients.push(ws);
        resolve(ws);
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Helper function to wait for a specific message type
   */
  function waitForMessage(ws, messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);

      const messageHandler = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === messageType) {
            clearTimeout(timer);
            ws.off('message', messageHandler);
            resolve(message);
          }
        } catch (error) {
          // Ignore parse errors, continue waiting
        }
      };

      ws.on('message', messageHandler);
    });
  }

  describe('WebSocket updates across multiple clients', () => {
    it('should broadcast order status updates to all connected clients', async () => {
      // Create two WebSocket clients (kitchen and waiter)
      const kitchenClient = await createWebSocketClient();
      const waiterClient = await createWebSocketClient();

      // Wait for connection confirmations
      await waitForMessage(kitchenClient, 'connected');
      await waitForMessage(waiterClient, 'connected');

      // Setup: Create table, menu item, and order
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-ws-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Beef burger', price: 1200 })
        .expect(201);

      // Create order (should broadcast orderCreated event)
      const kitchenMessagePromise = waitForMessage(kitchenClient, 'orderCreated');
      const waiterMessagePromise = waitForMessage(waiterClient, 'orderCreated');

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Burger', quantity: 1, price: 1200 }]
        })
        .expect(201);

      const order = orderResponse.body;

      // Both clients should receive orderCreated event
      const kitchenMessage = await kitchenMessagePromise;
      const waiterMessage = await waiterMessagePromise;

      expect(kitchenMessage.type).toBe('orderCreated');
      expect(kitchenMessage.data.id).toBe(order.id);
      expect(waiterMessage.type).toBe('orderCreated');
      expect(waiterMessage.data.id).toBe(order.id);

      // Update order status (should broadcast orderStatusUpdate event)
      const kitchenStatusPromise = waitForMessage(kitchenClient, 'orderStatusUpdate');
      const waiterStatusPromise = waitForMessage(waiterClient, 'orderStatusUpdate');

      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      // Both clients should receive status update
      const kitchenStatusMessage = await kitchenStatusPromise;
      const waiterStatusMessage = await waiterStatusPromise;

      expect(kitchenStatusMessage.type).toBe('orderStatusUpdate');
      expect(kitchenStatusMessage.data.id).toBe(order.id);
      expect(kitchenStatusMessage.data.status).toBe('preparing');
      
      expect(waiterStatusMessage.type).toBe('orderStatusUpdate');
      expect(waiterStatusMessage.data.id).toBe(order.id);
      expect(waiterStatusMessage.data.status).toBe('preparing');
    });

    it('should broadcast menu item updates to all connected clients', async () => {
      // Create two WebSocket clients (customer and manager)
      const customerClient = await createWebSocketClient();
      const managerClient = await createWebSocketClient();

      await waitForMessage(customerClient, 'connected');
      await waitForMessage(managerClient, 'connected');

      // Create menu item
      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Pizza', description: 'Margherita pizza', price: 1500 })
        .expect(201);

      const menuItem = menuItemResponse.body;

      // Update menu item (should broadcast menuItemUpdate event)
      const customerMessagePromise = waitForMessage(customerClient, 'menuItemUpdate');
      const managerMessagePromise = waitForMessage(managerClient, 'menuItemUpdate');

      await request(app)
        .put(`/api/menu-items/${menuItem.id}`)
        .send({ available: false })
        .expect(200);

      // Both clients should receive menu update
      const customerMessage = await customerMessagePromise;
      const managerMessage = await managerMessagePromise;

      expect(customerMessage.type).toBe('menuItemUpdate');
      expect(customerMessage.data.id).toBe(menuItem.id);
      expect(customerMessage.data.available).toBe(false);

      expect(managerMessage.type).toBe('menuItemUpdate');
      expect(managerMessage.data.id).toBe(menuItem.id);
      expect(managerMessage.data.available).toBe(false);
    });

    it('should broadcast dashboard metrics updates to all connected clients', async () => {
      // Create dashboard clients
      const dashboardClient1 = await createWebSocketClient();
      const dashboardClient2 = await createWebSocketClient();

      await waitForMessage(dashboardClient1, 'connected');
      await waitForMessage(dashboardClient2, 'connected');

      // Setup: Create table and order
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-metrics-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Salad', description: 'Fresh salad', price: 800 })
        .expect(201);

      // Create order (should trigger metrics update)
      const metricsPromise1 = waitForMessage(dashboardClient1, 'metricsUpdate');
      const metricsPromise2 = waitForMessage(dashboardClient2, 'metricsUpdate');

      await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Salad', quantity: 1, price: 800 }]
        })
        .expect(201);

      // Both dashboard clients should receive metrics update
      const metricsMessage1 = await metricsPromise1;
      const metricsMessage2 = await metricsPromise2;

      expect(metricsMessage1.type).toBe('metricsUpdate');
      expect(metricsMessage1.data).toHaveProperty('activeTableCount');
      expect(metricsMessage1.data).toHaveProperty('orderCountsByStatus');
      expect(metricsMessage1.data).toHaveProperty('totalRevenue');

      expect(metricsMessage2.type).toBe('metricsUpdate');
      expect(metricsMessage2.data).toHaveProperty('activeTableCount');
    });

    it('should handle multiple simultaneous clients', async () => {
      // Create 5 clients
      const clients = await Promise.all([
        createWebSocketClient(),
        createWebSocketClient(),
        createWebSocketClient(),
        createWebSocketClient(),
        createWebSocketClient()
      ]);

      // Wait for all connections
      await Promise.all(clients.map(client => waitForMessage(client, 'connected')));

      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-multi-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Pasta', description: 'Italian pasta', price: 1400 })
        .expect(201);

      // Create order - all clients should receive the event
      const messagePromises = clients.map(client => waitForMessage(client, 'orderCreated'));

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 1, price: 1400 }]
        })
        .expect(201);

      const messages = await Promise.all(messagePromises);

      // All 5 clients should receive the same message
      expect(messages).toHaveLength(5);
      messages.forEach(message => {
        expect(message.type).toBe('orderCreated');
        expect(message.data.id).toBe(orderResponse.body.id);
      });
    });
  });

  describe('Connection recovery and error handling', () => {
    it('should handle client disconnection gracefully', async () => {
      // Create client
      const client = await createWebSocketClient();
      await waitForMessage(client, 'connected');

      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-disconnect-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Steak', description: 'Grilled steak', price: 2500 })
        .expect(201);

      // Disconnect client
      client.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create order - should not throw error even though client disconnected
      await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Steak', quantity: 1, price: 2500 }]
        })
        .expect(201);

      // No errors should occur
    });

    it('should allow client to reconnect after disconnection', async () => {
      // Create and disconnect client
      let client = await createWebSocketClient();
      await waitForMessage(client, 'connected');
      client.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reconnect
      client = await createWebSocketClient();
      const connectionMessage = await waitForMessage(client, 'connected');

      expect(connectionMessage.type).toBe('connected');
      expect(connectionMessage.message).toContain('WebSocket connection established');

      // Verify client can receive updates after reconnection
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-reconnect-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Coffee', description: 'Hot coffee', price: 300 })
        .expect(201);

      const messagePromise = waitForMessage(client, 'orderCreated');

      await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Coffee', quantity: 1, price: 300 }]
        })
        .expect(201);

      const message = await messagePromise;
      expect(message.type).toBe('orderCreated');
    });

    it('should handle rapid successive updates', async () => {
      const client = await createWebSocketClient();
      await waitForMessage(client, 'connected');

      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-rapid-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Soda', description: 'Cold soda', price: 300 })
        .expect(201);

      // Create order
      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Soda', quantity: 1, price: 300 }]
        })
        .expect(201);

      const order = orderResponse.body;

      // Collect all messages
      const receivedMessages = [];
      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'orderStatusUpdate') {
            receivedMessages.push(message);
          }
        } catch (error) {
          // Ignore parse errors
        }
      });

      // Rapidly update order status multiple times
      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      // Wait for messages to arrive
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should receive all 3 status updates
      expect(receivedMessages.length).toBeGreaterThanOrEqual(3);
      
      const statuses = receivedMessages.map(m => m.data.status);
      expect(statuses).toContain('preparing');
      expect(statuses).toContain('ready');
      expect(statuses).toContain('served');
    });
  });

  describe('Message format and data integrity', () => {
    it('should send messages with correct format and timestamp', async () => {
      const client = await createWebSocketClient();
      await waitForMessage(client, 'connected');

      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-format-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Juice', description: 'Fresh juice', price: 400 })
        .expect(201);

      // Create order and capture message
      const messagePromise = waitForMessage(client, 'orderCreated');

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Juice', quantity: 1, price: 400 }]
        })
        .expect(201);

      const message = await messagePromise;

      // Verify message format
      expect(message).toHaveProperty('type');
      expect(message).toHaveProperty('data');
      expect(message).toHaveProperty('timestamp');
      expect(typeof message.timestamp).toBe('number');
      expect(message.timestamp).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds

      // Verify data integrity
      expect(message.data.id).toBe(orderResponse.body.id);
      expect(message.data.tableId).toBe(tableResponse.body.id);
      expect(message.data.status).toBe('pending');
      expect(message.data.totalPrice).toBe(400);
    });

    it('should include complete order data in broadcasts', async () => {
      const client = await createWebSocketClient();
      await waitForMessage(client, 'connected');

      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-data-001' })
        .expect(201);

      const menuItem1Response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Beef burger', price: 1200 })
        .expect(201);

      const menuItem2Response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Fries', description: 'Crispy fries', price: 500 })
        .expect(201);

      // Create order with multiple items
      const messagePromise = waitForMessage(client, 'orderCreated');

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [
            { menuItemId: menuItem1Response.body.id, name: 'Burger', quantity: 1, price: 1200 },
            { menuItemId: menuItem2Response.body.id, name: 'Fries', quantity: 2, price: 500 }
          ]
        })
        .expect(201);

      const message = await messagePromise;

      // Verify complete order data
      expect(message.data.items).toHaveLength(2);
      expect(message.data.items[0].name).toBe('Burger');
      expect(message.data.items[0].quantity).toBe(1);
      expect(message.data.items[1].name).toBe('Fries');
      expect(message.data.items[1].quantity).toBe(2);
      expect(message.data.totalPrice).toBe(2200); // 1200 + (500 * 2)
    });
  });
});
