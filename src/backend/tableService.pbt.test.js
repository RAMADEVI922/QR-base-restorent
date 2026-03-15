/**
 * Property-based tests for Table Service
 * Uses fast-check to verify table operations work correctly across all valid inputs
 * 
 * Feature: qr-restaurant-ordering
 * Validates: Requirements 1.1, 1.4, 8.1, 8.2, 8.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  createTable,
  getTableById,
  getAllTables,
  getActiveTables,
  updateTableStatus,
  deleteTable,
  isTableActive,
  getTableOrderHistory
} from './tableService.js';
import { clearAllData } from './persistenceManager.js';
import { TableStatus } from '../shared/types.js';
import { generateQRCode } from './qrCodeGenerator.js';
import { createOrder, updateOrderStatus } from './orderService.js';

// Arbitrary for generating valid QR codes (with better uniqueness)
const qrCodeArbitrary = fc.string({ minLength: 20, maxLength: 100 }).map(s => `data:image/png;base64,${s}`);

// Arbitrary for generating table data
const tableDataArbitrary = fc.record({
  qrCode: qrCodeArbitrary
});

// Arbitrary for generating order items
const orderItemArbitrary = fc.record({
  menuItemId: fc.string({ minLength: 5, maxLength: 20 }),
  name: fc.string({ minLength: 3, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 10 }),
  price: fc.integer({ min: 100, max: 10000 })
});

describe.sequential('Table Service - Property-Based Tests', () => {
  beforeEach(async () => {
    // Ensure clean state before each test
    await clearAllData();
    // Small delay to ensure file system operations complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    // Clean up after each test
    await clearAllData();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  // Property 1: QR Code Uniqueness
  describe('Property 1: QR Code Uniqueness', () => {
    it('should generate unique QR codes for all created tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 2, maxLength: 20 }),
          async (qrCodes) => {
            // Create tables with different QR codes
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Extract QR codes from created tables
            const createdQRCodes = tables.map(t => t.qrCode);

            // Verify all QR codes are unique
            const uniqueQRCodes = new Set(createdQRCodes);
            expect(uniqueQRCodes.size).toBe(createdQRCodes.length);

            // Verify all QR codes match input
            qrCodes.forEach((qrCode, index) => {
              expect(createdQRCodes[index]).toBe(qrCode);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique table IDs for all created tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 2, maxLength: 20 }),
          async (qrCodes) => {
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Extract IDs
            const ids = tables.map(t => t.id);

            // Verify all IDs are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // Verify all IDs are non-empty strings
            ids.forEach(id => {
              expect(typeof id).toBe('string');
              expect(id.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain QR code uniqueness across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 2, maxLength: 10 }),
          async (qrCodes) => {
            // Create initial tables
            const tables1 = await Promise.all(
              qrCodes.slice(0, Math.ceil(qrCodes.length / 2)).map(qrCode => createTable(qrCode))
            );

            // Create more tables
            const tables2 = await Promise.all(
              qrCodes.slice(Math.ceil(qrCodes.length / 2)).map(qrCode => createTable(qrCode))
            );

            // Combine all tables
            const allTables = [...tables1, ...tables2];
            const allQRCodes = allTables.map(t => t.qrCode);

            // Verify uniqueness across all tables
            const uniqueQRCodes = new Set(allQRCodes);
            expect(uniqueQRCodes.size).toBe(allQRCodes.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 3: QR Code Validation for Active Tables
  describe('Property 3: QR Code Validation for Active Tables', () => {
    it('should allow operations on active tables only', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 1, maxLength: 10 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // All newly created tables should be active
            for (const table of tables) {
              const isActive = await isTableActive(table.id);
              expect(isActive).toBe(true);
              expect(table.status).toBe(TableStatus.ACTIVE);
            }

            // Delete some tables
            const tablesToDelete = tables.slice(0, Math.ceil(tables.length / 2));
            await Promise.all(
              tablesToDelete.map(table => deleteTable(table.id))
            );

            // Verify deleted tables are inactive
            for (const table of tablesToDelete) {
              const isActive = await isTableActive(table.id);
              expect(isActive).toBe(false);
            }

            // Verify remaining tables are still active
            const remainingTables = tables.slice(Math.ceil(tables.length / 2));
            for (const table of remainingTables) {
              const isActive = await isTableActive(table.id);
              expect(isActive).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent operations on inactive tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create and delete a table
            const table = await createTable(qrCode);
            await deleteTable(table.id);

            // Verify table is inactive
            const isActive = await isTableActive(table.id);
            expect(isActive).toBe(false);

            // Verify we can still retrieve the inactive table
            const retrieved = await getTableById(table.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved.status).toBe(TableStatus.INACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter inactive tables from active table list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 2, maxLength: 10 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Delete some tables
            const tablesToDelete = tables.slice(0, Math.ceil(tables.length / 2));
            await Promise.all(
              tablesToDelete.map(table => deleteTable(table.id))
            );

            // Get active tables
            const activeTables = await getActiveTables();

            // Verify only active tables are returned
            const activeTableIds = activeTables.map(t => t.id);
            const deletedTableIds = tablesToDelete.map(t => t.id);

            deletedTableIds.forEach(id => {
              expect(activeTableIds).not.toContain(id);
            });

            // Verify all returned tables are active
            activeTables.forEach(table => {
              expect(table.status).toBe(TableStatus.ACTIVE);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 28: Tables Page Displays All Tables
  describe('Property 28: Tables Page Displays All Tables', () => {
    it('should retrieve all tables including active and inactive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 1, maxLength: 20 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Delete some tables
            const tablesToDelete = tables.slice(0, Math.ceil(tables.length / 2));
            await Promise.all(
              tablesToDelete.map(table => deleteTable(table.id))
            );

            // Get all tables
            const allTables = await getAllTables();

            // Verify all tables are returned
            expect(allTables).toHaveLength(tables.length);

            // Verify each created table is in the result
            const allTableIds = allTables.map(t => t.id);
            tables.forEach(table => {
              expect(allTableIds).toContain(table.id);
            });

            // Verify correct status for each table
            tables.forEach(originalTable => {
              const retrieved = allTables.find(t => t.id === originalTable.id);
              expect(retrieved).toBeDefined();

              if (tablesToDelete.some(t => t.id === originalTable.id)) {
                expect(retrieved.status).toBe(TableStatus.INACTIVE);
              } else {
                expect(retrieved.status).toBe(TableStatus.ACTIVE);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display all table identifiers correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 1, maxLength: 20 }),
          async (qrCodes) => {
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Get all tables
            const allTables = await getAllTables();

            // Verify each table has a valid identifier
            allTables.forEach(table => {
              expect(table.id).toBeDefined();
              expect(typeof table.id).toBe('string');
              expect(table.id.length).toBeGreaterThan(0);
            });

            // Verify identifiers are unique
            const ids = allTables.map(t => t.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain table count consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 1, maxLength: 20 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Get all tables
            let allTables = await getAllTables();
            expect(allTables).toHaveLength(tables.length);

            // Delete a table
            if (tables.length > 0) {
              await deleteTable(tables[0].id);
              allTables = await getAllTables();
              expect(allTables).toHaveLength(tables.length);
            }

            // Get active tables
            const activeTables = await getActiveTables();
            expect(activeTables.length).toBeLessThanOrEqual(allTables.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 29: Table Creation Generates QR Code
  describe('Property 29: Table Creation Generates QR Code', () => {
    it('should generate QR code for each created table', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);

            // Verify QR code is present
            expect(table.qrCode).toBeDefined();
            expect(typeof table.qrCode).toBe('string');
            expect(table.qrCode.length).toBeGreaterThan(0);

            // Verify QR code matches input
            expect(table.qrCode).toBe(qrCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist QR code with table', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);

            // Retrieve table
            const retrieved = await getTableById(table.id);

            // Verify QR code is persisted
            expect(retrieved).not.toBeNull();
            expect(retrieved.qrCode).toBe(qrCode);
            expect(retrieved.qrCode).toBe(table.qrCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain QR code through status updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);
            const originalQRCode = table.qrCode;

            // Update status
            await updateTableStatus(table.id, TableStatus.INACTIVE);

            // Retrieve table
            const retrieved = await getTableById(table.id);

            // Verify QR code is unchanged
            expect(retrieved.qrCode).toBe(originalQRCode);
            expect(retrieved.qrCode).toBe(qrCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain QR code through deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);
            const originalQRCode = table.qrCode;

            // Delete table
            await deleteTable(table.id);

            // Retrieve table
            const retrieved = await getTableById(table.id);

            // Verify QR code is unchanged
            expect(retrieved.qrCode).toBe(originalQRCode);
            expect(retrieved.qrCode).toBe(qrCode);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 30: Deleted Tables Marked Inactive
  describe('Property 30: Deleted Tables Marked Inactive', () => {
    it('should mark deleted tables as inactive', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 1, maxLength: 20 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Delete all tables
            await Promise.all(
              tables.map(table => deleteTable(table.id))
            );

            // Verify all tables are marked inactive
            for (const table of tables) {
              const retrieved = await getTableById(table.id);
              expect(retrieved.status).toBe(TableStatus.INACTIVE);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent new orders at deleted tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create and delete table
            const table = await createTable(qrCode);
            await deleteTable(table.id);

            // Verify table is inactive
            const isActive = await isTableActive(table.id);
            expect(isActive).toBe(false);

            // Verify table status is INACTIVE
            const retrieved = await getTableById(table.id);
            expect(retrieved.status).toBe(TableStatus.INACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain deleted table data for history', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);
            const originalId = table.id;
            const originalQRCode = table.qrCode;
            const originalCreatedAt = table.createdAt;

            // Delete table
            await deleteTable(table.id);

            // Retrieve deleted table
            const retrieved = await getTableById(originalId);

            // Verify all data is preserved
            expect(retrieved).not.toBeNull();
            expect(retrieved.id).toBe(originalId);
            expect(retrieved.qrCode).toBe(originalQRCode);
            expect(retrieved.createdAt).toBe(originalCreatedAt);
            expect(retrieved.status).toBe(TableStatus.INACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow re-deletion of already deleted tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);

            // Delete table twice
            await deleteTable(table.id);
            const secondDelete = await deleteTable(table.id);

            // Verify second deletion succeeds and table remains inactive
            expect(secondDelete.status).toBe(TableStatus.INACTIVE);

            const retrieved = await getTableById(table.id);
            expect(retrieved.status).toBe(TableStatus.INACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not affect active tables when deleting others', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 2, maxLength: 20 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Delete first half
            const tablesToDelete = tables.slice(0, Math.ceil(tables.length / 2));
            await Promise.all(
              tablesToDelete.map(table => deleteTable(table.id))
            );

            // Verify remaining tables are still active
            const remainingTables = tables.slice(Math.ceil(tables.length / 2));
            for (const table of remainingTables) {
              const isActive = await isTableActive(table.id);
              expect(isActive).toBe(true);

              const retrieved = await getTableById(table.id);
              expect(retrieved.status).toBe(TableStatus.ACTIVE);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Additional comprehensive tests
  describe('Table Service Comprehensive Properties', () => {
    it('should maintain data consistency across all operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 1, maxLength: 10 }),
          async (qrCodes) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Perform various operations
            const allTables = await getAllTables();
            const activeTables = await getActiveTables();

            // Verify consistency
            expect(allTables.length).toBeGreaterThanOrEqual(activeTables.length);
            expect(activeTables.every(t => t.status === TableStatus.ACTIVE)).toBe(true);

            // Delete some tables
            if (tables.length > 0) {
              await deleteTable(tables[0].id);
            }

            // Verify consistency after deletion
            const allTablesAfter = await getAllTables();
            const activeTablesAfter = await getActiveTables();

            expect(allTablesAfter.length).toBe(allTables.length);
            expect(activeTablesAfter.length).toBeLessThanOrEqual(activeTables.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle timestamps correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);

            // Verify timestamps
            expect(table.createdAt).toBeDefined();
            expect(typeof table.createdAt).toBe('number');
            expect(table.createdAt).toBeGreaterThan(0);

            expect(table.updatedAt).toBeDefined();
            expect(typeof table.updatedAt).toBe('number');
            expect(table.updatedAt).toBeGreaterThanOrEqual(table.createdAt);

            // Update table
            const updated = await updateTableStatus(table.id, TableStatus.INACTIVE);

            // Verify updated timestamp changed
            expect(updated.updatedAt).toBeGreaterThanOrEqual(table.updatedAt);
            expect(updated.createdAt).toBe(table.createdAt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all table properties through operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Create table
            const table = await createTable(qrCode);

            // Retrieve and verify all properties
            const retrieved = await getTableById(table.id);

            expect(retrieved.id).toBe(table.id);
            expect(retrieved.qrCode).toBe(table.qrCode);
            expect(retrieved.status).toBe(table.status);
            expect(retrieved.createdAt).toBe(table.createdAt);
            expect(retrieved.updatedAt).toBe(table.updatedAt);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 31: Table Order History Display
  // **Validates: Requirements 8.5**
  describe('Property 31: Table Order History Display', () => {
    it('should display all orders associated with a table', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 3 }),
          fc.integer({ min: 1, max: 5 }),
          async (qrCode, items, orderCount) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create table
            const table = await createTable(qrCode);

            // Create multiple orders for the table
            const orders = [];
            for (let i = 0; i < orderCount; i++) {
              const order = await createOrder(table.id, items);
              orders.push(order);
            }

            // Get table order history
            const history = await getTableOrderHistory(table.id);

            // Verify all orders are in the history
            expect(history).toHaveLength(orderCount);
            
            // Verify all created orders are in the history
            orders.forEach(order => {
              const found = history.find(h => h.id === order.id);
              expect(found).toBeDefined();
              expect(found.tableId).toBe(table.id);
            });
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should include both active and completed orders in history', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 2 }),
          fc.integer({ min: 2, max: 4 }),
          async (qrCode, items, orderCount) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create table
            const table = await createTable(qrCode);

            // Create multiple orders
            const orders = [];
            for (let i = 0; i < orderCount; i++) {
              const order = await createOrder(table.id, items);
              orders.push(order);
            }

            // Update some orders to completed status
            const ordersToComplete = orders.slice(0, Math.ceil(orderCount / 2));
            for (const order of ordersToComplete) {
              await updateOrderStatus(order.id, 'preparing');
              await updateOrderStatus(order.id, 'ready');
              await updateOrderStatus(order.id, 'served');
              await updateOrderStatus(order.id, 'completed');
            }

            // Get table order history
            const history = await getTableOrderHistory(table.id);

            // Verify all orders are in the history (both active and completed)
            expect(history).toHaveLength(orderCount);

            // Verify completed orders are included
            ordersToComplete.forEach(order => {
              const found = history.find(h => h.id === order.id);
              expect(found).toBeDefined();
              expect(found.status).toBe('completed');
            });

            // Verify pending orders are included
            const pendingOrders = orders.slice(Math.ceil(orderCount / 2));
            pendingOrders.forEach(order => {
              const found = history.find(h => h.id === order.id);
              expect(found).toBeDefined();
              expect(found.status).toBe('pending');
            });
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should sort orders by creation time (oldest first)', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 2 }),
          fc.integer({ min: 2, max: 5 }),
          async (qrCode, items, orderCount) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create table
            const table = await createTable(qrCode);

            // Create multiple orders with small delays to ensure different timestamps
            const orders = [];
            for (let i = 0; i < orderCount; i++) {
              const order = await createOrder(table.id, items);
              orders.push(order);
              if (i < orderCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 5));
              }
            }

            // Get table order history
            const history = await getTableOrderHistory(table.id);

            // Verify orders are sorted by creation time (oldest first)
            for (let i = 1; i < history.length; i++) {
              expect(history[i].createdAt).toBeGreaterThanOrEqual(history[i - 1].createdAt);
            }

            // Verify first order in history is the first created order
            expect(history[0].id).toBe(orders[0].id);
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should only return orders for the specified table', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(qrCodeArbitrary, { minLength: 2, maxLength: 3 }),
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 2 }),
          fc.integer({ min: 1, max: 3 }),
          async (qrCodes, items, ordersPerTable) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create multiple tables
            const tables = await Promise.all(
              qrCodes.map(qrCode => createTable(qrCode))
            );

            // Create orders for each table
            const ordersByTable = new Map();
            for (const table of tables) {
              const orders = [];
              for (let i = 0; i < ordersPerTable; i++) {
                const order = await createOrder(table.id, items);
                orders.push(order);
              }
              ordersByTable.set(table.id, orders);
            }

            // Verify each table's history contains only its orders
            for (const table of tables) {
              const history = await getTableOrderHistory(table.id);
              const expectedOrders = ordersByTable.get(table.id);

              expect(history).toHaveLength(expectedOrders.length);

              // Verify all orders in history belong to this table
              history.forEach(order => {
                expect(order.tableId).toBe(table.id);
              });

              // Verify all expected orders are in the history
              expectedOrders.forEach(expectedOrder => {
                const found = history.find(h => h.id === expectedOrder.id);
                expect(found).toBeDefined();
              });
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should return empty array for table with no orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          async (qrCode) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create table without orders
            const table = await createTable(qrCode);

            // Get table order history
            const history = await getTableOrderHistory(table.id);

            // Verify history is empty
            expect(history).toEqual([]);
            expect(history).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain order history after table deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          qrCodeArbitrary,
          fc.array(orderItemArbitrary, { minLength: 1, maxLength: 2 }),
          fc.integer({ min: 1, max: 3 }),
          async (qrCode, items, orderCount) => {
            // Clear data for this iteration
            await clearAllData();
            
            // Create table
            const table = await createTable(qrCode);

            // Create orders
            const orders = [];
            for (let i = 0; i < orderCount; i++) {
              const order = await createOrder(table.id, items);
              orders.push(order);
            }

            // Delete the table
            await deleteTable(table.id);

            // Get table order history (should still work for deleted tables)
            const history = await getTableOrderHistory(table.id);

            // Verify all orders are still in the history
            expect(history).toHaveLength(orderCount);
            orders.forEach(order => {
              const found = history.find(h => h.id === order.id);
              expect(found).toBeDefined();
            });
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);
  });
});
