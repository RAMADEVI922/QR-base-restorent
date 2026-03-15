/**
 * Unit tests for Repeat Order Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  detectPreviousOrder, 
  createRepeatOrder, 
  createRepeatOrderForTable,
  getOrderChain 
} from './repeatOrderService.js';
import { OrderStatus } from '../shared/types.js';
import { readOrders, writeOrders } from './persistenceManager.js';

describe('Repeat Order Service', () => {
  beforeEach(async () => {
    // Clear orders before each test
    await writeOrders([]);
  });

  describe('detectPreviousOrder', () => {
    it('should return null when no previous orders exist for table', async () => {
      const result = await detectPreviousOrder('table-1');
      expect(result).toBeNull();
    });

    it('should return null when only pending orders exist for table', async () => {
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.PENDING,
          totalPrice: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          previousOrderId: null
        }
      ]);

      const result = await detectPreviousOrder('table-1');
      expect(result).toBeNull();
    });

    it('should return the most recent served order for table', async () => {
      const now = Date.now();
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 1000,
          createdAt: now - 2000,
          updatedAt: now - 1000,
          completedAt: null,
          previousOrderId: null
        },
        {
          id: 'order-2',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 2000,
          createdAt: now - 1000,
          updatedAt: now,
          completedAt: null,
          previousOrderId: null
        }
      ]);

      const result = await detectPreviousOrder('table-1');
      expect(result).not.toBeNull();
      expect(result.id).toBe('order-2');
    });

    it('should only return served orders, not completed orders', async () => {
      const now = Date.now();
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.COMPLETED,
          totalPrice: 1000,
          createdAt: now - 1000,
          updatedAt: now,
          completedAt: now,
          previousOrderId: null
        }
      ]);

      const result = await detectPreviousOrder('table-1');
      expect(result).toBeNull();
    });

    it('should throw error for invalid tableId', async () => {
      await expect(detectPreviousOrder('')).rejects.toThrow('Invalid tableId');
      await expect(detectPreviousOrder(null)).rejects.toThrow('Invalid tableId');
      await expect(detectPreviousOrder(123)).rejects.toThrow('Invalid tableId');
    });
  });

  describe('createRepeatOrder', () => {
    it('should create a repeat order with previousOrderId', async () => {
      const order = await createRepeatOrder('table-1', [], 'order-0');
      
      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.tableId).toBe('table-1');
      expect(order.previousOrderId).toBe('order-0');
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.items).toEqual([]);
      expect(order.totalPrice).toBe(0);
    });

    it('should create a repeat order with items and calculate total', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 },
        { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
      ];

      const order = await createRepeatOrder('table-1', items, 'order-0');
      
      expect(order.items).toEqual(items);
      expect(order.totalPrice).toBe(2500);
    });

    it('should create a repeat order with null previousOrderId', async () => {
      const order = await createRepeatOrder('table-1', [], null);
      
      expect(order.previousOrderId).toBeNull();
    });

    it('should persist the repeat order to storage', async () => {
      const order = await createRepeatOrder('table-1', [], 'order-0');
      
      const orders = await readOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe(order.id);
      expect(orders[0].previousOrderId).toBe('order-0');
    });

    it('should throw error for invalid tableId', async () => {
      await expect(createRepeatOrder('', [])).rejects.toThrow('Invalid tableId');
      await expect(createRepeatOrder(null, [])).rejects.toThrow('Invalid tableId');
    });

    it('should throw error for invalid previousOrderId', async () => {
      await expect(createRepeatOrder('table-1', [], 123)).rejects.toThrow('Invalid previousOrderId');
    });
  });

  describe('createRepeatOrderForTable', () => {
    it('should create order with null previousOrderId when no previous orders exist', async () => {
      const order = await createRepeatOrderForTable('table-1', []);
      
      expect(order.previousOrderId).toBeNull();
      expect(order.tableId).toBe('table-1');
    });

    it('should create order linked to previous served order', async () => {
      // Create a served order first
      const now = Date.now();
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 1000,
          createdAt: now - 1000,
          updatedAt: now,
          completedAt: null,
          previousOrderId: null
        }
      ]);

      const repeatOrder = await createRepeatOrderForTable('table-1', []);
      
      expect(repeatOrder.previousOrderId).toBe('order-1');
      expect(repeatOrder.tableId).toBe('table-1');
    });

    it('should link to most recent served order when multiple exist', async () => {
      const now = Date.now();
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 1000,
          createdAt: now - 2000,
          updatedAt: now - 1000,
          completedAt: null,
          previousOrderId: null
        },
        {
          id: 'order-2',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 2000,
          createdAt: now - 1000,
          updatedAt: now,
          completedAt: null,
          previousOrderId: null
        }
      ]);

      const repeatOrder = await createRepeatOrderForTable('table-1', []);
      
      expect(repeatOrder.previousOrderId).toBe('order-2');
    });

    it('should create order with items', async () => {
      const items = [
        { menuItemId: 'item-1', name: 'Pizza', quantity: 1, price: 1500 }
      ];

      const order = await createRepeatOrderForTable('table-1', items);
      
      expect(order.items).toEqual(items);
      expect(order.totalPrice).toBe(1500);
    });
  });

  describe('getOrderChain', () => {
    it('should return single order when no chain exists', async () => {
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.PENDING,
          totalPrice: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          previousOrderId: null
        }
      ]);

      const chain = await getOrderChain('order-1');
      
      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe('order-1');
    });

    it('should return complete chain of orders', async () => {
      const now = Date.now();
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 1000,
          createdAt: now - 3000,
          updatedAt: now - 2000,
          completedAt: null,
          previousOrderId: null
        },
        {
          id: 'order-2',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 2000,
          createdAt: now - 2000,
          updatedAt: now - 1000,
          completedAt: null,
          previousOrderId: 'order-1'
        },
        {
          id: 'order-3',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.PENDING,
          totalPrice: 3000,
          createdAt: now - 1000,
          updatedAt: now,
          completedAt: null,
          previousOrderId: 'order-2'
        }
      ]);

      const chain = await getOrderChain('order-3');
      
      expect(chain).toHaveLength(3);
      expect(chain[0].id).toBe('order-1');
      expect(chain[1].id).toBe('order-2');
      expect(chain[2].id).toBe('order-3');
    });

    it('should return chain starting from middle order', async () => {
      const now = Date.now();
      await writeOrders([
        {
          id: 'order-1',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 1000,
          createdAt: now - 3000,
          updatedAt: now - 2000,
          completedAt: null,
          previousOrderId: null
        },
        {
          id: 'order-2',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.SERVED,
          totalPrice: 2000,
          createdAt: now - 2000,
          updatedAt: now - 1000,
          completedAt: null,
          previousOrderId: 'order-1'
        },
        {
          id: 'order-3',
          tableId: 'table-1',
          items: [],
          status: OrderStatus.PENDING,
          totalPrice: 3000,
          createdAt: now - 1000,
          updatedAt: now,
          completedAt: null,
          previousOrderId: 'order-2'
        }
      ]);

      const chain = await getOrderChain('order-2');
      
      expect(chain).toHaveLength(3);
      expect(chain[0].id).toBe('order-1');
      expect(chain[1].id).toBe('order-2');
      expect(chain[2].id).toBe('order-3');
    });

    it('should throw error for invalid orderId', async () => {
      await expect(getOrderChain('')).rejects.toThrow('Invalid orderId');
      await expect(getOrderChain(null)).rejects.toThrow('Invalid orderId');
    });

    it('should throw error for non-existent order', async () => {
      await expect(getOrderChain('non-existent')).rejects.toThrow('Order not found');
    });
  });
});
