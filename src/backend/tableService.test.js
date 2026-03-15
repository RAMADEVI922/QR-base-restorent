/**
 * Tests for Table Service
 * Tests CRUD operations for table management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import { createOrder } from './orderService.js';

describe('Table Service', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearAllData();
  });

  describe('createTable', () => {
    it('should create a table with unique ID and active status', async () => {
      const qrCode = 'data:image/png;base64,test';
      const table = await createTable(qrCode);

      expect(table).toBeDefined();
      expect(table.id).toBeDefined();
      expect(typeof table.id).toBe('string');
      expect(table.qrCode).toBe(qrCode);
      expect(table.status).toBe(TableStatus.ACTIVE);
      expect(table.createdAt).toBeDefined();
      expect(table.updatedAt).toBeDefined();
    });

    it('should generate unique IDs for multiple tables', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      const table2 = await createTable('data:image/png;base64,test2');

      expect(table1.id).not.toBe(table2.id);
    });

    it('should throw error if QR code is empty', async () => {
      await expect(createTable('')).rejects.toThrow('QR code must be a non-empty string');
    });

    it('should throw error if QR code is not a string', async () => {
      await expect(createTable(null)).rejects.toThrow('QR code must be a non-empty string');
      await expect(createTable(undefined)).rejects.toThrow('QR code must be a non-empty string');
      await expect(createTable(123)).rejects.toThrow('QR code must be a non-empty string');
    });

    it('should persist table to storage', async () => {
      const qrCode = 'data:image/png;base64,test';
      const table = await createTable(qrCode);

      const retrieved = await getTableById(table.id);
      expect(retrieved).toEqual(table);
    });
  });

  describe('getTableById', () => {
    it('should retrieve a table by ID', async () => {
      const qrCode = 'data:image/png;base64,test';
      const created = await createTable(qrCode);

      const retrieved = await getTableById(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return null if table not found', async () => {
      const result = await getTableById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should throw error if table ID is empty', async () => {
      await expect(getTableById('')).rejects.toThrow('Table ID must be a non-empty string');
    });

    it('should throw error if table ID is not a string', async () => {
      await expect(getTableById(null)).rejects.toThrow('Table ID must be a non-empty string');
      await expect(getTableById(123)).rejects.toThrow('Table ID must be a non-empty string');
    });
  });

  describe('getAllTables', () => {
    it('should return empty array when no tables exist', async () => {
      const tables = await getAllTables();
      expect(tables).toEqual([]);
    });

    it('should return all tables including active and inactive', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      const table2 = await createTable('data:image/png;base64,test2');
      await deleteTable(table2.id);

      const tables = await getAllTables();
      expect(tables).toHaveLength(2);
      expect(tables.map(t => t.id)).toContain(table1.id);
      expect(tables.map(t => t.id)).toContain(table2.id);
    });

    it('should return tables in order they were created', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      const table2 = await createTable('data:image/png;base64,test2');
      const table3 = await createTable('data:image/png;base64,test3');

      const tables = await getAllTables();
      expect(tables).toHaveLength(3);
      expect(tables[0].id).toBe(table1.id);
      expect(tables[1].id).toBe(table2.id);
      expect(tables[2].id).toBe(table3.id);
    });
  });

  describe('getActiveTables', () => {
    it('should return only active tables', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      const table2 = await createTable('data:image/png;base64,test2');
      const table3 = await createTable('data:image/png;base64,test3');

      await deleteTable(table2.id);

      const activeTables = await getActiveTables();
      expect(activeTables).toHaveLength(2);
      expect(activeTables.map(t => t.id)).toContain(table1.id);
      expect(activeTables.map(t => t.id)).toContain(table3.id);
      expect(activeTables.map(t => t.id)).not.toContain(table2.id);
    });

    it('should return empty array when no active tables exist', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      await deleteTable(table1.id);

      const activeTables = await getActiveTables();
      expect(activeTables).toEqual([]);
    });
  });

  describe('updateTableStatus', () => {
    it('should update table status', async () => {
      const table = await createTable('data:image/png;base64,test');
      const updated = await updateTableStatus(table.id, TableStatus.INACTIVE);

      expect(updated.status).toBe(TableStatus.INACTIVE);
      expect(updated.updatedAt).toBeGreaterThan(table.updatedAt);
    });

    it('should persist status update to storage', async () => {
      const table = await createTable('data:image/png;base64,test');
      await updateTableStatus(table.id, TableStatus.INACTIVE);

      const retrieved = await getTableById(table.id);
      expect(retrieved.status).toBe(TableStatus.INACTIVE);
    });

    it('should throw error if table not found', async () => {
      await expect(updateTableStatus('non-existent-id', TableStatus.INACTIVE))
        .rejects.toThrow('Table not found');
    });

    it('should throw error if status is invalid', async () => {
      const table = await createTable('data:image/png;base64,test');
      await expect(updateTableStatus(table.id, 'invalid-status'))
        .rejects.toThrow('Invalid status');
    });

    it('should throw error if table ID is empty', async () => {
      await expect(updateTableStatus('', TableStatus.INACTIVE))
        .rejects.toThrow('Table ID must be a non-empty string');
    });

    it('should throw error if table ID is not a string', async () => {
      await expect(updateTableStatus(null, TableStatus.INACTIVE))
        .rejects.toThrow('Table ID must be a non-empty string');
    });
  });

  describe('deleteTable', () => {
    it('should mark table as inactive', async () => {
      const table = await createTable('data:image/png;base64,test');
      const deleted = await deleteTable(table.id);

      expect(deleted.status).toBe(TableStatus.INACTIVE);
    });

    it('should persist deletion to storage', async () => {
      const table = await createTable('data:image/png;base64,test');
      await deleteTable(table.id);

      const retrieved = await getTableById(table.id);
      expect(retrieved.status).toBe(TableStatus.INACTIVE);
    });

    it('should throw error if table not found', async () => {
      await expect(deleteTable('non-existent-id'))
        .rejects.toThrow('Table not found');
    });

    it('should allow deleting already inactive table', async () => {
      const table = await createTable('data:image/png;base64,test');
      await deleteTable(table.id);
      const deleted = await deleteTable(table.id);

      expect(deleted.status).toBe(TableStatus.INACTIVE);
    });
  });

  describe('isTableActive', () => {
    it('should return true for active table', async () => {
      const table = await createTable('data:image/png;base64,test');
      const isActive = await isTableActive(table.id);

      expect(isActive).toBe(true);
    });

    it('should return false for inactive table', async () => {
      const table = await createTable('data:image/png;base64,test');
      await deleteTable(table.id);

      const isActive = await isTableActive(table.id);
      expect(isActive).toBe(false);
    });

    it('should return false for non-existent table', async () => {
      const isActive = await isTableActive('non-existent-id');
      expect(isActive).toBe(false);
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle multiple concurrent operations', async () => {
      const tables = await Promise.all([
        createTable('data:image/png;base64,test1'),
        createTable('data:image/png;base64,test2'),
        createTable('data:image/png;base64,test3')
      ]);

      expect(tables).toHaveLength(3);
      expect(new Set(tables.map(t => t.id)).size).toBe(3);
    });

    it('should maintain data consistency across operations', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      const table2 = await createTable('data:image/png;base64,test2');

      await updateTableStatus(table1.id, TableStatus.INACTIVE);

      const all = await getAllTables();
      const active = await getActiveTables();

      expect(all).toHaveLength(2);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(table2.id);
    });

    it('should preserve QR code data through updates', async () => {
      const qrCode = 'data:image/png;base64,test-qr-code';
      const table = await createTable(qrCode);

      await updateTableStatus(table.id, TableStatus.INACTIVE);

      const retrieved = await getTableById(table.id);
      expect(retrieved.qrCode).toBe(qrCode);
    });
  });

  describe('getTableOrderHistory', () => {
    it('should retrieve all orders for a table', async () => {
      const table = await createTable('data:image/png;base64,test');
      
      // Create multiple orders for the table
      const order1 = await createOrder(table.id, [
        { menuItemId: 'item1', name: 'Item 1', quantity: 1, price: 1000 }
      ]);
      const order2 = await createOrder(table.id, [
        { menuItemId: 'item2', name: 'Item 2', quantity: 2, price: 500 }
      ]);
      const order3 = await createOrder(table.id, [
        { menuItemId: 'item3', name: 'Item 3', quantity: 1, price: 1500 }
      ]);

      const history = await getTableOrderHistory(table.id);

      expect(history).toHaveLength(3);
      expect(history.map(o => o.id)).toContain(order1.id);
      expect(history.map(o => o.id)).toContain(order2.id);
      expect(history.map(o => o.id)).toContain(order3.id);
    });

    it('should return empty array for table with no orders', async () => {
      const table = await createTable('data:image/png;base64,test');
      const history = await getTableOrderHistory(table.id);

      expect(history).toEqual([]);
    });

    it('should include both active and completed orders', async () => {
      const table = await createTable('data:image/png;base64,test');
      
      // Create orders with different statuses
      const order1 = await createOrder(table.id, [
        { menuItemId: 'item1', name: 'Item 1', quantity: 1, price: 1000 }
      ]);
      const order2 = await createOrder(table.id, [
        { menuItemId: 'item2', name: 'Item 2', quantity: 1, price: 500 }
      ]);

      // Update order statuses
      const { updateOrderStatus } = await import('./orderService.js');
      await updateOrderStatus(order1.id, 'preparing');
      await updateOrderStatus(order1.id, 'ready');
      await updateOrderStatus(order1.id, 'served');
      await updateOrderStatus(order1.id, 'completed');

      const history = await getTableOrderHistory(table.id);

      expect(history).toHaveLength(2);
      expect(history.find(o => o.id === order1.id).status).toBe('completed');
      expect(history.find(o => o.id === order2.id).status).toBe('pending');
    });

    it('should sort orders by creation time (oldest first)', async () => {
      const table = await createTable('data:image/png;base64,test');
      
      // Create orders with slight delays to ensure different timestamps
      const order1 = await createOrder(table.id, [
        { menuItemId: 'item1', name: 'Item 1', quantity: 1, price: 1000 }
      ]);
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const order2 = await createOrder(table.id, [
        { menuItemId: 'item2', name: 'Item 2', quantity: 1, price: 500 }
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const order3 = await createOrder(table.id, [
        { menuItemId: 'item3', name: 'Item 3', quantity: 1, price: 1500 }
      ]);

      const history = await getTableOrderHistory(table.id);

      expect(history).toHaveLength(3);
      expect(history[0].id).toBe(order1.id);
      expect(history[1].id).toBe(order2.id);
      expect(history[2].id).toBe(order3.id);
      expect(history[0].createdAt).toBeLessThan(history[1].createdAt);
      expect(history[1].createdAt).toBeLessThan(history[2].createdAt);
    });

    it('should only return orders for the specified table', async () => {
      const table1 = await createTable('data:image/png;base64,test1');
      const table2 = await createTable('data:image/png;base64,test2');
      
      // Create orders for both tables
      const order1 = await createOrder(table1.id, [
        { menuItemId: 'item1', name: 'Item 1', quantity: 1, price: 1000 }
      ]);
      const order2 = await createOrder(table2.id, [
        { menuItemId: 'item2', name: 'Item 2', quantity: 1, price: 500 }
      ]);
      const order3 = await createOrder(table1.id, [
        { menuItemId: 'item3', name: 'Item 3', quantity: 1, price: 1500 }
      ]);

      const history1 = await getTableOrderHistory(table1.id);
      const history2 = await getTableOrderHistory(table2.id);

      expect(history1).toHaveLength(2);
      expect(history1.map(o => o.id)).toContain(order1.id);
      expect(history1.map(o => o.id)).toContain(order3.id);
      expect(history1.map(o => o.id)).not.toContain(order2.id);

      expect(history2).toHaveLength(1);
      expect(history2[0].id).toBe(order2.id);
    });

    it('should throw error if table ID is empty', async () => {
      await expect(getTableOrderHistory('')).rejects.toThrow('Table ID must be a non-empty string');
    });

    it('should throw error if table ID is not a string', async () => {
      await expect(getTableOrderHistory(null)).rejects.toThrow('Table ID must be a non-empty string');
      await expect(getTableOrderHistory(undefined)).rejects.toThrow('Table ID must be a non-empty string');
      await expect(getTableOrderHistory(123)).rejects.toThrow('Table ID must be a non-empty string');
    });

    it('should return empty array for non-existent table', async () => {
      const history = await getTableOrderHistory('non-existent-table-id');
      expect(history).toEqual([]);
    });
  });
});
