/**
 * Property-Based Tests for Order Service
 * Validates correctness properties across all inputs using fast-check
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  createOrder,
  addItemToOrder,
  removeItemFromOrder,
  getOrderById,
  getOrdersByTable,
  getAllOrders,
  updateOrderStatus,
  getOrderQueue
} from './orderService.js';
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

describe('Order Service - Property-Based Tests', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  describe('Property 8: Order Summary Accuracy', () => {
    it('should calculate order total correctly as sum of item prices', async () => {
      // Feature: qr-restaurant-ordering, Property 8: Order Summary Accuracy
      // Validates: Requirements 3.1
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(orderItemArbitrary, { minLength: 0, maxLength: 20 }),
          async (tableId, items) => {
            await clearAllData();
            const order = await createOrder(tableId, items);
            
            // Calculate expected total
            const expectedTotal = items.reduce((sum, item) => {
              return sum + (item.price * item.quantity);
            }, 0);
            
            // Verify order total matches expected
            expect(order.totalPrice).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Order Creation Links to Table', () => {
    it('should create order with correct table association', async () => {
      // Feature: qr-restaurant-ordering, Property 9: Order Creation Links to Table
      // Validates: Requirements 3.2
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          async (tableId) => {
            await clearAllData();
            const order = await createOrder(tableId);
            
            // Verify order is associated with correct table
            expect(order.tableId).toBe(tableId);
            
            // Verify order can be retrieved by table
            const ordersByTable = await getOrdersByTable(tableId);
            expect(ordersByTable).toContainEqual(order);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Order ID Uniqueness', () => {
    it('should generate unique order IDs for all created orders', async () => {
      // Feature: qr-restaurant-ordering, Property 10: Order ID Uniqueness
      // Validates: Requirements 3.3
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 50 }),
          async (tableIds) => {
            await clearAllData();
            const orders = [];
            for (const tableId of tableIds) {
              orders.push(await createOrder(tableId));
            }
            
            // Extract all order IDs
            const ids = orders.map(o => o.id);
            
            // Verify all IDs are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 11: New Orders Start as Pending', () => {
    it('should initialize all new orders with pending status', async () => {
      // Feature: qr-restaurant-ordering, Property 11: New Orders Start as Pending
      // Validates: Requirements 3.4
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 50 }),
          async (tableIds) => {
            await clearAllData();
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              
              // Verify order status is pending
              expect(order.status).toBe(OrderStatus.PENDING);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Item Selection Adds to Order', () => {
    it('should add selected items to order and persist them', async () => {
      // Feature: qr-restaurant-ordering, Property 5: Item Selection Adds to Order
      // Validates: Requirements 3.1
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableId, items) => {
            await clearAllData();
            const order = await createOrder(tableId);
            
            // Add each item to the order
            let updatedOrder = order;
            for (const item of items) {
              updatedOrder = await addItemToOrder(updatedOrder.id, item);
            }
            
            // Verify all items are in the order
            expect(updatedOrder.items).toHaveLength(items.length);
            for (let i = 0; i < items.length; i++) {
              expect(updatedOrder.items[i]).toEqual(items[i]);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: Item Removal from Order', () => {
    it('should remove items from order and update total correctly', async () => {
      // Feature: qr-restaurant-ordering, Property 6: Item Removal from Order
      // Validates: Requirements 3.1
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 10 }),
          async (tableId, items) => {
            await clearAllData();
            const order = await createOrder(tableId, items);
            
            // Remove items one by one
            let currentOrder = order;
            for (let i = 0; i < items.length; i++) {
              currentOrder = await removeItemFromOrder(currentOrder.id, 0);
              
              // Verify item count decreased
              expect(currentOrder.items).toHaveLength(items.length - i - 1);
            }
            
            // Verify order is empty
            expect(currentOrder.items).toHaveLength(0);
            expect(currentOrder.totalPrice).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Order Persistence Round Trip', () => {
    it('should persist and retrieve orders with all data intact', async () => {
      // Feature: qr-restaurant-ordering, Property 36: Order Persistence Round Trip
      // Validates: Requirements 3.1, 3.2, 3.3, 3.4
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(orderItemArbitrary, { minLength: 0, maxLength: 20 }),
          async (tableId, items) => {
            await clearAllData();
            // Create order
            const order = await createOrder(tableId, items);
            
            // Retrieve order
            const retrieved = await getOrderById(order.id);
            
            // Verify all data is intact
            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(order.id);
            expect(retrieved.tableId).toBe(order.tableId);
            expect(retrieved.items).toEqual(order.items);
            expect(retrieved.status).toBe(order.status);
            expect(retrieved.totalPrice).toBe(order.totalPrice);
            expect(retrieved.createdAt).toBe(order.createdAt);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Multiple Orders by Table', () => {
    it('should correctly retrieve all orders for a specific table', async () => {
      // Feature: qr-restaurant-ordering, Property 9: Order Creation Links to Table
      // Validates: Requirements 3.2
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 10 }),
          async (targetTableId, otherTableIds, ordersPerTable) => {
            // Clear data for each property test iteration
            await clearAllData();
            
            // Create orders for target table
            const targetOrders = [];
            for (let i = 0; i < ordersPerTable; i++) {
              targetOrders.push(await createOrder(targetTableId));
            }
            
            // Create orders for other tables (filter out target table ID to avoid duplicates)
            const uniqueOtherTableIds = [...new Set(otherTableIds)].filter(id => id !== targetTableId);
            for (const tableId of uniqueOtherTableIds) {
              await createOrder(tableId);
            }
            
            // Retrieve orders for target table
            const retrieved = await getOrdersByTable(targetTableId);
            
            // Verify correct orders are retrieved
            expect(retrieved).toHaveLength(ordersPerTable);
            for (const order of retrieved) {
              expect(order.tableId).toBe(targetTableId);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Order Total Calculation with Multiple Operations', () => {
    it('should maintain correct total through add and remove operations', async () => {
      // Feature: qr-restaurant-ordering, Property 8: Order Summary Accuracy
      // Validates: Requirements 3.1
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 10 }),
          async (tableId, items) => {
            await clearAllData();
            const order = await createOrder(tableId);
            
            // Add items and track expected total
            let expectedTotal = 0;
            let currentOrder = order;
            
            for (const item of items) {
              currentOrder = await addItemToOrder(currentOrder.id, item);
              expectedTotal += item.price * item.quantity;
              expect(currentOrder.totalPrice).toBe(expectedTotal);
            }
            
            // Remove items and verify total updates
            for (let i = 0; i < items.length; i++) {
              const removedItem = currentOrder.items[0];
              currentOrder = await removeItemFromOrder(currentOrder.id, 0);
              expectedTotal -= removedItem.price * removedItem.quantity;
              expect(currentOrder.totalPrice).toBe(expectedTotal);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 14: Status Transition to Preparing', () => {
    it('should transition pending orders to preparing and persist', async () => {
      // Feature: qr-restaurant-ordering, Property 14: Status Transition to Preparing
      // Validates: Requirements 4.3
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create order with pending status
              const order = await createOrder(tableId);
              expect(order.status).toBe(OrderStatus.PENDING);
              
              // Transition to preparing
              const updated = await updateOrderStatus(order.id, OrderStatus.PREPARING);
              expect(updated.status).toBe(OrderStatus.PREPARING);
              expect(updated.updatedAt).toBeGreaterThan(order.updatedAt);
              
              // Verify persistence
              const retrieved = await getOrderById(order.id);
              expect(retrieved.status).toBe(OrderStatus.PREPARING);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 15: Status Transition to Ready', () => {
    it('should transition preparing orders to ready and persist', async () => {
      // Feature: qr-restaurant-ordering, Property 15: Status Transition to Ready
      // Validates: Requirements 4.4
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create order and transition to preparing
              const order = await createOrder(tableId);
              await updateOrderStatus(order.id, OrderStatus.PREPARING);
              
              // Transition to ready
              const updated = await updateOrderStatus(order.id, OrderStatus.READY);
              expect(updated.status).toBe(OrderStatus.READY);
              
              // Verify persistence
              const retrieved = await getOrderById(order.id);
              expect(retrieved.status).toBe(OrderStatus.READY);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 17: Status Transition to Served', () => {
    it('should transition ready orders to served and persist', async () => {
      // Feature: qr-restaurant-ordering, Property 17: Status Transition to Served
      // Validates: Requirements 5.2
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create order and transition to ready
              const order = await createOrder(tableId);
              await updateOrderStatus(order.id, OrderStatus.PREPARING);
              await updateOrderStatus(order.id, OrderStatus.READY);
              
              // Transition to served
              const updated = await updateOrderStatus(order.id, OrderStatus.SERVED);
              expect(updated.status).toBe(OrderStatus.SERVED);
              
              // Verify persistence
              const retrieved = await getOrderById(order.id);
              expect(retrieved.status).toBe(OrderStatus.SERVED);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 42: Status Transition to Completed', () => {
    it('should transition served orders to completed and persist', async () => {
      // Feature: qr-restaurant-ordering, Property 42: Status Transition to Completed
      // Validates: Requirements 12.1, 12.2
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              // Create order and transition to served
              const order = await createOrder(tableId);
              await updateOrderStatus(order.id, OrderStatus.PREPARING);
              await updateOrderStatus(order.id, OrderStatus.READY);
              await updateOrderStatus(order.id, OrderStatus.SERVED);
              
              // Transition to completed
              const updated = await updateOrderStatus(order.id, OrderStatus.COMPLETED);
              expect(updated.status).toBe(OrderStatus.COMPLETED);
              expect(updated.completedAt).toBeDefined();
              expect(updated.completedAt).toBeGreaterThan(0);
              
              // Verify persistence
              const retrieved = await getOrderById(order.id);
              expect(retrieved.status).toBe(OrderStatus.COMPLETED);
              expect(retrieved.completedAt).toBe(updated.completedAt);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Invalid Status Transitions Rejected', () => {
    it('should reject all invalid status transitions', async () => {
      // Feature: qr-restaurant-ordering, Property: Status Transition Validation
      // Validates: Requirements 4.3, 4.4, 5.2, 12.1, 12.2
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          async (tableId) => {
            await clearAllData();
            
            // Test invalid transitions from pending
            const order1 = await createOrder(tableId);
            await expect(updateOrderStatus(order1.id, OrderStatus.READY)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order1.id, OrderStatus.SERVED)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order1.id, OrderStatus.COMPLETED)).rejects.toThrow('Invalid status transition');
            
            // Test invalid transitions from preparing
            const order2 = await createOrder(tableId);
            await updateOrderStatus(order2.id, OrderStatus.PREPARING);
            await expect(updateOrderStatus(order2.id, OrderStatus.PENDING)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order2.id, OrderStatus.SERVED)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order2.id, OrderStatus.COMPLETED)).rejects.toThrow('Invalid status transition');
            
            // Test invalid transitions from ready
            const order3 = await createOrder(tableId);
            await updateOrderStatus(order3.id, OrderStatus.PREPARING);
            await updateOrderStatus(order3.id, OrderStatus.READY);
            await expect(updateOrderStatus(order3.id, OrderStatus.PENDING)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order3.id, OrderStatus.PREPARING)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order3.id, OrderStatus.COMPLETED)).rejects.toThrow('Invalid status transition');
            
            // Test invalid transitions from served
            const order4 = await createOrder(tableId);
            await updateOrderStatus(order4.id, OrderStatus.PREPARING);
            await updateOrderStatus(order4.id, OrderStatus.READY);
            await updateOrderStatus(order4.id, OrderStatus.SERVED);
            await expect(updateOrderStatus(order4.id, OrderStatus.PENDING)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order4.id, OrderStatus.PREPARING)).rejects.toThrow('Invalid status transition');
            await expect(updateOrderStatus(order4.id, OrderStatus.READY)).rejects.toThrow('Invalid status transition');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: Status Update Persistence', () => {
    it('should persist all status updates correctly', async () => {
      // Feature: qr-restaurant-ordering, Property 37: Status Update Persistence
      // Validates: Requirements 10.2
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 10 }),
          async (tableIds) => {
            await clearAllData();
            
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              
              // Transition through all statuses
              const statuses = [
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.SERVED,
                OrderStatus.COMPLETED
              ];
              
              for (const status of statuses) {
                await updateOrderStatus(order.id, status);
                
                // Verify persistence after each transition
                const retrieved = await getOrderById(order.id);
                expect(retrieved.status).toBe(status);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 12: Submitted Orders Appear on Queue', () => {
    it('should display all submitted orders on the queue immediately', async () => {
      // Feature: qr-restaurant-ordering, Property 12: Submitted Orders Appear on Queue
      // **Validates: Requirements 4.1, 4.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 30 }),
          async (tableIds) => {
            await clearAllData();
            
            const createdOrders = [];
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              createdOrders.push(order);
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify all submitted orders appear on the queue
            expect(queue).toHaveLength(createdOrders.length);
            for (const order of createdOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 13: Queue Shows Only Active Orders', () => {
    it('should display only orders with pending or preparing status', async () => {
      // Feature: qr-restaurant-ordering, Property 13: Queue Shows Only Active Orders
      // **Validates: Requirements 4.1, 4.2, 4.5, 5.3, 5.4, 12.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 5, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            const activeOrders = [];
            const inactiveOrders = [];
            
            for (let i = 0; i < tableIds.length; i++) {
              const order = await createOrder(tableIds[i]);
              
              // Randomly assign different statuses
              const statusChoice = i % 5;
              if (statusChoice === 0) {
                // Keep as pending
                activeOrders.push(order);
              } else if (statusChoice === 1) {
                // Set to preparing
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                activeOrders.push(order);
              } else if (statusChoice === 2) {
                // Set to ready
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                await updateOrderStatus(order.id, OrderStatus.READY);
                inactiveOrders.push(order);
              } else if (statusChoice === 3) {
                // Set to served
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                await updateOrderStatus(order.id, OrderStatus.READY);
                await updateOrderStatus(order.id, OrderStatus.SERVED);
                inactiveOrders.push(order);
              } else {
                // Set to completed
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                await updateOrderStatus(order.id, OrderStatus.READY);
                await updateOrderStatus(order.id, OrderStatus.SERVED);
                await updateOrderStatus(order.id, OrderStatus.COMPLETED);
                inactiveOrders.push(order);
              }
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify only active orders (pending or preparing) are in the queue
            expect(queue).toHaveLength(activeOrders.length);
            
            for (const order of activeOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(true);
            }
            
            for (const order of inactiveOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 16: Queue Sorted by Submission Time', () => {
    it('should sort all orders by submission time with oldest first', async () => {
      // Feature: qr-restaurant-ordering, Property 16: Queue Sorted by Submission Time
      // **Validates: Requirements 4.5**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 2, maxLength: 20 }),
          async (tableIds) => {
            await clearAllData();
            
            const createdOrders = [];
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              createdOrders.push(order);
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 2));
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify queue is sorted by createdAt (ascending)
            for (let i = 0; i < queue.length - 1; i++) {
              expect(queue[i].createdAt).toBeLessThanOrEqual(queue[i + 1].createdAt);
            }
            
            // Verify the order matches creation order
            expect(queue).toHaveLength(createdOrders.length);
            for (let i = 0; i < createdOrders.length; i++) {
              expect(queue[i].id).toBe(createdOrders[i].id);
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 10000); // 10 second timeout for this test
  });

  describe('Property 18: Served Orders Removed from Queue', () => {
    it('should remove orders from queue when marked as served', async () => {
      // Feature: qr-restaurant-ordering, Property 18: Served Orders Removed from Queue
      // **Validates: Requirements 5.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 3, maxLength: 15 }),
          async (tableIds) => {
            await clearAllData();
            
            const orders = [];
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              orders.push(order);
            }
            
            // Mark some orders as served
            const servedOrders = [];
            const activeOrders = [];
            
            for (let i = 0; i < orders.length; i++) {
              if (i % 2 === 0) {
                // Mark as served
                await updateOrderStatus(orders[i].id, OrderStatus.PREPARING);
                await updateOrderStatus(orders[i].id, OrderStatus.READY);
                await updateOrderStatus(orders[i].id, OrderStatus.SERVED);
                servedOrders.push(orders[i]);
              } else {
                // Keep as active
                activeOrders.push(orders[i]);
              }
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify served orders are not in the queue
            for (const order of servedOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(false);
            }
            
            // Verify active orders are still in the queue
            expect(queue).toHaveLength(activeOrders.length);
            for (const order of activeOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19: Queue Displays Table Identifier', () => {
    it('should include table identifier with each order in the queue', async () => {
      // Feature: qr-restaurant-ordering, Property 19: Queue Displays Table Identifier
      // **Validates: Requirements 5.4**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 30 }),
          async (tableIds) => {
            await clearAllData();
            
            const orderTableMap = new Map();
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              orderTableMap.set(order.id, tableId);
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify each order has a table identifier
            expect(queue).toHaveLength(tableIds.length);
            for (const queueOrder of queue) {
              expect(queueOrder.tableId).toBeDefined();
              expect(typeof queueOrder.tableId).toBe('string');
              expect(queueOrder.tableId.length).toBeGreaterThan(0);
              
              // Verify the table ID matches the original
              expect(queueOrder.tableId).toBe(orderTableMap.get(queueOrder.id));
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 43: Completed Orders Removed from Queue', () => {
    it('should remove orders from queue when marked as completed', async () => {
      // Feature: qr-restaurant-ordering, Property 43: Completed Orders Removed from Queue
      // **Validates: Requirements 12.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableIdArbitrary, { minLength: 3, maxLength: 15 }),
          async (tableIds) => {
            await clearAllData();
            
            const orders = [];
            for (const tableId of tableIds) {
              const order = await createOrder(tableId);
              orders.push(order);
            }
            
            // Mark some orders as completed
            const completedOrders = [];
            const activeOrders = [];
            
            for (let i = 0; i < orders.length; i++) {
              if (i % 3 === 0) {
                // Mark as completed
                await updateOrderStatus(orders[i].id, OrderStatus.PREPARING);
                await updateOrderStatus(orders[i].id, OrderStatus.READY);
                await updateOrderStatus(orders[i].id, OrderStatus.SERVED);
                await updateOrderStatus(orders[i].id, OrderStatus.COMPLETED);
                completedOrders.push(orders[i]);
              } else {
                // Keep as active (pending or preparing)
                if (i % 3 === 1) {
                  await updateOrderStatus(orders[i].id, OrderStatus.PREPARING);
                }
                activeOrders.push(orders[i]);
              }
            }
            
            // Retrieve the order queue
            const queue = await getOrderQueue();
            
            // Verify completed orders are not in the queue
            for (const order of completedOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(false);
            }
            
            // Verify active orders are still in the queue
            expect(queue).toHaveLength(activeOrders.length);
            for (const order of activeOrders) {
              const foundInQueue = queue.some(queueOrder => queueOrder.id === order.id);
              expect(foundInQueue).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 31: Table Order History Display', () => {
    it('should display all orders for a table including both active and completed', async () => {
      // Feature: qr-restaurant-ordering, Property 31: Table Order History Display
      // **Validates: Requirements 8.5**
      
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          fc.array(tableIdArbitrary, { minLength: 1, maxLength: 10 }),
          fc.integer({ min: 1, max: 15 }),
          async (targetTableId, otherTableIds, orderCount) => {
            await clearAllData();
            
            // Create orders for target table with various statuses
            const targetOrders = [];
            for (let i = 0; i < orderCount; i++) {
              const order = await createOrder(targetTableId);
              targetOrders.push(order);
              
              // Assign different statuses to orders
              const statusChoice = i % 5;
              if (statusChoice === 1) {
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
              } else if (statusChoice === 2) {
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                await updateOrderStatus(order.id, OrderStatus.READY);
              } else if (statusChoice === 3) {
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                await updateOrderStatus(order.id, OrderStatus.READY);
                await updateOrderStatus(order.id, OrderStatus.SERVED);
              } else if (statusChoice === 4) {
                await updateOrderStatus(order.id, OrderStatus.PREPARING);
                await updateOrderStatus(order.id, OrderStatus.READY);
                await updateOrderStatus(order.id, OrderStatus.SERVED);
                await updateOrderStatus(order.id, OrderStatus.COMPLETED);
              }
              // statusChoice === 0 remains pending
            }
            
            // Create orders for other tables (to ensure filtering works)
            const uniqueOtherTableIds = [...new Set(otherTableIds)].filter(id => id !== targetTableId);
            for (const tableId of uniqueOtherTableIds) {
              await createOrder(tableId);
            }
            
            // Retrieve order history for target table
            const history = await getOrdersByTable(targetTableId);
            
            // Verify all orders for target table are returned
            expect(history).toHaveLength(orderCount);
            
            // Verify all returned orders belong to target table
            for (const order of history) {
              expect(order.tableId).toBe(targetTableId);
            }
            
            // Verify all target orders are in the history
            for (const targetOrder of targetOrders) {
              const foundInHistory = history.some(historyOrder => historyOrder.id === targetOrder.id);
              expect(foundInHistory).toBe(true);
            }
            
            // Verify history includes both active and completed orders
            const statuses = history.map(o => o.status);
            const hasActiveOrders = statuses.some(s => 
              s === OrderStatus.PENDING || s === OrderStatus.PREPARING
            );
            const hasCompletedOrders = statuses.some(s => s === OrderStatus.COMPLETED);
            
            // If we have enough orders, we should have both types
            if (orderCount >= 5) {
              expect(hasActiveOrders).toBe(true);
              expect(hasCompletedOrders).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
