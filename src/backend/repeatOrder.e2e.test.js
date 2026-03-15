/**
 * Repeat Order Workflow Integration Tests
 * Tests repeat order functionality from the same table
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from './server.js';
import { writeTables, writeMenuItems, writeOrders } from './persistenceManager.js';

describe('Repeat Order Workflow Tests', () => {
  beforeEach(async () => {
    // Clean up data before each test
    await writeTables([]);
    await writeMenuItems([]);
    await writeOrders([]);
  });

  describe('Repeat order flow from same table', () => {
    it('should allow customer to place repeat order at same table', async () => {
      // Setup: Create table and menu items
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-repeat-001' })
        .expect(201);

      const table = tableResponse.body;

      const menuItem1Response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Pizza', description: 'Margherita pizza', price: 1500 })
        .expect(201);

      const menuItem2Response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Soda', description: 'Cold soda', price: 300 })
        .expect(201);

      // Step 1: Customer places first order
      const firstOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: table.id,
          items: [
            { menuItemId: menuItem1Response.body.id, name: 'Pizza', quantity: 1, price: 1500 }
          ]
        })
        .expect(201);

      const firstOrder = firstOrderResponse.body;
      expect(firstOrder.tableId).toBe(table.id);
      expect(firstOrder.status).toBe('pending');

      // Step 2: Complete first order workflow (preparing → ready → served)
      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      // Step 3: Customer scans QR code again (same table)
      const validateResponse = await request(app)
        .get(`/api/tables/${table.id}/validate`)
        .expect(200);

      expect(validateResponse.body.valid).toBe(true);
      expect(validateResponse.body.tableId).toBe(table.id);

      // Step 4: Customer places repeat order at same table
      const repeatOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: table.id,
          items: [
            { menuItemId: menuItem2Response.body.id, name: 'Soda', quantity: 2, price: 300 }
          ],
          previousOrderId: firstOrder.id // Link to previous order
        })
        .expect(201);

      const repeatOrder = repeatOrderResponse.body;

      // Verify repeat order is linked to same table
      expect(repeatOrder.tableId).toBe(table.id);
      expect(repeatOrder.tableId).toBe(firstOrder.tableId);

      // Verify repeat order is a new order with unique ID
      expect(repeatOrder.id).not.toBe(firstOrder.id);
      expect(repeatOrder.status).toBe('pending');

      // Verify repeat order has different items
      expect(repeatOrder.items).toHaveLength(1);
      expect(repeatOrder.items[0].name).toBe('Soda');
      expect(repeatOrder.totalPrice).toBe(600); // 300 * 2
    });

    it('should maintain reference to original order in repeat order', async () => {
      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-repeat-002' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Beef burger', price: 1200 })
        .expect(201);

      // Create first order
      const firstOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Burger', quantity: 1, price: 1200 }]
        })
        .expect(201);

      const firstOrder = firstOrderResponse.body;

      // Mark first order as served
      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      // Create repeat order with reference to original
      const repeatOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Burger', quantity: 2, price: 1200 }],
          previousOrderId: firstOrder.id
        })
        .expect(201);

      const repeatOrder = repeatOrderResponse.body;

      // Verify relationship is maintained
      expect(repeatOrder.previousOrderId).toBe(firstOrder.id);

      // Get table order history to verify both orders are linked
      const historyResponse = await request(app)
        .get(`/api/tables/${tableResponse.body.id}/orders`)
        .expect(200);

      expect(historyResponse.body).toHaveLength(2);
      expect(historyResponse.body[0].id).toBe(firstOrder.id);
      expect(historyResponse.body[1].id).toBe(repeatOrder.id);
    });

    it('should display repeat orders on queue as new orders', async () => {
      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-repeat-003' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Salad', description: 'Caesar salad', price: 800 })
        .expect(201);

      // Create and complete first order
      const firstOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Salad', quantity: 1, price: 800 }]
        })
        .expect(201);

      const firstOrder = firstOrderResponse.body;

      // Complete first order
      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${firstOrder.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      // First order should not be on queue (served status)
      let queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(0);

      // Create repeat order
      const repeatOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Salad', quantity: 1, price: 800 }],
          previousOrderId: firstOrder.id
        })
        .expect(201);

      const repeatOrder = repeatOrderResponse.body;

      // Repeat order should appear on queue as new order
      queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(1);
      expect(queueResponse.body[0].id).toBe(repeatOrder.id);
      expect(queueResponse.body[0].status).toBe('pending');
      expect(queueResponse.body[0].tableId).toBe(tableResponse.body.id);
    });
  });

  describe('Order history maintenance', () => {
    it('should maintain complete order history for table with multiple orders', async () => {
      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-history-001' })
        .expect(201);

      const table = tableResponse.body;

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Pasta', description: 'Italian pasta', price: 1400 })
        .expect(201);

      // Create multiple orders over time
      const order1Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: table.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 1, price: 1400 }]
        })
        .expect(201);

      // Complete first order
      await request(app)
        .put(`/api/orders/${order1Response.body.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order1Response.body.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order1Response.body.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order1Response.body.id}/status`)
        .send({ status: 'completed' })
        .expect(200);

      // Create second order (repeat)
      const order2Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: table.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 2, price: 1400 }],
          previousOrderId: order1Response.body.id
        })
        .expect(201);

      // Complete second order
      await request(app)
        .put(`/api/orders/${order2Response.body.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order2Response.body.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${order2Response.body.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      // Create third order (another repeat)
      const order3Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: table.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 1, price: 1400 }],
          previousOrderId: order2Response.body.id
        })
        .expect(201);

      // Get table order history
      const historyResponse = await request(app)
        .get(`/api/tables/${table.id}/orders`)
        .expect(200);

      const history = historyResponse.body;

      // Verify all orders are in history
      expect(history).toHaveLength(3);

      // Verify orders are sorted by creation time
      expect(history[0].id).toBe(order1Response.body.id);
      expect(history[1].id).toBe(order2Response.body.id);
      expect(history[2].id).toBe(order3Response.body.id);

      // Verify order statuses
      expect(history[0].status).toBe('completed');
      expect(history[1].status).toBe('served');
      expect(history[2].status).toBe('pending');

      // Verify order relationships
      expect(history[1].previousOrderId).toBe(history[0].id);
      expect(history[2].previousOrderId).toBe(history[1].id);
    });

    it('should include both active and completed orders in history', async () => {
      // Setup
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-history-002' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Steak', description: 'Grilled steak', price: 2500 })
        .expect(201);

      // Create completed order
      const completedOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Steak', quantity: 1, price: 2500 }]
        })
        .expect(201);

      await request(app)
        .put(`/api/orders/${completedOrderResponse.body.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${completedOrderResponse.body.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${completedOrderResponse.body.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      await request(app)
        .put(`/api/orders/${completedOrderResponse.body.id}/status`)
        .send({ status: 'completed' })
        .expect(200);

      // Create active order
      const activeOrderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Steak', quantity: 1, price: 2500 }],
          previousOrderId: completedOrderResponse.body.id
        })
        .expect(201);

      // Get history
      const historyResponse = await request(app)
        .get(`/api/tables/${tableResponse.body.id}/orders`)
        .expect(200);

      // Verify both orders are included
      expect(historyResponse.body).toHaveLength(2);
      
      const completedOrder = historyResponse.body.find(o => o.id === completedOrderResponse.body.id);
      const activeOrder = historyResponse.body.find(o => o.id === activeOrderResponse.body.id);

      expect(completedOrder).toBeTruthy();
      expect(completedOrder.status).toBe('completed');
      
      expect(activeOrder).toBeTruthy();
      expect(activeOrder.status).toBe('pending');
    });
  });
});
