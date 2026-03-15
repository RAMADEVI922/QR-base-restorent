/**
 * Unit tests for Order Service
 * Tests order creation, item management, total calculation, and retrieval
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createOrder,
  addItemToOrder,
  removeItemFromOrder,
  calculateOrderTotal,
  getOrderById,
  getOrdersByTable,
  getAllOrders,
  getOrderCount,
  updateOrderStatus,
  getOrderQueue
} from './orderService.js';
import { clearAllData } from './persistenceManager.js';
import { OrderStatus } from '../shared/types.js';

describe('Order Service', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  describe('createOrder', () => {
    it('should create an order with unique ID and table association', async () => {
      const tableId = 'table-1';
      const order = await createOrder(tableId);

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(typeof order.id).toBe('string');
      expect(order.tableId).toBe(tableId);
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.items).toEqual([]);
      expect(order.totalPrice).toBe(0);
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });

    it('should create orders with different unique IDs', async () => {
      const order1 = await createOrder('table-1');
      const order2 = await createOrder('table-1');

      expect(order1.id).not.toBe(order2.id);
    });

    it('should initialize order with pending status', async () => {
      const order = await createOrder('table-1');
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    it('should throw error for invalid tableId', async () => {
      await expect(createOrder(null)).rejects.toThrow('Invalid tableId');
      await expect(createOrder('')).rejects.toThrow('Invalid tableId');
      await expect(createOrder(123)).rejects.toThrow('Invalid tableId');
    });

    it('should create order with initial items and calculate total', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 },
        { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
      ];
      const order = await createOrder('table-1', items);

      expect(order.items).toEqual(items);
      expect(order.totalPrice).toBe(2500); // (2 * 1000) + (1 * 500)
    });

    it('should persist order to storage', async () => {
      const order = await createOrder('table-1');
      const retrieved = await getOrderById(order.id);

      expect(retrieved).toEqual(order);
    });
  });

  describe('addItemToOrder', () => {
    it('should add item to order and update total', async () => {
      const order = await createOrder('table-1');
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 };

      const updated = await addItemToOrder(order.id, item);

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0]).toEqual(item);
      expect(updated.totalPrice).toBe(1000);
    });

    it('should add multiple items to order', async () => {
      const order = await createOrder('table-1');
      const item1 = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 };
      const item2 = { menuItemId: 'item-2', name: 'Fries', quantity: 2, price: 500 };

      await addItemToOrder(order.id, item1);
      const updated = await addItemToOrder(order.id, item2);

      expect(updated.items).toHaveLength(2);
      expect(updated.totalPrice).toBe(2000); // 1000 + (2 * 500)
    });

    it('should update updatedAt timestamp', async () => {
      const order = await createOrder('table-1');
      const originalUpdatedAt = order.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 };
      const updated = await addItemToOrder(order.id, item);

      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should throw error for invalid orderId', async () => {
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 };

      await expect(addItemToOrder(null, item)).rejects.toThrow('Invalid orderId');
      await expect(addItemToOrder('', item)).rejects.toThrow('Invalid orderId');
    });

    it('should throw error for invalid item', async () => {
      const order = await createOrder('table-1');

      await expect(addItemToOrder(order.id, null)).rejects.toThrow('Invalid item');
      await expect(addItemToOrder(order.id, {})).rejects.toThrow('Invalid item');
      await expect(addItemToOrder(order.id, { menuItemId: 'item-1' })).rejects.toThrow('Invalid item');
    });

    it('should throw error for invalid quantity', async () => {
      const order = await createOrder('table-1');
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 0, price: 1000 };

      await expect(addItemToOrder(order.id, item)).rejects.toThrow('Invalid quantity');
    });

    it('should throw error for invalid price', async () => {
      const order = await createOrder('table-1');
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: -100 };

      await expect(addItemToOrder(order.id, item)).rejects.toThrow('Invalid price');
    });

    it('should throw error for non-existent order', async () => {
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 };

      await expect(addItemToOrder('non-existent-id', item)).rejects.toThrow('Order not found');
    });

    it('should persist updated order to storage', async () => {
      const order = await createOrder('table-1');
      const item = { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 };

      await addItemToOrder(order.id, item);
      const retrieved = await getOrderById(order.id);

      expect(retrieved.items).toHaveLength(1);
      expect(retrieved.totalPrice).toBe(1000);
    });
  });

  describe('removeItemFromOrder', () => {
    it('should remove item from order and update total', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 },
        { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
      ];
      const order = await createOrder('table-1', items);

      const updated = await removeItemFromOrder(order.id, 0);

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].menuItemId).toBe('item-2');
      expect(updated.totalPrice).toBe(500);
    });

    it('should remove item with quantity > 1', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 3, price: 1000 }
      ];
      const order = await createOrder('table-1', items);

      const updated = await removeItemFromOrder(order.id, 0);

      expect(updated.items).toHaveLength(0);
      expect(updated.totalPrice).toBe(0);
    });

    it('should update updatedAt timestamp', async () => {
      const items = [{ menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }];
      const order = await createOrder('table-1', items);
      const originalUpdatedAt = order.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await removeItemFromOrder(order.id, 0);

      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should throw error for invalid orderId', async () => {
      await expect(removeItemFromOrder(null, 0)).rejects.toThrow('Invalid orderId');
      await expect(removeItemFromOrder('', 0)).rejects.toThrow('Invalid orderId');
    });

    it('should throw error for invalid itemIndex', async () => {
      const order = await createOrder('table-1');

      await expect(removeItemFromOrder(order.id, -1)).rejects.toThrow('Invalid itemIndex');
      await expect(removeItemFromOrder(order.id, 'invalid')).rejects.toThrow('Invalid itemIndex');
    });

    it('should throw error for non-existent order', async () => {
      await expect(removeItemFromOrder('non-existent-id', 0)).rejects.toThrow('Order not found');
    });

    it('should throw error for out of bounds index', async () => {
      const order = await createOrder('table-1');

      await expect(removeItemFromOrder(order.id, 0)).rejects.toThrow('Invalid itemIndex');
    });

    it('should persist updated order to storage', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 },
        { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
      ];
      const order = await createOrder('table-1', items);

      await removeItemFromOrder(order.id, 0);
      const retrieved = await getOrderById(order.id);

      expect(retrieved.items).toHaveLength(1);
      expect(retrieved.totalPrice).toBe(500);
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total for order with items', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 },
        { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
      ];
      const order = await createOrder('table-1', items);

      const total = await calculateOrderTotal(order.id);

      expect(total).toBe(2500);
    });

    it('should return 0 for empty order', async () => {
      const order = await createOrder('table-1');

      const total = await calculateOrderTotal(order.id);

      expect(total).toBe(0);
    });

    it('should throw error for invalid orderId', async () => {
      await expect(calculateOrderTotal(null)).rejects.toThrow('Invalid orderId');
      await expect(calculateOrderTotal('')).rejects.toThrow('Invalid orderId');
    });

    it('should throw error for non-existent order', async () => {
      await expect(calculateOrderTotal('non-existent-id')).rejects.toThrow('Order not found');
    });
  });

  describe('getOrderById', () => {
    it('should retrieve order by ID', async () => {
      const order = await createOrder('table-1');

      const retrieved = await getOrderById(order.id);

      expect(retrieved).toEqual(order);
    });

    it('should return null for non-existent order', async () => {
      const retrieved = await getOrderById('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should throw error for invalid orderId', async () => {
      await expect(getOrderById(null)).rejects.toThrow('Invalid orderId');
      await expect(getOrderById('')).rejects.toThrow('Invalid orderId');
    });
  });

  describe('getOrdersByTable', () => {
    it('should retrieve all orders for a table', async () => {
      const order1 = await createOrder('table-1');
      const order2 = await createOrder('table-1');
      const order3 = await createOrder('table-2');

      const orders = await getOrdersByTable('table-1');

      expect(orders).toHaveLength(2);
      expect(orders.map(o => o.id)).toContain(order1.id);
      expect(orders.map(o => o.id)).toContain(order2.id);
      expect(orders.map(o => o.id)).not.toContain(order3.id);
    });

    it('should retrieve both active and completed orders for a table', async () => {
      // Create orders with different statuses
      const order1 = await createOrder('table-1');
      const order2 = await createOrder('table-1');
      const order3 = await createOrder('table-1');
      const order4 = await createOrder('table-2');

      // Transition orders to different statuses
      await updateOrderStatus(order1.id, OrderStatus.PREPARING);
      await updateOrderStatus(order2.id, OrderStatus.PREPARING);
      await updateOrderStatus(order2.id, OrderStatus.READY);
      await updateOrderStatus(order2.id, OrderStatus.SERVED);
      await updateOrderStatus(order2.id, OrderStatus.COMPLETED);

      const orders = await getOrdersByTable('table-1');

      // Should include all orders for table-1 regardless of status
      expect(orders).toHaveLength(3);
      expect(orders.map(o => o.id)).toContain(order1.id);
      expect(orders.map(o => o.id)).toContain(order2.id);
      expect(orders.map(o => o.id)).toContain(order3.id);
      expect(orders.map(o => o.id)).not.toContain(order4.id);

      // Verify different statuses are included
      const statuses = orders.map(o => o.status);
      expect(statuses).toContain(OrderStatus.PENDING);
      expect(statuses).toContain(OrderStatus.PREPARING);
      expect(statuses).toContain(OrderStatus.COMPLETED);
    });

    it('should return empty array for table with no orders', async () => {
      const orders = await getOrdersByTable('table-1');

      expect(orders).toEqual([]);
    });

    it('should throw error for invalid tableId', async () => {
      await expect(getOrdersByTable(null)).rejects.toThrow('Invalid tableId');
      await expect(getOrdersByTable('')).rejects.toThrow('Invalid tableId');
    });
  });

  describe('getAllOrders', () => {
    it('should retrieve all orders', async () => {
      const order1 = await createOrder('table-1');
      const order2 = await createOrder('table-2');
      const order3 = await createOrder('table-1');

      const orders = await getAllOrders();

      expect(orders).toHaveLength(3);
      expect(orders.map(o => o.id)).toContain(order1.id);
      expect(orders.map(o => o.id)).toContain(order2.id);
      expect(orders.map(o => o.id)).toContain(order3.id);
    });

    it('should return empty array when no orders exist', async () => {
      const orders = await getAllOrders();

      expect(orders).toEqual([]);
    });
  });

  describe('getOrderCount', () => {
    it('should return correct count of orders', async () => {
      await createOrder('table-1');
      await createOrder('table-2');
      await createOrder('table-1');

      const count = await getOrderCount();

      expect(count).toBe(3);
    });

    it('should return 0 when no orders exist', async () => {
      const count = await getOrderCount();

      expect(count).toBe(0);
    });
  });

  describe('Order Summary Accuracy (Property 8)', () => {
    it('should calculate order total correctly for various item combinations', async () => {
      const testCases = [
        { items: [], expected: 0 },
        { items: [{ menuItemId: 'i1', name: 'Item', quantity: 1, price: 100 }], expected: 100 },
        { items: [{ menuItemId: 'i1', name: 'Item', quantity: 5, price: 200 }], expected: 1000 },
        {
          items: [
            { menuItemId: 'i1', name: 'Item1', quantity: 2, price: 500 },
            { menuItemId: 'i2', name: 'Item2', quantity: 3, price: 300 }
          ],
          expected: 1900
        }
      ];

      for (const testCase of testCases) {
        const order = await createOrder('table-1', testCase.items);
        expect(order.totalPrice).toBe(testCase.expected);
      }
    });
  });

  describe('Order ID Uniqueness (Property 10)', () => {
    it('should generate unique order IDs for multiple orders', async () => {
      const orders = [];
      for (let i = 0; i < 10; i++) {
        orders.push(await createOrder('table-1'));
      }

      const ids = orders.map(o => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('New Orders Start as Pending (Property 11)', () => {
    it('should initialize all new orders with pending status', async () => {
      for (let i = 0; i < 5; i++) {
        const order = await createOrder(`table-${i}`);
        expect(order.status).toBe(OrderStatus.PENDING);
      }
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status from pending to preparing', async () => {
      const order = await createOrder('table-1');
      
      const updated = await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      expect(updated.status).toBe(OrderStatus.PREPARING);
      expect(updated.updatedAt).toBeGreaterThan(order.updatedAt);
    });

    it('should update order status from preparing to ready', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      const updated = await updateOrderStatus(order.id, OrderStatus.READY);
      
      expect(updated.status).toBe(OrderStatus.READY);
    });

    it('should update order status from ready to served', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      await updateOrderStatus(order.id, OrderStatus.READY);
      
      const updated = await updateOrderStatus(order.id, OrderStatus.SERVED);
      
      expect(updated.status).toBe(OrderStatus.SERVED);
    });

    it('should update order status from served to completed', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      await updateOrderStatus(order.id, OrderStatus.READY);
      await updateOrderStatus(order.id, OrderStatus.SERVED);
      
      const updated = await updateOrderStatus(order.id, OrderStatus.COMPLETED);
      
      expect(updated.status).toBe(OrderStatus.COMPLETED);
      expect(updated.completedAt).toBeDefined();
      expect(updated.completedAt).toBeGreaterThan(0);
    });

    it('should set completedAt timestamp when order is completed', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      await updateOrderStatus(order.id, OrderStatus.READY);
      await updateOrderStatus(order.id, OrderStatus.SERVED);
      
      const beforeComplete = Date.now();
      const updated = await updateOrderStatus(order.id, OrderStatus.COMPLETED);
      const afterComplete = Date.now();
      
      expect(updated.completedAt).toBeGreaterThanOrEqual(beforeComplete);
      expect(updated.completedAt).toBeLessThanOrEqual(afterComplete);
    });

    it('should update updatedAt timestamp on status change', async () => {
      const order = await createOrder('table-1');
      const originalUpdatedAt = order.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should persist status update to storage', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      const retrieved = await getOrderById(order.id);
      
      expect(retrieved.status).toBe(OrderStatus.PREPARING);
    });

    it('should throw error for invalid orderId', async () => {
      await expect(updateOrderStatus(null, OrderStatus.PREPARING)).rejects.toThrow('Invalid orderId');
      await expect(updateOrderStatus('', OrderStatus.PREPARING)).rejects.toThrow('Invalid orderId');
    });

    it('should throw error for invalid status', async () => {
      const order = await createOrder('table-1');
      
      await expect(updateOrderStatus(order.id, null)).rejects.toThrow('Invalid status');
      await expect(updateOrderStatus(order.id, '')).rejects.toThrow('Invalid status');
      await expect(updateOrderStatus(order.id, 'invalid-status')).rejects.toThrow('Invalid status');
    });

    it('should throw error for non-existent order', async () => {
      await expect(updateOrderStatus('non-existent-id', OrderStatus.PREPARING)).rejects.toThrow('Order not found');
    });

    it('should throw error for invalid status transition from pending to ready', async () => {
      const order = await createOrder('table-1');
      
      await expect(updateOrderStatus(order.id, OrderStatus.READY)).rejects.toThrow('Invalid status transition');
    });

    it('should throw error for invalid status transition from pending to served', async () => {
      const order = await createOrder('table-1');
      
      await expect(updateOrderStatus(order.id, OrderStatus.SERVED)).rejects.toThrow('Invalid status transition');
    });

    it('should throw error for invalid status transition from pending to completed', async () => {
      const order = await createOrder('table-1');
      
      await expect(updateOrderStatus(order.id, OrderStatus.COMPLETED)).rejects.toThrow('Invalid status transition');
    });

    it('should throw error for invalid status transition from preparing to served', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      await expect(updateOrderStatus(order.id, OrderStatus.SERVED)).rejects.toThrow('Invalid status transition');
    });

    it('should throw error for invalid status transition from ready to completed', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      await updateOrderStatus(order.id, OrderStatus.READY);
      
      await expect(updateOrderStatus(order.id, OrderStatus.COMPLETED)).rejects.toThrow('Invalid status transition');
    });

    it('should throw error for backward status transition', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      await expect(updateOrderStatus(order.id, OrderStatus.PENDING)).rejects.toThrow('Invalid status transition');
    });
  });

  describe('Status Transition to Preparing (Property 14)', () => {
    it('should transition pending orders to preparing', async () => {
      const order = await createOrder('table-1');
      
      const updated = await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      expect(updated.status).toBe(OrderStatus.PREPARING);
      
      // Verify persistence
      const retrieved = await getOrderById(order.id);
      expect(retrieved.status).toBe(OrderStatus.PREPARING);
    });
  });

  describe('Status Transition to Ready (Property 15)', () => {
    it('should transition preparing orders to ready', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      
      const updated = await updateOrderStatus(order.id, OrderStatus.READY);
      
      expect(updated.status).toBe(OrderStatus.READY);
      
      // Verify persistence
      const retrieved = await getOrderById(order.id);
      expect(retrieved.status).toBe(OrderStatus.READY);
    });
  });

  describe('Status Transition to Served (Property 17)', () => {
    it('should transition ready orders to served', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      await updateOrderStatus(order.id, OrderStatus.READY);
      
      const updated = await updateOrderStatus(order.id, OrderStatus.SERVED);
      
      expect(updated.status).toBe(OrderStatus.SERVED);
      
      // Verify persistence
      const retrieved = await getOrderById(order.id);
      expect(retrieved.status).toBe(OrderStatus.SERVED);
    });
  });

  describe('Status Transition to Completed (Property 42)', () => {
    it('should transition served orders to completed', async () => {
      const order = await createOrder('table-1');
      await updateOrderStatus(order.id, OrderStatus.PREPARING);
      await updateOrderStatus(order.id, OrderStatus.READY);
      await updateOrderStatus(order.id, OrderStatus.SERVED);
      
      const updated = await updateOrderStatus(order.id, OrderStatus.COMPLETED);
      
      expect(updated.status).toBe(OrderStatus.COMPLETED);
      
      // Verify persistence
      const retrieved = await getOrderById(order.id);
      expect(retrieved.status).toBe(OrderStatus.COMPLETED);
    });
  });
});

  describe('getOrderQueue', () => {
    beforeEach(async () => {
      await clearAllData();
    });

    afterEach(async () => {
      await clearAllData();
    });

    it('should retrieve orders with pending status', async () => {
      const order1 = await createOrder('table-1');
      const order2 = await createOrder('table-2');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(2);
      expect(queue.map(o => o.id)).toContain(order1.id);
      expect(queue.map(o => o.id)).toContain(order2.id);
    });

    it('should retrieve orders with preparing status', async () => {
      const order1 = await createOrder('table-1');
      await updateOrderStatus(order1.id, OrderStatus.PREPARING);
      const order2 = await createOrder('table-2');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(2);
      expect(queue.map(o => o.id)).toContain(order1.id);
      expect(queue.map(o => o.id)).toContain(order2.id);
    });

    it('should not include orders with ready status', async () => {
      const order1 = await createOrder('table-1');
      await updateOrderStatus(order1.id, OrderStatus.PREPARING);
      await updateOrderStatus(order1.id, OrderStatus.READY);
      const order2 = await createOrder('table-2');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(order2.id);
    });

    it('should not include orders with served status', async () => {
      const order1 = await createOrder('table-1');
      await updateOrderStatus(order1.id, OrderStatus.PREPARING);
      await updateOrderStatus(order1.id, OrderStatus.READY);
      await updateOrderStatus(order1.id, OrderStatus.SERVED);
      const order2 = await createOrder('table-2');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(order2.id);
    });

    it('should not include orders with completed status', async () => {
      const order1 = await createOrder('table-1');
      await updateOrderStatus(order1.id, OrderStatus.PREPARING);
      await updateOrderStatus(order1.id, OrderStatus.READY);
      await updateOrderStatus(order1.id, OrderStatus.SERVED);
      await updateOrderStatus(order1.id, OrderStatus.COMPLETED);
      const order2 = await createOrder('table-2');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(order2.id);
    });

    it('should sort orders by submission time (oldest first)', async () => {
      const order1 = await createOrder('table-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      const order2 = await createOrder('table-2');
      await new Promise(resolve => setTimeout(resolve, 10));
      const order3 = await createOrder('table-3');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(3);
      expect(queue[0].id).toBe(order1.id);
      expect(queue[1].id).toBe(order2.id);
      expect(queue[2].id).toBe(order3.id);
      expect(queue[0].createdAt).toBeLessThan(queue[1].createdAt);
      expect(queue[1].createdAt).toBeLessThan(queue[2].createdAt);
    });

    it('should include table identifier with each order', async () => {
      const order1 = await createOrder('table-1');
      const order2 = await createOrder('table-2');
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(2);
      expect(queue[0].tableId).toBeDefined();
      expect(queue[1].tableId).toBeDefined();
      expect([queue[0].tableId, queue[1].tableId]).toContain('table-1');
      expect([queue[0].tableId, queue[1].tableId]).toContain('table-2');
    });

    it('should return empty array when no active orders exist', async () => {
      const queue = await getOrderQueue();
      
      expect(queue).toEqual([]);
    });

    it('should return empty array when all orders are completed', async () => {
      const order1 = await createOrder('table-1');
      await updateOrderStatus(order1.id, OrderStatus.PREPARING);
      await updateOrderStatus(order1.id, OrderStatus.READY);
      await updateOrderStatus(order1.id, OrderStatus.SERVED);
      await updateOrderStatus(order1.id, OrderStatus.COMPLETED);
      
      const queue = await getOrderQueue();
      
      expect(queue).toEqual([]);
    });

    it('should handle mixed order statuses correctly', async () => {
      const order1 = await createOrder('table-1'); // pending
      await new Promise(resolve => setTimeout(resolve, 10));
      const order2 = await createOrder('table-2'); // will be preparing
      await updateOrderStatus(order2.id, OrderStatus.PREPARING);
      await new Promise(resolve => setTimeout(resolve, 10));
      const order3 = await createOrder('table-3'); // will be ready
      await updateOrderStatus(order3.id, OrderStatus.PREPARING);
      await updateOrderStatus(order3.id, OrderStatus.READY);
      await new Promise(resolve => setTimeout(resolve, 10));
      const order4 = await createOrder('table-4'); // pending
      
      const queue = await getOrderQueue();
      
      expect(queue).toHaveLength(3);
      expect(queue.map(o => o.id)).toContain(order1.id);
      expect(queue.map(o => o.id)).toContain(order2.id);
      expect(queue.map(o => o.id)).toContain(order4.id);
      expect(queue.map(o => o.id)).not.toContain(order3.id);
      
      // Verify sorting (oldest first)
      expect(queue[0].id).toBe(order1.id);
      expect(queue[1].id).toBe(order2.id);
      expect(queue[2].id).toBe(order4.id);
    });
  });
