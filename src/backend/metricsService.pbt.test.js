/**
 * Property-Based Tests for Metrics Service
 * Validates correctness properties for dashboard metrics calculations
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  calculateActiveTableCount,
  calculateOrderCountsByStatus,
  calculateTotalRevenue
} from './metricsService.js';
import { writeTables, writeOrders, clearAllData } from './persistenceManager.js';
import { TableStatus, OrderStatus } from '../shared/types.js';

// Arbitraries for generating test data
const tableIdArbitrary = fc.stringMatching(/^table-[a-z0-9]{1,10}$/);
const qrCodeArbitrary = fc.stringMatching(/^qr-[a-z0-9]{5,15}$/);
const tableStatusArbitrary = fc.constantFrom(TableStatus.ACTIVE, TableStatus.INACTIVE);
const orderStatusArbitrary = fc.constantFrom(
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.COMPLETED
);
const priceArbitrary = fc.integer({ min: 0, max: 100000 });

const tableArbitrary = fc.record({
  id: tableIdArbitrary,
  qrCode: qrCodeArbitrary,
  status: tableStatusArbitrary,
  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  updatedAt: fc.integer({ min: 1000000000000, max: Date.now() })
});

const orderArbitrary = fc.record({
  id: fc.stringMatching(/^order-[a-z0-9]{1,10}$/),
  tableId: tableIdArbitrary,
  items: fc.array(fc.record({
    menuItemId: fc.stringMatching(/^item-[a-z0-9]{1,10}$/),
    name: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
    quantity: fc.integer({ min: 1, max: 10 }),
    price: priceArbitrary
  }), { minLength: 0, maxLength: 10 }),
  status: orderStatusArbitrary,
  totalPrice: priceArbitrary,
  createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
  completedAt: fc.option(fc.integer({ min: 1000000000000, max: Date.now() }), { nil: null }),
  previousOrderId: fc.option(fc.stringMatching(/^order-[a-z0-9]{1,10}$/), { nil: null })
});

describe('Metrics Service - Property-Based Tests', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  describe('Property 24: Dashboard Active Table Count', () => {
    it('should count only active tables across all inputs', async () => {
      // Feature: qr-restaurant-ordering, Property 24: Dashboard Active Table Count
      // **Validates: Requirements 7.1**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableArbitrary, { minLength: 0, maxLength: 50 }),
          async (tables) => {
            await clearAllData();
            await writeTables(tables);
            
            // Calculate expected active table count
            const expectedCount = tables.filter(table => table.status === TableStatus.ACTIVE).length;
            
            // Get actual count from service
            const actualCount = await calculateActiveTableCount();
            
            // Verify count matches expected
            expect(actualCount).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when all tables are inactive', async () => {
      // Feature: qr-restaurant-ordering, Property 24: Dashboard Active Table Count
      // **Validates: Requirements 7.1**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableArbitrary, { minLength: 1, maxLength: 30 }),
          async (tables) => {
            await clearAllData();
            
            // Mark all tables as inactive
            const inactiveTables = tables.map(table => ({
              ...table,
              status: TableStatus.INACTIVE
            }));
            await writeTables(inactiveTables);
            
            // Get count from service
            const count = await calculateActiveTableCount();
            
            // Verify count is 0
            expect(count).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return correct count when all tables are active', async () => {
      // Feature: qr-restaurant-ordering, Property 24: Dashboard Active Table Count
      // **Validates: Requirements 7.1**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableArbitrary, { minLength: 1, maxLength: 30 }),
          async (tables) => {
            await clearAllData();
            
            // Mark all tables as active
            const activeTables = tables.map(table => ({
              ...table,
              status: TableStatus.ACTIVE
            }));
            await writeTables(activeTables);
            
            // Get count from service
            const count = await calculateActiveTableCount();
            
            // Verify count equals total number of tables
            expect(count).toBe(activeTables.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 25: Dashboard Order Status Counts', () => {
    it('should count orders by status correctly for all inputs', async () => {
      // Feature: qr-restaurant-ordering, Property 25: Dashboard Order Status Counts
      // **Validates: Requirements 7.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(orderArbitrary, { minLength: 0, maxLength: 100 }),
          async (orders) => {
            await clearAllData();
            await writeOrders(orders);
            
            // Calculate expected counts
            const expectedCounts = {
              [OrderStatus.PENDING]: 0,
              [OrderStatus.PREPARING]: 0,
              [OrderStatus.READY]: 0,
              [OrderStatus.SERVED]: 0,
              [OrderStatus.COMPLETED]: 0
            };
            
            orders.forEach(order => {
              if (expectedCounts.hasOwnProperty(order.status)) {
                expectedCounts[order.status]++;
              }
            });
            
            // Get actual counts from service
            const actualCounts = await calculateOrderCountsByStatus();
            
            // Verify counts match expected
            expect(actualCounts).toEqual(expectedCounts);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero counts when no orders exist', async () => {
      // Feature: qr-restaurant-ordering, Property 25: Dashboard Order Status Counts
      // **Validates: Requirements 7.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            await clearAllData();
            await writeOrders([]);
            
            // Get counts from service
            const counts = await calculateOrderCountsByStatus();
            
            // Verify all counts are 0
            expect(counts).toEqual({
              pending: 0,
              preparing: 0,
              ready: 0,
              served: 0,
              completed: 0
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle orders with single status correctly', async () => {
      // Feature: qr-restaurant-ordering, Property 25: Dashboard Order Status Counts
      // **Validates: Requirements 7.2**
      
      await fc.assert(
        fc.asyncProperty(
          orderStatusArbitrary,
          fc.integer({ min: 1, max: 50 }),
          async (status, count) => {
            await clearAllData();
            
            // Create orders all with the same status
            const orders = Array.from({ length: count }, (_, i) => ({
              id: `order-${i}`,
              tableId: `table-${i}`,
              items: [],
              status: status,
              totalPrice: 1000,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              completedAt: status === OrderStatus.COMPLETED ? Date.now() : null,
              previousOrderId: null
            }));
            
            await writeOrders(orders);
            
            // Get counts from service
            const counts = await calculateOrderCountsByStatus();
            
            // Verify the specific status has correct count
            expect(counts[status]).toBe(count);
            
            // Verify other statuses have 0 count
            Object.keys(counts).forEach(key => {
              if (key !== status) {
                expect(counts[key]).toBe(0);
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain count accuracy with mixed statuses', async () => {
      // Feature: qr-restaurant-ordering, Property 25: Dashboard Order Status Counts
      // **Validates: Requirements 7.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(orderArbitrary, { minLength: 10, maxLength: 50 }),
          async (orders) => {
            await clearAllData();
            await writeOrders(orders);
            
            // Get counts from service
            const counts = await calculateOrderCountsByStatus();
            
            // Verify total count equals number of orders
            const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
            expect(totalCount).toBe(orders.length);
            
            // Verify each count is non-negative
            Object.values(counts).forEach(count => {
              expect(count).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 26: Dashboard Revenue Calculation', () => {
    it('should calculate total revenue from completed orders only', async () => {
      // Feature: qr-restaurant-ordering, Property 26: Dashboard Revenue Calculation
      // **Validates: Requirements 7.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(orderArbitrary, { minLength: 0, maxLength: 100 }),
          async (orders) => {
            await clearAllData();
            await writeOrders(orders);
            
            // Calculate expected revenue (only completed orders)
            const expectedRevenue = orders
              .filter(order => order.status === OrderStatus.COMPLETED)
              .reduce((total, order) => total + order.totalPrice, 0);
            
            // Get actual revenue from service
            const actualRevenue = await calculateTotalRevenue();
            
            // Verify revenue matches expected
            expect(actualRevenue).toBe(expectedRevenue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when no completed orders exist', async () => {
      // Feature: qr-restaurant-ordering, Property 26: Dashboard Revenue Calculation
      // **Validates: Requirements 7.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(orderArbitrary, { minLength: 1, maxLength: 30 }),
          async (orders) => {
            await clearAllData();
            
            // Ensure no orders are completed
            const nonCompletedOrders = orders.map(order => ({
              ...order,
              status: fc.sample(fc.constantFrom(
                OrderStatus.PENDING,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.SERVED
              ), 1)[0],
              completedAt: null
            }));
            
            await writeOrders(nonCompletedOrders);
            
            // Get revenue from service
            const revenue = await calculateTotalRevenue();
            
            // Verify revenue is 0
            expect(revenue).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should exclude non-completed orders from revenue', async () => {
      // Feature: qr-restaurant-ordering, Property 26: Dashboard Revenue Calculation
      // **Validates: Requirements 7.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(orderArbitrary, { minLength: 5, maxLength: 50 }),
          async (orders) => {
            await clearAllData();
            
            // Split orders into completed and non-completed
            const completedOrders = [];
            const nonCompletedOrders = [];
            
            orders.forEach((order, index) => {
              if (index % 2 === 0) {
                completedOrders.push({
                  ...order,
                  status: OrderStatus.COMPLETED,
                  completedAt: Date.now()
                });
              } else {
                nonCompletedOrders.push({
                  ...order,
                  status: fc.sample(fc.constantFrom(
                    OrderStatus.PENDING,
                    OrderStatus.PREPARING,
                    OrderStatus.READY,
                    OrderStatus.SERVED
                  ), 1)[0],
                  completedAt: null
                });
              }
            });
            
            await writeOrders([...completedOrders, ...nonCompletedOrders]);
            
            // Calculate expected revenue (only completed orders)
            const expectedRevenue = completedOrders.reduce((total, order) => total + order.totalPrice, 0);
            
            // Get actual revenue from service
            const actualRevenue = await calculateTotalRevenue();
            
            // Verify revenue matches expected (excludes non-completed orders)
            expect(actualRevenue).toBe(expectedRevenue);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle zero-price completed orders correctly', async () => {
      // Feature: qr-restaurant-ordering, Property 26: Dashboard Revenue Calculation
      // **Validates: Requirements 7.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 20 }),
          async (zeroCount, nonZeroCount) => {
            await clearAllData();
            
            // Create completed orders with zero price
            const zeroOrders = Array.from({ length: zeroCount }, (_, i) => ({
              id: `order-zero-${i}`,
              tableId: `table-${i}`,
              items: [],
              status: OrderStatus.COMPLETED,
              totalPrice: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              completedAt: Date.now(),
              previousOrderId: null
            }));
            
            // Create completed orders with non-zero price
            const nonZeroOrders = Array.from({ length: nonZeroCount }, (_, i) => ({
              id: `order-nonzero-${i}`,
              tableId: `table-${i + zeroCount}`,
              items: [],
              status: OrderStatus.COMPLETED,
              totalPrice: 1000 * (i + 1),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              completedAt: Date.now(),
              previousOrderId: null
            }));
            
            await writeOrders([...zeroOrders, ...nonZeroOrders]);
            
            // Calculate expected revenue
            const expectedRevenue = nonZeroOrders.reduce((total, order) => total + order.totalPrice, 0);
            
            // Get actual revenue from service
            const actualRevenue = await calculateTotalRevenue();
            
            // Verify revenue matches expected
            expect(actualRevenue).toBe(expectedRevenue);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle large revenue values correctly', async () => {
      // Feature: qr-restaurant-ordering, Property 26: Dashboard Revenue Calculation
      // **Validates: Requirements 7.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.stringMatching(/^order-[a-z0-9]{1,10}$/),
              tableId: tableIdArbitrary,
              items: fc.array(fc.record({
                menuItemId: fc.stringMatching(/^item-[a-z0-9]{1,10}$/),
                name: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
                quantity: fc.integer({ min: 1, max: 10 }),
                price: fc.integer({ min: 50000, max: 100000 })
              }), { minLength: 1, maxLength: 5 }),
              status: fc.constant(OrderStatus.COMPLETED),
              totalPrice: fc.integer({ min: 50000, max: 500000 }),
              createdAt: fc.integer({ min: 1000000000000, max: Date.now() }),
              updatedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
              completedAt: fc.integer({ min: 1000000000000, max: Date.now() }),
              previousOrderId: fc.option(fc.stringMatching(/^order-[a-z0-9]{1,10}$/), { nil: null })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (orders) => {
            await clearAllData();
            await writeOrders(orders);
            
            // Calculate expected revenue
            const expectedRevenue = orders.reduce((total, order) => total + order.totalPrice, 0);
            
            // Get actual revenue from service
            const actualRevenue = await calculateTotalRevenue();
            
            // Verify revenue matches expected
            expect(actualRevenue).toBe(expectedRevenue);
            
            // Verify revenue is non-negative
            expect(actualRevenue).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Metrics Consistency', () => {
    it('should maintain consistency across all metrics calculations', async () => {
      // Feature: qr-restaurant-ordering, Property: Metrics Consistency
      // **Validates: Requirements 7.1, 7.2, 7.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableArbitrary, { minLength: 0, maxLength: 30 }),
          fc.array(orderArbitrary, { minLength: 0, maxLength: 50 }),
          async (tables, orders) => {
            await clearAllData();
            await writeTables(tables);
            await writeOrders(orders);
            
            // Get all metrics
            const activeTableCount = await calculateActiveTableCount();
            const orderCounts = await calculateOrderCountsByStatus();
            const totalRevenue = await calculateTotalRevenue();
            
            // Verify active table count is non-negative
            expect(activeTableCount).toBeGreaterThanOrEqual(0);
            expect(activeTableCount).toBeLessThanOrEqual(tables.length);
            
            // Verify order counts sum to total orders
            const totalOrderCount = Object.values(orderCounts).reduce((sum, count) => sum + count, 0);
            expect(totalOrderCount).toBe(orders.length);
            
            // Verify revenue is non-negative
            expect(totalRevenue).toBeGreaterThanOrEqual(0);
            
            // Verify revenue only comes from completed orders
            const completedOrderCount = orderCounts[OrderStatus.COMPLETED];
            if (completedOrderCount === 0) {
              expect(totalRevenue).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
