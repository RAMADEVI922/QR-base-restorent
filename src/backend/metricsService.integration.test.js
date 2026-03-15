/**
 * Integration tests for Metrics Service
 * Tests the metrics service with realistic data scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateActiveTableCount, 
  calculateOrderCountsByStatus, 
  calculateTotalRevenue 
} from './metricsService.js';
import { createTable } from './tableService.js';
import { createOrder, updateOrderStatus } from './orderService.js';
import { writeTables, writeOrders } from './persistenceManager.js';
import { OrderStatus } from '../shared/types.js';

describe('Metrics Service Integration', () => {
  beforeEach(async () => {
    // Clear data before each test
    await writeTables([]);
    await writeOrders([]);
  });

  it('should calculate all metrics for a realistic restaurant scenario', async () => {
    // Create 5 active tables
    const table1 = await createTable('qr-code-1');
    const table2 = await createTable('qr-code-2');
    const table3 = await createTable('qr-code-3');
    const table4 = await createTable('qr-code-4');
    const table5 = await createTable('qr-code-5');

    // Create orders with different statuses
    const order1 = await createOrder(table1.id, [
      { menuItemId: 'item1', name: 'Burger', quantity: 2, price: 1200 }
    ]);
    
    const order2 = await createOrder(table2.id, [
      { menuItemId: 'item2', name: 'Pizza', quantity: 1, price: 1800 }
    ]);
    await updateOrderStatus(order2.id, OrderStatus.PREPARING);
    
    const order3 = await createOrder(table3.id, [
      { menuItemId: 'item3', name: 'Salad', quantity: 1, price: 900 }
    ]);
    await updateOrderStatus(order3.id, OrderStatus.PREPARING);
    await updateOrderStatus(order3.id, OrderStatus.READY);
    
    const order4 = await createOrder(table4.id, [
      { menuItemId: 'item4', name: 'Pasta', quantity: 1, price: 1500 }
    ]);
    await updateOrderStatus(order4.id, OrderStatus.PREPARING);
    await updateOrderStatus(order4.id, OrderStatus.READY);
    await updateOrderStatus(order4.id, OrderStatus.SERVED);
    
    const order5 = await createOrder(table5.id, [
      { menuItemId: 'item5', name: 'Steak', quantity: 1, price: 3000 }
    ]);
    await updateOrderStatus(order5.id, OrderStatus.PREPARING);
    await updateOrderStatus(order5.id, OrderStatus.READY);
    await updateOrderStatus(order5.id, OrderStatus.SERVED);
    await updateOrderStatus(order5.id, OrderStatus.COMPLETED);

    // Calculate metrics
    const activeTableCount = await calculateActiveTableCount();
    const orderCounts = await calculateOrderCountsByStatus();
    const totalRevenue = await calculateTotalRevenue();

    // Verify metrics
    expect(activeTableCount).toBe(5);
    expect(orderCounts).toEqual({
      pending: 1,
      preparing: 1,
      ready: 1,
      served: 1,
      completed: 1
    });
    expect(totalRevenue).toBe(3000); // Only completed order
  });

  it('should handle empty restaurant scenario', async () => {
    const activeTableCount = await calculateActiveTableCount();
    const orderCounts = await calculateOrderCountsByStatus();
    const totalRevenue = await calculateTotalRevenue();

    expect(activeTableCount).toBe(0);
    expect(orderCounts).toEqual({
      pending: 0,
      preparing: 0,
      ready: 0,
      served: 0,
      completed: 0
    });
    expect(totalRevenue).toBe(0);
  });

  it('should calculate revenue from multiple completed orders', async () => {
    const table1 = await createTable('qr-code-1');
    const table2 = await createTable('qr-code-2');
    const table3 = await createTable('qr-code-3');

    // Create and complete multiple orders
    const order1 = await createOrder(table1.id, [
      { menuItemId: 'item1', name: 'Burger', quantity: 2, price: 1200 }
    ]);
    await updateOrderStatus(order1.id, OrderStatus.PREPARING);
    await updateOrderStatus(order1.id, OrderStatus.READY);
    await updateOrderStatus(order1.id, OrderStatus.SERVED);
    await updateOrderStatus(order1.id, OrderStatus.COMPLETED);

    const order2 = await createOrder(table2.id, [
      { menuItemId: 'item2', name: 'Pizza', quantity: 1, price: 1800 }
    ]);
    await updateOrderStatus(order2.id, OrderStatus.PREPARING);
    await updateOrderStatus(order2.id, OrderStatus.READY);
    await updateOrderStatus(order2.id, OrderStatus.SERVED);
    await updateOrderStatus(order2.id, OrderStatus.COMPLETED);

    const order3 = await createOrder(table3.id, [
      { menuItemId: 'item3', name: 'Salad', quantity: 1, price: 900 }
    ]);
    await updateOrderStatus(order3.id, OrderStatus.PREPARING);
    await updateOrderStatus(order3.id, OrderStatus.READY);
    await updateOrderStatus(order3.id, OrderStatus.SERVED);
    await updateOrderStatus(order3.id, OrderStatus.COMPLETED);

    const totalRevenue = await calculateTotalRevenue();
    expect(totalRevenue).toBe(5100); // (2 * 1200) + 1800 + 900 = 2400 + 1800 + 900
  });
});
