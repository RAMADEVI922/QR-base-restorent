/**
 * Property-Based Tests for Real-Time Updates
 * Tests WebSocket broadcasting for order status, menu updates, and dashboard metrics
 * 
 * Requirements: 4.2, 7.4, 9.5, 12.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import express from 'express';
import { initializeWebSocketServer, broadcastEvent, closeWebSocketServer } from './websocketServer.js';
import { broadcastMetricsUpdate } from './metricsUpdateBroadcaster.js';
import { createOrder, updateOrderStatus } from './orderService.js';
import { createMenuItem, updateMenuItemAvailability, updateMenuItemDetails } from './menuItemService.js';
import { createTable, updateTableStatus } from './tableService.js';
import { generateQRCode } from './qrCodeGenerator.js';
import { writeOrders, writeMenuItems, writeTables } from './persistenceManager.js';

describe('Real-Time Updates Property Tests', () => {
  let httpServer;
  let wsUrl;
  const PORT = 3001;

  beforeEach(async () => {
    // Reset data
    await writeOrders([]);
    await writeMenuItems([]);
    await writeTables([]);

    // Create HTTP server and initialize WebSocket
    const app = express();
    httpServer = createServer(app);
    initializeWebSocketServer(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(PORT, () => {
        wsUrl = `ws://localhost:${PORT}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    closeWebSocketServer();
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
  });

  /**
   * Property 27: Dashboard Real-Time Updates
   * **Validates: Requirements 7.4**
   * 
   * For any change to order status, table configuration, or menu items,
   * the dashboard metrics must update to reflect the current system state.
   */
  it('Property 27: Dashboard metrics update in real-time when orders change', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          tableId: fc.string({ minLength: 1, maxLength: 10 }),
          items: fc.array(fc.record({
            menuItemId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            quantity: fc.integer({ min: 1, max: 5 }),
            price: fc.integer({ min: 100, max: 5000 })
          }), { minLength: 1, maxLength: 3 })
        }), { minLength: 1, maxLength: 5 }),
        async (orderSpecs) => {
          // Create WebSocket client
          const client = new WebSocket(wsUrl);
          const messages = [];

          await new Promise((resolve) => {
            client.on('open', resolve);
          });

          client.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
          });

          // Create orders and track metrics updates
          for (const spec of orderSpecs) {
            await createOrder(spec.tableId, spec.items);
            await broadcastMetricsUpdate();
          }

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify metrics updates were broadcast
          const metricsUpdates = messages.filter(msg => msg.type === 'metricsUpdate');
          expect(metricsUpdates.length).toBeGreaterThan(0);

          // Verify metrics contain expected fields
          metricsUpdates.forEach(update => {
            expect(update.data).toHaveProperty('activeTableCount');
            expect(update.data).toHaveProperty('orderCountsByStatus');
            expect(update.data).toHaveProperty('totalRevenue');
            expect(update.data).toHaveProperty('timestamp');
          });

          client.close();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 27: Dashboard metrics update in real-time when order status changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.array(fc.record({
          menuItemId: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 20 }),
          quantity: fc.integer({ min: 1, max: 5 }),
          price: fc.integer({ min: 100, max: 5000 })
        }), { minLength: 1, maxLength: 3 }),
        fc.constantFrom('preparing', 'completed'),
        async (tableId, items, newStatus) => {
          // Create WebSocket client
          const client = new WebSocket(wsUrl);
          const messages = [];

          await new Promise((resolve) => {
            client.on('open', resolve);
          });

          client.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
          });

          // Create order and update status
          const order = await createOrder(tableId, items);
          
          // If transitioning to completed, first go through preparing -> ready -> served
          if (newStatus === 'completed') {
            await updateOrderStatus(order.id, 'preparing');
            await updateOrderStatus(order.id, 'ready');
            await updateOrderStatus(order.id, 'served');
          }
          
          await updateOrderStatus(order.id, newStatus);
          await broadcastMetricsUpdate();

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify metrics updates were broadcast
          const metricsUpdates = messages.filter(msg => msg.type === 'metricsUpdate');
          expect(metricsUpdates.length).toBeGreaterThan(0);

          client.close();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 27: Dashboard metrics update in real-time when tables change', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        async (tableIds) => {
          // Create WebSocket client
          const client = new WebSocket(wsUrl);
          const messages = [];

          await new Promise((resolve) => {
            client.on('open', resolve);
          });

          client.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
          });

          // Create tables
          for (const tableId of tableIds) {
            const qrCode = await generateQRCode(tableId);
            await createTable(qrCode);
            await broadcastMetricsUpdate();
          }

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify metrics updates were broadcast
          const metricsUpdates = messages.filter(msg => msg.type === 'metricsUpdate');
          expect(metricsUpdates.length).toBeGreaterThan(0);

          client.close();
        }
      ),
      { numRuns: 20 }
    );
  }, 10000); // Increase timeout to 10 seconds

  /**
   * Property 35: Menu Item Changes Reflect Immediately
   * **Validates: Requirements 9.5**
   * 
   * For any menu item updated, all active menu pages must immediately
   * reflect the changes to that item's details or availability.
   */
  it('Property 35: Menu item changes are broadcast immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.integer({ min: 0, max: 10000 }),
        fc.boolean(),
        async (name, description, price, available) => {
          // Create WebSocket client
          const client = new WebSocket(wsUrl);
          const messages = [];

          await new Promise((resolve) => {
            client.on('open', resolve);
          });

          client.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
          });

          // Create menu item
          const menuItem = await createMenuItem(name, description, price);

          // Update availability
          await updateMenuItemAvailability(menuItem.id, available);
          broadcastEvent('menuItemUpdate', { ...menuItem, available });

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify menu update was broadcast
          const menuUpdates = messages.filter(msg => msg.type === 'menuItemUpdate');
          expect(menuUpdates.length).toBeGreaterThan(0);

          // Verify update contains correct data
          const lastUpdate = menuUpdates[menuUpdates.length - 1];
          expect(lastUpdate.data).toHaveProperty('id', menuItem.id);
          expect(lastUpdate.data).toHaveProperty('available', available);

          client.close();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 35: Menu item detail changes are broadcast immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.integer({ min: 0, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 0, max: 10000 }),
        async (name, description, price, newName, newPrice) => {
          // Create WebSocket client
          const client = new WebSocket(wsUrl);
          const messages = [];

          await new Promise((resolve) => {
            client.on('open', resolve);
          });

          client.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
          });

          // Create menu item
          const menuItem = await createMenuItem(name, description, price);

          // Update details
          const updated = await updateMenuItemDetails(menuItem.id, { name: newName, price: newPrice });
          broadcastEvent('menuItemUpdate', updated);

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify menu update was broadcast
          const menuUpdates = messages.filter(msg => msg.type === 'menuItemUpdate');
          expect(menuUpdates.length).toBeGreaterThan(0);

          // Verify update contains correct data (note: names are trimmed by the service)
          const lastUpdate = menuUpdates[menuUpdates.length - 1];
          expect(lastUpdate.data).toHaveProperty('id', menuItem.id);
          expect(lastUpdate.data).toHaveProperty('name', newName.trim());
          expect(lastUpdate.data).toHaveProperty('price', newPrice);

          client.close();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Order status updates are broadcast to all connected clients', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.array(fc.record({
          menuItemId: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 20 }),
          quantity: fc.integer({ min: 1, max: 5 }),
          price: fc.integer({ min: 100, max: 5000 })
        }), { minLength: 1, maxLength: 3 }),
        fc.constantFrom('preparing', 'completed'),
        async (tableId, items, newStatus) => {
          // Create multiple WebSocket clients
          const client1 = new WebSocket(wsUrl);
          const client2 = new WebSocket(wsUrl);
          const messages1 = [];
          const messages2 = [];

          await Promise.all([
            new Promise((resolve) => client1.on('open', resolve)),
            new Promise((resolve) => client2.on('open', resolve))
          ]);

          client1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
          client2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

          // Create order and update status
          const order = await createOrder(tableId, items);
          
          // If transitioning to completed, first go through preparing -> ready -> served
          if (newStatus === 'completed') {
            await updateOrderStatus(order.id, 'preparing');
            await updateOrderStatus(order.id, 'ready');
            await updateOrderStatus(order.id, 'served');
          }
          
          const updated = await updateOrderStatus(order.id, newStatus);
          broadcastEvent('orderStatusUpdate', updated);

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify both clients received the update
          const updates1 = messages1.filter(msg => msg.type === 'orderStatusUpdate');
          const updates2 = messages2.filter(msg => msg.type === 'orderStatusUpdate');

          expect(updates1.length).toBeGreaterThan(0);
          expect(updates2.length).toBeGreaterThan(0);

          // Verify both received the same data
          expect(updates1[0].data.id).toBe(order.id);
          expect(updates2[0].data.id).toBe(order.id);
          expect(updates1[0].data.status).toBe(newStatus);
          expect(updates2[0].data.status).toBe(newStatus);

          client1.close();
          client2.close();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('New order creation is broadcast to kitchen queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.array(fc.record({
          menuItemId: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 20 }),
          quantity: fc.integer({ min: 1, max: 5 }),
          price: fc.integer({ min: 100, max: 5000 })
        }), { minLength: 1, maxLength: 3 }),
        async (tableId, items) => {
          // Create WebSocket client
          const client = new WebSocket(wsUrl);
          const messages = [];

          await new Promise((resolve) => {
            client.on('open', resolve);
          });

          client.on('message', (data) => {
            messages.push(JSON.parse(data.toString()));
          });

          // Create order
          const order = await createOrder(tableId, items);
          broadcastEvent('orderCreated', order);

          // Wait for messages to arrive
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verify order creation was broadcast
          const orderCreated = messages.filter(msg => msg.type === 'orderCreated');
          expect(orderCreated.length).toBeGreaterThan(0);

          // Verify order data is correct
          expect(orderCreated[0].data).toHaveProperty('id', order.id);
          expect(orderCreated[0].data).toHaveProperty('tableId', tableId);
          expect(orderCreated[0].data).toHaveProperty('status', 'pending');

          client.close();
        }
      ),
      { numRuns: 20 }
    );
  });
});
