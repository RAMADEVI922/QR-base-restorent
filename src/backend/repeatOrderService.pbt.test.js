/**
 * Property-Based Tests for Repeat Order Service
 * Validates correctness properties for repeat order functionality
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  createRepeatOrderForTable,
  detectPreviousOrder,
  getOrderChain
} from './repeatOrderService.js';
import { createOrder, updateOrderStatus, getOrderQueue } from './orderService.js';
import { clearAllData } from './persistenceManager.js';
import { OrderStatus } from '../shared/types.js';

// Arbitraries for generating test data
const tableIdArbitrary = fc.stringMatching(/^table-[a-z0-9]{1,10}$/);
const menuItemIdArbitrary = fc.stringMatching(/^item-[a-z0-9]{1,10}$/);
const itemNameArbitrary = fc.stringMatching(/^[A-Z][a-z]{2,15}$/);
const quantityArbitrary = fc.integer({ min: 1, max: 100 });
const priceArbitrary = fc.integer({ min: 0, max: 100000 });

const orderItemArbitrary = fc.record({
  menuItemId: menuItemIdArbitrary,
  name: itemNameArbitrary,
  quantity: quantityArbitrary,
  price: priceArbitrary
});

describe('Repeat Order Service - Property-Based Tests', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  // Set longer timeout for all property-based tests due to async file I/O
  const PBT_TIMEOUT = 30000; // 30 seconds

  describe('Property 20: Repeat Order Links to Same Table', () => {
    it('should link repeat orders to the same table as the original order', async () => {
      // Feature: qr-restaurant-ordering, Property 20: Repeat Order Links to Same Table
      // **Validates: Requirements 6.1, 6.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(orderItemArbitrary, { minLength: 0, maxLength: 10 }),
          async (tableIds, items) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create initial order and mark as served
              const initialOrder = await createOrder(tableId, items);
              await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
              await updateOrderStatus(initialOrder.id, OrderStatus.READY);
              await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
              
              // Create repeat order
              const repeatOrder = await createRepeatOrderForTable(tableId, items);
              
              // Verify repeat order is linked to the same table
              expect(repeatOrder.tableId).toBe(tableId);
              expect(repeatOrder.tableId).toBe(initialOrder.tableId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 21: Repeat Order Associates with Same Customer', () => {
    it('should associate repeat orders with the same customer as the previous order', async () => {
      // Feature: qr-restaurant-ordering, Property 21: Repeat Order Associates with Same Customer
      // **Validates: Requirements 6.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create initial order and mark as served
              const initialOrder = await createOrder(tableId);
              await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
              await updateOrderStatus(initialOrder.id, OrderStatus.READY);
              await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
              
              // Create repeat order
              const repeatOrder = await createRepeatOrderForTable(tableId);
              
              // Verify repeat order is associated with the same customer
              // (same table implies same customer in this system)
              expect(repeatOrder.tableId).toBe(initialOrder.tableId);
              
              // Verify the repeat order references the previous order
              expect(repeatOrder.previousOrderId).toBe(initialOrder.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 22: Repeat Orders Appear on Queue', () => {
    it('should display repeat orders on the order queue as new orders', async () => {
      // Feature: qr-restaurant-ordering, Property 22: Repeat Orders Appear on Queue
      // **Validates: Requirements 6.4**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          fc.array(orderItemArbitrary, { minLength: 0, maxLength: 10 }),
          async (tableIds, items) => {
            await clearAllData();
            
            const repeatOrders = [];
            
            for (const tableId of tableIds) {
              // Create initial order and mark as served
              const initialOrder = await createOrder(tableId, items);
              await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
              await updateOrderStatus(initialOrder.id, OrderStatus.READY);
              await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
              
              // Create repeat order
              const repeatOrder = await createRepeatOrderForTable(tableId, items);
              repeatOrders.push(repeatOrder);
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify all repeat orders appear on the queue
            expect(queue).toHaveLength(repeatOrders.length);
            for (const repeatOrder of repeatOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === repeatOrder.id);
              expect(foundInQueue).toBe(true);
            }
            
            // Verify repeat orders have pending status
            for (const queueOrder of queue) {
              expect(queueOrder.status).toBe(OrderStatus.PENDING);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 23: Order Relationship Maintained', () => {
    it('should maintain reference to original order for historical tracking', async () => {
      // Feature: qr-restaurant-ordering, Property 23: Order Relationship Maintained
      // **Validates: Requirements 6.5**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create initial order and mark as served
              const initialOrder = await createOrder(tableId);
              await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
              await updateOrderStatus(initialOrder.id, OrderStatus.READY);
              await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
              
              // Create repeat order
              const repeatOrder = await createRepeatOrderForTable(tableId);
              
              // Verify the repeat order maintains a reference to the original order
              expect(repeatOrder.previousOrderId).toBe(initialOrder.id);
              expect(repeatOrder.previousOrderId).not.toBeNull();
              
              // Verify the order chain can be retrieved
              const chain = await getOrderChain(repeatOrder.id);
              expect(chain).toHaveLength(2);
              expect(chain[0].id).toBe(initialOrder.id);
              expect(chain[1].id).toBe(repeatOrder.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Multiple Repeat Orders Chain', () => {
    it('should maintain order chain across multiple repeat orders', async () => {
      // Feature: qr-restaurant-ordering, Property 23: Order Relationship Maintained
      // **Validates: Requirements 6.5**
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.integer({ min: 1, max: 5 }),
          async (tableId, repeatCount) => {
            await clearAllData();
            
            // Create initial order and mark as served
            const initialOrder = await createOrder(tableId);
            await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
            await updateOrderStatus(initialOrder.id, OrderStatus.READY);
            await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
            
            const allOrders = [initialOrder];
            
            // Create multiple repeat orders
            for (let i = 0; i < repeatCount; i++) {
              const repeatOrder = await createRepeatOrderForTable(tableId);
              allOrders.push(repeatOrder);
              
              // Mark as served for next iteration
              await updateOrderStatus(repeatOrder.id, OrderStatus.PREPARING);
              await updateOrderStatus(repeatOrder.id, OrderStatus.READY);
              await updateOrderStatus(repeatOrder.id, OrderStatus.SERVED);
            }
            
            // Verify the complete chain
            const chain = await getOrderChain(allOrders[allOrders.length - 1].id);
            expect(chain).toHaveLength(repeatCount + 1);
            
            // Verify chain order is correct
            for (let i = 0; i < chain.length; i++) {
              expect(chain[i].id).toBe(allOrders[i].id);
            }
            
            // Verify each order (except the first) has a previousOrderId
            for (let i = 1; i < chain.length; i++) {
              expect(chain[i].previousOrderId).toBe(chain[i - 1].id);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Repeat Orders Independent Across Tables', () => {
    it('should maintain independent repeat order chains for different tables', async () => {
      // Feature: qr-restaurant-ordering, Property 20: Repeat Order Links to Same Table
      // **Validates: Requirements 6.1, 6.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 2, maxLength: 10 }),
          async (tableIds) => {
            await clearAllData();
            
            // Ensure we have unique table IDs
            const uniqueTableIds = [...new Set(tableIds)];
            if (uniqueTableIds.length < 2) return; // Skip if not enough unique tables
            
            const ordersByTable = new Map();
            
            // Create initial orders for each table and mark as served
            for (const tableId of uniqueTableIds) {
              const initialOrder = await createOrder(tableId);
              await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
              await updateOrderStatus(initialOrder.id, OrderStatus.READY);
              await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
              ordersByTable.set(tableId, [initialOrder]);
            }
            
            // Create repeat orders for each table
            for (const tableId of uniqueTableIds) {
              const repeatOrder = await createRepeatOrderForTable(tableId);
              ordersByTable.get(tableId).push(repeatOrder);
            }
            
            // Verify each table has independent order chains
            for (const [tableId, orders] of ordersByTable) {
              expect(orders).toHaveLength(2);
              
              // Verify both orders belong to the same table
              expect(orders[0].tableId).toBe(tableId);
              expect(orders[1].tableId).toBe(tableId);
              
              // Verify repeat order links to initial order
              expect(orders[1].previousOrderId).toBe(orders[0].id);
              
              // Verify the chain is correct
              const chain = await getOrderChain(orders[1].id);
              expect(chain).toHaveLength(2);
              expect(chain[0].id).toBe(orders[0].id);
              expect(chain[1].id).toBe(orders[1].id);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Repeat Order Without Previous Order', () => {
    it('should create order with null previousOrderId when no previous served order exists', async () => {
      // Feature: qr-restaurant-ordering, Property 20: Repeat Order Links to Same Table
      // **Validates: Requirements 6.1, 6.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create repeat order without any previous served order
              const order = await createRepeatOrderForTable(tableId);
              
              // Verify order is created with null previousOrderId
              expect(order.previousOrderId).toBeNull();
              expect(order.tableId).toBe(tableId);
              expect(order.status).toBe(OrderStatus.PENDING);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Repeat Order Links to Most Recent Served Order', () => {
    it('should link repeat order to the most recent served order when multiple exist', async () => {
      // Feature: qr-restaurant-ordering, Property 21: Repeat Order Associates with Same Customer
      // **Validates: Requirements 6.3**
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.integer({ min: 2, max: 5 }),
          async (tableId, servedOrderCount) => {
            await clearAllData();
            
            const servedOrders = [];
            
            // Create multiple served orders
            for (let i = 0; i < servedOrderCount; i++) {
              const order = await createOrder(tableId);
              await updateOrderStatus(order.id, OrderStatus.PREPARING);
              await updateOrderStatus(order.id, OrderStatus.READY);
              await updateOrderStatus(order.id, OrderStatus.SERVED);
              servedOrders.push(order);
              
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 2));
            }
            
            // Create repeat order
            const repeatOrder = await createRepeatOrderForTable(tableId);
            
            // Verify repeat order links to the most recent served order
            const mostRecentServedOrder = servedOrders[servedOrders.length - 1];
            expect(repeatOrder.previousOrderId).toBe(mostRecentServedOrder.id);
          }
        ),
        { numRuns: 50 }
      );
    }, 10000); // 10 second timeout for this test
  });

  describe('Property: Repeat Order Ignores Non-Served Orders', () => {
    it('should only link to served orders, ignoring pending/preparing/ready/completed orders', async () => {
      // Feature: qr-restaurant-ordering, Property 21: Repeat Order Associates with Same Customer
      // **Validates: Requirements 6.3**
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          async (tableId) => {
            await clearAllData();
            
            // Create orders with various statuses (but not served)
            const pendingOrder = await createOrder(tableId);
            
            const preparingOrder = await createOrder(tableId);
            await updateOrderStatus(preparingOrder.id, OrderStatus.PREPARING);
            
            const readyOrder = await createOrder(tableId);
            await updateOrderStatus(readyOrder.id, OrderStatus.PREPARING);
            await updateOrderStatus(readyOrder.id, OrderStatus.READY);
            
            const completedOrder = await createOrder(tableId);
            await updateOrderStatus(completedOrder.id, OrderStatus.PREPARING);
            await updateOrderStatus(completedOrder.id, OrderStatus.READY);
            await updateOrderStatus(completedOrder.id, OrderStatus.SERVED);
            await updateOrderStatus(completedOrder.id, OrderStatus.COMPLETED);
            
            // Create repeat order
            const repeatOrder = await createRepeatOrderForTable(tableId);
            
            // Verify repeat order has null previousOrderId (no served orders exist)
            expect(repeatOrder.previousOrderId).toBeNull();
            
            // Now create a served order
            const servedOrder = await createOrder(tableId);
            await updateOrderStatus(servedOrder.id, OrderStatus.PREPARING);
            await updateOrderStatus(servedOrder.id, OrderStatus.READY);
            await updateOrderStatus(servedOrder.id, OrderStatus.SERVED);
            
            // Create another repeat order
            const repeatOrder2 = await createRepeatOrderForTable(tableId);
            
            // Verify it links to the served order, not the completed one
            expect(repeatOrder2.previousOrderId).toBe(servedOrder.id);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Repeat Order Preserves Item Data', () => {
    it('should create repeat orders with correct items and total price', async () => {
      // Feature: qr-restaurant-ordering, Property 22: Repeat Orders Appear on Queue
      // **Validates: Requirements 6.4**
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 10 }),
          async (tableId, items) => {
            await clearAllData();
            
            // Create initial order and mark as served
            const initialOrder = await createOrder(tableId);
            await updateOrderStatus(initialOrder.id, OrderStatus.PREPARING);
            await updateOrderStatus(initialOrder.id, OrderStatus.READY);
            await updateOrderStatus(initialOrder.id, OrderStatus.SERVED);
            
            // Create repeat order with items
            const repeatOrder = await createRepeatOrderForTable(tableId, items);
            
            // Verify items are preserved
            expect(repeatOrder.items).toEqual(items);
            
            // Verify total price is calculated correctly
            const expectedTotal = items.reduce((sum, item) => {
              return sum + (item.price * item.quantity);
            }, 0);
            expect(repeatOrder.totalPrice).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
