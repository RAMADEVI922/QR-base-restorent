/**
 * Property-based tests for persistence layer
 * Uses fast-check to verify persistence operations work correctly across all valid inputs
 * 
 * Feature: qr-restaurant-ordering
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  readTables,
  readMenuItems,
  readOrders,
  writeTables,
  writeMenuItems,
  writeOrders,
  initializeStorage,
  clearAllData
} from './persistenceManager.js';
import { OrderStatus, TableStatus } from '../shared/types.js';

// Arbitraries for generating test data
const tableArbitrary = fc.record({
  id: fc.uuid(),
  qrCode: fc.string({ minLength: 1, maxLength: 1000 }),
  status: fc.constantFrom(TableStatus.ACTIVE, TableStatus.INACTIVE),
  createdAt: fc.integer({ min: 1, max: Date.now() }),
  updatedAt: fc.integer({ min: 1, max: Date.now() })
});

const menuItemArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 500 }),
  price: fc.integer({ min: 0, max: 1000000 }),
  available: fc.boolean(),
  createdAt: fc.integer({ min: 1, max: Date.now() }),
  updatedAt: fc.integer({ min: 1, max: Date.now() })
});

const orderItemArbitrary = fc.record({
  menuItemId: fc.uuid(),
  quantity: fc.integer({ min: 1, max: 100 }),
  price: fc.integer({ min: 0, max: 1000000 }),
  name: fc.string({ minLength: 1, maxLength: 100 })
});

const orderArbitrary = fc.record({
  id: fc.uuid(),
  tableId: fc.uuid(),
  items: fc.array(orderItemArbitrary, { minLength: 1, maxLength: 50 }),
  status: fc.constantFrom(
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED
  ),
  totalPrice: fc.integer({ min: 0, max: 10000000 }),
  createdAt: fc.integer({ min: 1, max: Date.now() }),
  updatedAt: fc.integer({ min: 1, max: Date.now() }),
  completedAt: fc.option(fc.integer({ min: 1, max: Date.now() })),
  previousOrderId: fc.option(fc.uuid())
});

describe('Persistence Layer - Property-Based Tests', () => {
  beforeEach(async () => {
    await initializeStorage();
  });

  afterEach(async () => {
    await clearAllData();
  });

  // Property 36: Order Persistence Round Trip
  describe('Property 36: Order Persistence Round Trip', () => {
    it('should persist and retrieve orders with identical data', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(orderArbitrary, { minLength: 1, maxLength: 10 }), async (orders) => {
          // Write orders to storage
          await writeOrders(orders);

          // Read orders back from storage
          const retrieved = await readOrders();

          // Verify all orders were persisted correctly
          expect(retrieved).toHaveLength(orders.length);
          
          // Verify each order matches exactly
          orders.forEach((original, index) => {
            expect(retrieved[index]).toEqual(original);
          });
        }),
        { numRuns: 20 }
      );
    });

    it('should maintain order integrity through multiple round trips', async () => {
      await fc.assert(
        fc.asyncProperty(orderArbitrary, async (order) => {
          // First round trip
          await writeOrders([order]);
          const retrieved1 = await readOrders();
          expect(retrieved1[0]).toEqual(order);

          // Second round trip with retrieved data
          await writeOrders(retrieved1);
          const retrieved2 = await readOrders();
          expect(retrieved2[0]).toEqual(order);

          // Verify data hasn't changed
          expect(retrieved2[0]).toEqual(retrieved1[0]);
        }),
        { numRuns: 20 }
      );
    });
  });

  // Property 37: Status Update Persistence
  describe('Property 37: Status Update Persistence', () => {
    it('should persist order status updates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderArbitrary,
          fc.constantFrom(
            OrderStatus.PENDING,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.SERVED,
            OrderStatus.COMPLETED
          ),
          async (order, newStatus) => {
            // Create and persist initial order
            await writeOrders([order]);

            // Read and update status
            const orders = await readOrders();
            const updatedOrder = {
              ...orders[0],
              status: newStatus,
              updatedAt: Date.now()
            };

            // Persist updated order
            await writeOrders([updatedOrder]);

            // Verify status was persisted
            const retrieved = await readOrders();
            expect(retrieved[0].status).toBe(newStatus);
            expect(retrieved[0].id).toBe(order.id);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve other order fields when updating status', async () => {
      await fc.assert(
        fc.asyncProperty(orderArbitrary, async (order) => {
          // Persist initial order
          await writeOrders([order]);

          // Update only the status
          const orders = await readOrders();
          const updatedOrder = {
            ...orders[0],
            status: OrderStatus.PREPARING,
            updatedAt: Date.now()
          };

          await writeOrders([updatedOrder]);

          // Verify all other fields remain unchanged
          const retrieved = await readOrders();
          expect(retrieved[0].id).toBe(order.id);
          expect(retrieved[0].tableId).toBe(order.tableId);
          expect(retrieved[0].items).toEqual(order.items);
          expect(retrieved[0].totalPrice).toBe(order.totalPrice);
          expect(retrieved[0].createdAt).toBe(order.createdAt);
        }),
        { numRuns: 20 }
      );
    });
  });

  // Property 38: Table Persistence Round Trip
  describe('Property 38: Table Persistence Round Trip', () => {
    it('should persist and retrieve tables with identical data', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(tableArbitrary, { minLength: 1, maxLength: 10 }), async (tables) => {
          // Write tables to storage
          await writeTables(tables);

          // Read tables back from storage
          const retrieved = await readTables();

          // Verify all tables were persisted correctly
          expect(retrieved).toHaveLength(tables.length);

          // Verify each table matches exactly
          tables.forEach((original, index) => {
            expect(retrieved[index]).toEqual(original);
          });
        }),
        { numRuns: 20 }
      );
    });

    it('should maintain table integrity through multiple round trips', async () => {
      await fc.assert(
        fc.asyncProperty(tableArbitrary, async (table) => {
          // First round trip
          await writeTables([table]);
          const retrieved1 = await readTables();
          expect(retrieved1[0]).toEqual(table);

          // Second round trip with retrieved data
          await writeTables(retrieved1);
          const retrieved2 = await readTables();
          expect(retrieved2[0]).toEqual(table);

          // Verify data hasn't changed
          expect(retrieved2[0]).toEqual(retrieved1[0]);
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve QR code data through persistence', async () => {
      await fc.assert(
        fc.asyncProperty(tableArbitrary, async (table) => {
          // Persist table
          await writeTables([table]);

          // Retrieve and verify QR code is intact
          const retrieved = await readTables();
          expect(retrieved[0].qrCode).toBe(table.qrCode);
          expect(retrieved[0].qrCode).toHaveLength(table.qrCode.length);
        }),
        { numRuns: 20 }
      );
    });
  });

  // Property 39: Menu Item Persistence Round Trip
  describe('Property 39: Menu Item Persistence Round Trip', () => {
    it('should persist and retrieve menu items with identical data', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(menuItemArbitrary, { minLength: 1, maxLength: 10 }), async (items) => {
          // Write menu items to storage
          await writeMenuItems(items);

          // Read menu items back from storage
          const retrieved = await readMenuItems();

          // Verify all items were persisted correctly
          expect(retrieved).toHaveLength(items.length);

          // Verify each item matches exactly
          items.forEach((original, index) => {
            expect(retrieved[index]).toEqual(original);
          });
        }),
        { numRuns: 20 }
      );
    });

    it('should maintain menu item integrity through multiple round trips', async () => {
      await fc.assert(
        fc.asyncProperty(menuItemArbitrary, async (item) => {
          // First round trip
          await writeMenuItems([item]);
          const retrieved1 = await readMenuItems();
          expect(retrieved1[0]).toEqual(item);

          // Second round trip with retrieved data
          await writeMenuItems(retrieved1);
          const retrieved2 = await readMenuItems();
          expect(retrieved2[0]).toEqual(item);

          // Verify data hasn't changed
          expect(retrieved2[0]).toEqual(retrieved1[0]);
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve availability status through persistence', async () => {
      await fc.assert(
        fc.asyncProperty(menuItemArbitrary, async (item) => {
          // Persist menu item
          await writeMenuItems([item]);

          // Retrieve and verify availability is preserved
          const retrieved = await readMenuItems();
          expect(retrieved[0].available).toBe(item.available);
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve price precision through persistence', async () => {
      await fc.assert(
        fc.asyncProperty(menuItemArbitrary, async (item) => {
          // Persist menu item
          await writeMenuItems([item]);

          // Retrieve and verify price is exact
          const retrieved = await readMenuItems();
          expect(retrieved[0].price).toBe(item.price);
          expect(typeof retrieved[0].price).toBe('number');
        }),
        { numRuns: 20 }
      );
    });
  });

  // Additional cross-entity persistence tests
  describe('Cross-Entity Persistence', () => {
    it('should persist multiple entity types independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(tableArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(menuItemArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(orderArbitrary, { minLength: 1, maxLength: 5 }),
          async (tables, items, orders) => {
            // Persist all entity types
            await writeTables(tables);
            await writeMenuItems(items);
            await writeOrders(orders);

            // Retrieve all entity types
            const retrievedTables = await readTables();
            const retrievedItems = await readMenuItems();
            const retrievedOrders = await readOrders();

            // Verify each entity type was persisted correctly
            expect(retrievedTables).toHaveLength(tables.length);
            expect(retrievedItems).toHaveLength(items.length);
            expect(retrievedOrders).toHaveLength(orders.length);

            // Verify data integrity
            tables.forEach((table, i) => {
              expect(retrievedTables[i]).toEqual(table);
            });
            items.forEach((item, i) => {
              expect(retrievedItems[i]).toEqual(item);
            });
            orders.forEach((order, i) => {
              expect(retrievedOrders[i]).toEqual(order);
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle updates to one entity type without affecting others', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableArbitrary,
          menuItemArbitrary,
          orderArbitrary,
          async (table, item, order) => {
            // Persist all entity types
            await writeTables([table]);
            await writeMenuItems([item]);
            await writeOrders([order]);

            // Update only the table
            const updatedTable = {
              ...table,
              status: table.status === TableStatus.ACTIVE ? TableStatus.INACTIVE : TableStatus.ACTIVE,
              updatedAt: Date.now()
            };
            await writeTables([updatedTable]);

            // Verify table was updated
            const retrievedTables = await readTables();
            expect(retrievedTables[0].status).toBe(updatedTable.status);

            // Verify other entities remain unchanged
            const retrievedItems = await readMenuItems();
            const retrievedOrders = await readOrders();
            expect(retrievedItems[0]).toEqual(item);
            expect(retrievedOrders[0]).toEqual(order);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Timestamp preservation tests
  describe('Timestamp Preservation', () => {
    it('should preserve exact timestamps for orders', async () => {
      await fc.assert(
        fc.asyncProperty(orderArbitrary, async (order) => {
          await writeOrders([order]);
          const retrieved = await readOrders();

          expect(retrieved[0].createdAt).toBe(order.createdAt);
          expect(retrieved[0].updatedAt).toBe(order.updatedAt);
          if (order.completedAt !== null) {
            expect(retrieved[0].completedAt).toBe(order.completedAt);
          }
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve exact timestamps for tables', async () => {
      await fc.assert(
        fc.asyncProperty(tableArbitrary, async (table) => {
          await writeTables([table]);
          const retrieved = await readTables();

          expect(retrieved[0].createdAt).toBe(table.createdAt);
          expect(retrieved[0].updatedAt).toBe(table.updatedAt);
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve exact timestamps for menu items', async () => {
      await fc.assert(
        fc.asyncProperty(menuItemArbitrary, async (item) => {
          await writeMenuItems([item]);
          const retrieved = await readMenuItems();

          expect(retrieved[0].createdAt).toBe(item.createdAt);
          expect(retrieved[0].updatedAt).toBe(item.updatedAt);
        }),
        { numRuns: 20 }
      );
    });
  });

  // Order items preservation tests
  describe('Order Items Preservation', () => {
    it('should preserve all order items exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 50 }),
          async (items) => {
            const order = {
              id: fc.sample(fc.uuid(), 1)[0],
              tableId: fc.sample(fc.uuid(), 1)[0],
              items,
              status: OrderStatus.PENDING,
              totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              completedAt: null,
              previousOrderId: null
            };

            await writeOrders([order]);
            const retrieved = await readOrders();

            expect(retrieved[0].items).toHaveLength(items.length);
            items.forEach((item, index) => {
              expect(retrieved[0].items[index]).toEqual(item);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
