/**
 * End-to-End Workflow Integration Tests
 * Tests complete workflows across the QR-based restaurant ordering system
 * 
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 7.1, 8.1, 9.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app, { httpServer } from './server.js';
import { readTables, writeTables, readMenuItems, writeMenuItems, readOrders, writeOrders } from './persistenceManager.js';

describe('End-to-End Workflow Tests', () => {
  // Clean up data before each test
  beforeEach(async () => {
    await writeTables([]);
    await writeMenuItems([]);
    await writeOrders([]);
  });

  afterEach(() => {
    // Close server connections if needed
  });

  describe('Customer Order Flow: QR scan → menu → order → queue', () => {
    it('should complete full customer ordering workflow', async () => {
      // Step 1: Manager creates a table (simulating QR code generation)
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-001' })
        .expect(201);

      const table = tableResponse.body;
      expect(table).toHaveProperty('id');
      expect(table).toHaveProperty('qrCode');
      expect(table.status).toBe('active');

      // Step 2: Customer scans QR code and validates table
      const validateResponse = await request(app)
        .get(`/api/tables/${table.id}/validate`)
        .expect(200);

      expect(validateResponse.body.valid).toBe(true);
      expect(validateResponse.body.tableId).toBe(table.id);

      // Step 3: Manager creates menu items
      const menuItem1 = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Delicious burger', price: 1200 })
        .expect(201);

      const menuItem2 = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Fries', description: 'Crispy fries', price: 500 })
        .expect(201);

      // Step 4: Customer views menu
      const menuResponse = await request(app)
        .get('/api/menu-items')
        .expect(200);

      expect(menuResponse.body).toHaveLength(2);
      expect(menuResponse.body[0].available).toBe(true);

      // Step 5: Customer creates order with selected items
      const orderItems = [
        { menuItemId: menuItem1.body.id, name: 'Burger', quantity: 1, price: 1200 },
        { menuItemId: menuItem2.body.id, name: 'Fries', quantity: 2, price: 500 }
      ];

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({ tableId: table.id, items: orderItems })
        .expect(201);

      const order = orderResponse.body;
      expect(order).toHaveProperty('id');
      expect(order.tableId).toBe(table.id);
      expect(order.status).toBe('pending');
      expect(order.totalPrice).toBe(2200); // 1200 + (500 * 2)
      expect(order.items).toHaveLength(2);

      // Step 6: Order appears on kitchen queue
      const queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(1);
      expect(queueResponse.body[0].id).toBe(order.id);
      expect(queueResponse.body[0].status).toBe('pending');
    });

    it('should prevent ordering from inactive table', async () => {
      // Create and then delete a table
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-002' })
        .expect(201);

      const table = tableResponse.body;

      await request(app)
        .delete(`/api/tables/${table.id}`)
        .expect(200);

      // Try to validate inactive table
      const validateResponse = await request(app)
        .get(`/api/tables/${table.id}/validate`)
        .expect(200);

      expect(validateResponse.body.valid).toBe(false);
      expect(validateResponse.body.error).toContain('not active');
    });

    it('should prevent selecting unavailable menu items', async () => {
      // Create menu item and mark as unavailable
      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Pizza', description: 'Out of stock', price: 1500 })
        .expect(201);

      const menuItem = menuItemResponse.body;

      await request(app)
        .put(`/api/menu-items/${menuItem.id}`)
        .send({ available: false })
        .expect(200);

      // Verify item is marked unavailable
      const menuResponse = await request(app)
        .get('/api/menu-items')
        .expect(200);

      const item = menuResponse.body.find(i => i.id === menuItem.id);
      expect(item.available).toBe(false);
    });
  });

  describe('Kitchen Workflow: queue → preparing → ready → served → completed', () => {
    it('should complete full kitchen workflow with status transitions', async () => {
      // Setup: Create table, menu items, and order
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-kitchen-001' })
        .expect(201);

      const table = tableResponse.body;

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Steak', description: 'Grilled steak', price: 2500 })
        .expect(201);

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: table.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Steak', quantity: 1, price: 2500 }]
        })
        .expect(201);

      const order = orderResponse.body;

      // Step 1: Order starts as pending and appears on queue
      let queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(1);
      expect(queueResponse.body[0].status).toBe('pending');

      // Step 2: Kitchen staff marks order as preparing
      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

      let orderCheck = await request(app)
        .get(`/api/orders/${order.id}`)
        .expect(200);

      expect(orderCheck.body.status).toBe('preparing');

      // Order still on queue (preparing status)
      queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(1);
      expect(queueResponse.body[0].status).toBe('preparing');

      // Step 3: Kitchen staff marks order as ready
      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'ready' })
        .expect(200);

      orderCheck = await request(app)
        .get(`/api/orders/${order.id}`)
        .expect(200);

      expect(orderCheck.body.status).toBe('ready');

      // Order removed from queue (only pending/preparing shown)
      queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(0);

      // Step 4: Waiter marks order as served
      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'served' })
        .expect(200);

      orderCheck = await request(app)
        .get(`/api/orders/${order.id}`)
        .expect(200);

      expect(orderCheck.body.status).toBe('served');

      // Step 5: Manager marks order as completed
      await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'completed' })
        .expect(200);

      orderCheck = await request(app)
        .get(`/api/orders/${order.id}`)
        .expect(200);

      expect(orderCheck.body.status).toBe('completed');
      expect(orderCheck.body.completedAt).toBeTruthy();
    });

    it('should prevent invalid status transitions', async () => {
      // Create order
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-invalid-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Salad', description: 'Fresh salad', price: 800 })
        .expect(201);

      const orderResponse = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Salad', quantity: 1, price: 800 }]
        })
        .expect(201);

      const order = orderResponse.body;

      // Try invalid transition: pending → served (should go through preparing/ready first)
      const invalidResponse = await request(app)
        .put(`/api/orders/${order.id}/status`)
        .send({ status: 'served' })
        .expect(400);

      expect(invalidResponse.body.error).toBeTruthy();
    });

    it('should sort queue by submission time (oldest first)', async () => {
      // Create table and menu item
      const tableResponse = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-queue-001' })
        .expect(201);

      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Pasta', description: 'Italian pasta', price: 1400 })
        .expect(201);

      // Create multiple orders with delays
      const order1Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 1, price: 1400 }]
        })
        .expect(201);

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const order2Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 1, price: 1400 }]
        })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 10));

      const order3Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: tableResponse.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Pasta', quantity: 1, price: 1400 }]
        })
        .expect(201);

      // Check queue order
      const queueResponse = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(queueResponse.body).toHaveLength(3);
      expect(queueResponse.body[0].id).toBe(order1Response.body.id);
      expect(queueResponse.body[1].id).toBe(order2Response.body.id);
      expect(queueResponse.body[2].id).toBe(order3Response.body.id);

      // Verify timestamps are in ascending order
      expect(queueResponse.body[0].createdAt).toBeLessThan(queueResponse.body[1].createdAt);
      expect(queueResponse.body[1].createdAt).toBeLessThan(queueResponse.body[2].createdAt);
    });
  });

  describe('Manager Workflows: dashboard, table management, menu management', () => {
    it('should complete table management workflow', async () => {
      // Create multiple tables
      const table1 = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-mgr-001' })
        .expect(201);

      const table2 = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-mgr-002' })
        .expect(201);

      // List all tables
      const tablesResponse = await request(app)
        .get('/api/tables')
        .expect(200);

      expect(tablesResponse.body).toHaveLength(2);
      expect(tablesResponse.body.every(t => t.status === 'active')).toBe(true);

      // Get specific table
      const tableResponse = await request(app)
        .get(`/api/tables/${table1.body.id}`)
        .expect(200);

      expect(tableResponse.body.id).toBe(table1.body.id);
      expect(tableResponse.body.qrCode).toBeTruthy();

      // Delete table (soft delete)
      await request(app)
        .delete(`/api/tables/${table1.body.id}`)
        .expect(200);

      // Verify table is inactive
      const deletedTableResponse = await request(app)
        .get(`/api/tables/${table1.body.id}`)
        .expect(200);

      expect(deletedTableResponse.body.status).toBe('inactive');

      // View table order history
      const historyResponse = await request(app)
        .get(`/api/tables/${table2.body.id}/orders`)
        .expect(200);

      expect(Array.isArray(historyResponse.body)).toBe(true);
    });

    it('should complete menu management workflow', async () => {
      // Create menu items
      const item1 = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Coffee', description: 'Hot coffee', price: 300 })
        .expect(201);

      const item2 = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Tea', description: 'Green tea', price: 250 })
        .expect(201);

      // List all menu items
      const menuResponse = await request(app)
        .get('/api/menu-items')
        .expect(200);

      expect(menuResponse.body).toHaveLength(2);

      // Update menu item details
      await request(app)
        .put(`/api/menu-items/${item1.body.id}`)
        .send({ name: 'Espresso', price: 350 })
        .expect(200);

      const updatedItem = await request(app)
        .get(`/api/menu-items/${item1.body.id}`)
        .expect(200);

      expect(updatedItem.body.name).toBe('Espresso');
      expect(updatedItem.body.price).toBe(350);

      // Toggle availability
      await request(app)
        .put(`/api/menu-items/${item2.body.id}`)
        .send({ available: false })
        .expect(200);

      const unavailableItem = await request(app)
        .get(`/api/menu-items/${item2.body.id}`)
        .expect(200);

      expect(unavailableItem.body.available).toBe(false);

      // Delete menu item
      await request(app)
        .delete(`/api/menu-items/${item1.body.id}`)
        .expect(200);

      const menuAfterDelete = await request(app)
        .get('/api/menu-items')
        .expect(200);

      expect(menuAfterDelete.body).toHaveLength(1);
    });

    it('should display accurate dashboard metrics', async () => {
      // Create tables
      await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-dash-001' })
        .expect(201);

      const table2Response = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-dash-002' })
        .expect(201);

      // Create menu item
      const menuItemResponse = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Sandwich', description: 'Club sandwich', price: 900 })
        .expect(201);

      // Create orders with different statuses
      const order1Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: table2Response.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Sandwich', quantity: 1, price: 900 }]
        })
        .expect(201);

      const order2Response = await request(app)
        .post('/api/orders')
        .send({
          tableId: table2Response.body.id,
          items: [{ menuItemId: menuItemResponse.body.id, name: 'Sandwich', quantity: 2, price: 900 }]
        })
        .expect(201);

      // Update order statuses
      await request(app)
        .put(`/api/orders/${order1Response.body.id}/status`)
        .send({ status: 'preparing' })
        .expect(200);

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

      await request(app)
        .put(`/api/orders/${order2Response.body.id}/status`)
        .send({ status: 'completed' })
        .expect(200);

      // Get dashboard metrics
      const metricsResponse = await request(app)
        .get('/api/metrics')
        .expect(200);

      const metrics = metricsResponse.body;

      // Verify active table count
      expect(metrics.activeTableCount).toBe(2);

      // Verify order counts by status
      expect(metrics.orderCountsByStatus.preparing).toBe(1);
      expect(metrics.orderCountsByStatus.completed).toBe(1);

      // Verify total revenue (only completed orders)
      expect(metrics.totalRevenue).toBe(1800); // 900 * 2
    });
  });
});
