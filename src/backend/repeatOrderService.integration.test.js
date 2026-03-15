/**
 * Integration tests for Repeat Order Service
 * Tests the interaction between repeat order service and order queue
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRepeatOrderForTable } from './repeatOrderService.js';
import { getOrderQueue, updateOrderStatus } from './orderService.js';
import { OrderStatus } from '../shared/types.js';
import { writeOrders } from './persistenceManager.js';

describe('Repeat Order Service Integration', () => {
  beforeEach(async () => {
    // Clear orders before each test
    await writeOrders([]);
  });

  it('should create repeat order that appears on order queue', async () => {
    // Create initial order and mark as served
    const now = Date.now();
    await writeOrders([
      {
        id: 'order-1',
        tableId: 'table-1',
        items: [{ menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }],
        status: OrderStatus.SERVED,
        totalPrice: 1000,
        createdAt: now - 1000,
        updatedAt: now,
        completedAt: null,
        previousOrderId: null
      }
    ]);

    // Create repeat order
    const items = [
      { menuItemId: 'item-2', name: 'Pizza', quantity: 1, price: 1500 }
    ];
    const repeatOrder = await createRepeatOrderForTable('table-1', items);

    // Verify repeat order appears on queue
    const queue = await getOrderQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(repeatOrder.id);
    expect(queue[0].previousOrderId).toBe('order-1');
    expect(queue[0].tableId).toBe('table-1');
  });

  it('should maintain order chain across multiple repeat orders', async () => {
    // Create initial order and mark as served
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
      }
    ]);

    // Create first repeat order
    const repeatOrder1 = await createRepeatOrderForTable('table-1', []);
    expect(repeatOrder1.previousOrderId).toBe('order-1');

    // Mark first repeat order as served
    await updateOrderStatus(repeatOrder1.id, OrderStatus.PREPARING);
    await updateOrderStatus(repeatOrder1.id, OrderStatus.READY);
    await updateOrderStatus(repeatOrder1.id, OrderStatus.SERVED);

    // Create second repeat order
    const repeatOrder2 = await createRepeatOrderForTable('table-1', []);
    
    // Second repeat order should link to first repeat order
    expect(repeatOrder2.previousOrderId).toBe(repeatOrder1.id);
    expect(repeatOrder2.tableId).toBe('table-1');
  });

  it('should handle multiple tables with repeat orders independently', async () => {
    // Create served orders for two different tables
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
      },
      {
        id: 'order-2',
        tableId: 'table-2',
        items: [],
        status: OrderStatus.SERVED,
        totalPrice: 2000,
        createdAt: now - 1000,
        updatedAt: now,
        completedAt: null,
        previousOrderId: null
      }
    ]);

    // Create repeat orders for both tables
    const repeatOrder1 = await createRepeatOrderForTable('table-1', []);
    const repeatOrder2 = await createRepeatOrderForTable('table-2', []);

    // Verify each repeat order links to correct original order
    expect(repeatOrder1.previousOrderId).toBe('order-1');
    expect(repeatOrder1.tableId).toBe('table-1');
    expect(repeatOrder2.previousOrderId).toBe('order-2');
    expect(repeatOrder2.tableId).toBe('table-2');

    // Verify both appear on queue
    const queue = await getOrderQueue();
    expect(queue).toHaveLength(2);
  });
});
