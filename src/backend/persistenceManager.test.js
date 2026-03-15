/**
 * Unit tests for persistence manager
 * Tests file read/write operations, error handling, file locking, and data validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readTables,
  readMenuItems,
  readOrders,
  writeTables,
  writeMenuItems,
  writeOrders,
  initializeStorage,
  getSystemState,
  clearAllData
} from './persistenceManager.js';
import { OrderStatus, TableStatus } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, '../../data-test');

// Helper to create test data
function createTestTable(overrides = {}) {
  return {
    id: 'table-1',
    qrCode: 'data:image/png;base64,test',
    status: TableStatus.ACTIVE,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  };
}

function createTestMenuItem(overrides = {}) {
  return {
    id: 'item-1',
    name: 'Burger',
    description: 'Delicious burger',
    price: 1000,
    available: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  };
}

function createTestOrderItem(overrides = {}) {
  return {
    menuItemId: 'item-1',
    quantity: 2,
    price: 1000,
    name: 'Burger',
    ...overrides
  };
}

function createTestOrder(overrides = {}) {
  return {
    id: 'order-1',
    tableId: 'table-1',
    items: [createTestOrderItem()],
    status: OrderStatus.PENDING,
    totalPrice: 2000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    previousOrderId: null,
    ...overrides
  };
}

describe('Persistence Manager', () => {
  beforeEach(async () => {
    // Initialize storage for tests
    await initializeStorage();
  });

  afterEach(async () => {
    // Clean up test data
    await clearAllData();
  });

  describe('Table Operations', () => {
    it('should write and read tables', async () => {
      const table = createTestTable();
      await writeTables([table]);
      const tables = await readTables();
      
      expect(tables).toHaveLength(1);
      expect(tables[0]).toEqual(table);
    });

    it('should handle multiple tables', async () => {
      const tables = [
        createTestTable({ id: 'table-1' }),
        createTestTable({ id: 'table-2' }),
        createTestTable({ id: 'table-3' })
      ];
      
      await writeTables(tables);
      const read = await readTables();
      
      expect(read).toHaveLength(3);
      expect(read.map(t => t.id)).toEqual(['table-1', 'table-2', 'table-3']);
    });

    it('should return empty array when no tables exist', async () => {
      const tables = await readTables();
      expect(tables).toEqual([]);
    });

    it('should reject invalid table data', async () => {
      const invalidTable = { id: 'table-1' }; // Missing required fields
      
      await expect(writeTables([invalidTable])).rejects.toThrow();
    });

    it('should reject non-array input', async () => {
      await expect(writeTables({ id: 'table-1' })).rejects.toThrow('must be an array');
    });

    it('should validate table status', async () => {
      const invalidTable = createTestTable({ status: 'invalid' });
      
      await expect(writeTables([invalidTable])).rejects.toThrow();
    });

    it('should validate table timestamps', async () => {
      const invalidTable = createTestTable({ createdAt: -1 });
      
      await expect(writeTables([invalidTable])).rejects.toThrow();
    });
  });

  describe('Menu Item Operations', () => {
    it('should write and read menu items', async () => {
      const item = createTestMenuItem();
      await writeMenuItems([item]);
      const items = await readMenuItems();
      
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(item);
    });

    it('should handle multiple menu items', async () => {
      const items = [
        createTestMenuItem({ id: 'item-1', name: 'Burger' }),
        createTestMenuItem({ id: 'item-2', name: 'Pizza' }),
        createTestMenuItem({ id: 'item-3', name: 'Salad' })
      ];
      
      await writeMenuItems(items);
      const read = await readMenuItems();
      
      expect(read).toHaveLength(3);
      expect(read.map(i => i.name)).toEqual(['Burger', 'Pizza', 'Salad']);
    });

    it('should return empty array when no items exist', async () => {
      const items = await readMenuItems();
      expect(items).toEqual([]);
    });

    it('should reject invalid menu item data', async () => {
      const invalidItem = { id: 'item-1' }; // Missing required fields
      
      await expect(writeMenuItems([invalidItem])).rejects.toThrow();
    });

    it('should validate menu item price', async () => {
      const invalidItem = createTestMenuItem({ price: -100 });
      
      await expect(writeMenuItems([invalidItem])).rejects.toThrow();
    });

    it('should validate menu item availability', async () => {
      const invalidItem = createTestMenuItem({ available: 'yes' });
      
      await expect(writeMenuItems([invalidItem])).rejects.toThrow();
    });
  });

  describe('Order Operations', () => {
    it('should write and read orders', async () => {
      const order = createTestOrder();
      await writeOrders([order]);
      const orders = await readOrders();
      
      expect(orders).toHaveLength(1);
      expect(orders[0]).toEqual(order);
    });

    it('should handle multiple orders', async () => {
      const orders = [
        createTestOrder({ id: 'order-1' }),
        createTestOrder({ id: 'order-2' }),
        createTestOrder({ id: 'order-3' })
      ];
      
      await writeOrders(orders);
      const read = await readOrders();
      
      expect(read).toHaveLength(3);
      expect(read.map(o => o.id)).toEqual(['order-1', 'order-2', 'order-3']);
    });

    it('should return empty array when no orders exist', async () => {
      const orders = await readOrders();
      expect(orders).toEqual([]);
    });

    it('should reject invalid order data', async () => {
      const invalidOrder = { id: 'order-1' }; // Missing required fields
      
      await expect(writeOrders([invalidOrder])).rejects.toThrow();
    });

    it('should validate order status', async () => {
      const invalidOrder = createTestOrder({ status: 'invalid' });
      
      await expect(writeOrders([invalidOrder])).rejects.toThrow();
    });

    it('should validate order items', async () => {
      const invalidOrder = createTestOrder({ items: [{ menuItemId: 'item-1' }] });
      
      await expect(writeOrders([invalidOrder])).rejects.toThrow();
    });

    it('should validate order total price', async () => {
      const invalidOrder = createTestOrder({ totalPrice: -100 });
      
      await expect(writeOrders([invalidOrder])).rejects.toThrow();
    });

    it('should allow null completedAt', async () => {
      const order = createTestOrder({ completedAt: null });
      await writeOrders([order]);
      const orders = await readOrders();
      
      expect(orders[0].completedAt).toBeNull();
    });

    it('should allow valid completedAt timestamp', async () => {
      const now = Date.now();
      const order = createTestOrder({ completedAt: now });
      await writeOrders([order]);
      const orders = await readOrders();
      
      expect(orders[0].completedAt).toBe(now);
    });

    it('should allow null previousOrderId', async () => {
      const order = createTestOrder({ previousOrderId: null });
      await writeOrders([order]);
      const orders = await readOrders();
      
      expect(orders[0].previousOrderId).toBeNull();
    });

    it('should allow valid previousOrderId', async () => {
      const order = createTestOrder({ previousOrderId: 'order-0' });
      await writeOrders([order]);
      const orders = await readOrders();
      
      expect(orders[0].previousOrderId).toBe('order-0');
    });
  });

  describe('System State', () => {
    it('should return complete system state', async () => {
      const table = createTestTable();
      const item = createTestMenuItem();
      const order = createTestOrder();
      
      await writeTables([table]);
      await writeMenuItems([item]);
      await writeOrders([order]);
      
      const state = await getSystemState();
      
      expect(state.tables).toHaveLength(1);
      expect(state.menuItems).toHaveLength(1);
      expect(state.orders).toHaveLength(1);
      expect(state.lastUpdated).toBeGreaterThan(0);
    });

    it('should return empty state when no data exists', async () => {
      const state = await getSystemState();
      
      expect(state.tables).toEqual([]);
      expect(state.menuItems).toEqual([]);
      expect(state.orders).toEqual([]);
      expect(state.lastUpdated).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    it('should skip invalid items during read', async () => {
      // Write valid data directly to file
      const validTable = createTestTable();
      const invalidTable = { id: 'invalid' }; // Missing required fields
      
      const dataDir = path.join(__dirname, '../../data');
      const filePath = path.join(dataDir, 'tables.json');
      
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify([validTable, invalidTable]), 'utf-8');
      
      const tables = await readTables();
      
      // Should only return the valid table
      expect(tables).toHaveLength(1);
      expect(tables[0]).toEqual(validTable);
    });

    it('should handle corrupted JSON gracefully', async () => {
      const dataDir = path.join(__dirname, '../../data');
      const filePath = path.join(dataDir, 'tables.json');
      
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(filePath, 'invalid json {', 'utf-8');
      
      await expect(readTables()).rejects.toThrow('Failed to parse JSON');
    });

    it('should handle non-array JSON gracefully', async () => {
      const dataDir = path.join(__dirname, '../../data');
      const filePath = path.join(dataDir, 'tables.json');
      
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify({ id: 'table-1' }), 'utf-8');
      
      await expect(readTables()).rejects.toThrow('expected array');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent writes safely', async () => {
      const tables1 = [createTestTable({ id: 'table-1' })];
      const tables2 = [createTestTable({ id: 'table-2' })];
      
      // Start both writes concurrently
      await Promise.all([
        writeTables(tables1),
        writeTables(tables2)
      ]);
      
      // One of them should have succeeded (last-write-wins)
      const tables = await readTables();
      expect(tables).toHaveLength(1);
    });

    it('should handle concurrent reads safely', async () => {
      const table = createTestTable();
      await writeTables([table]);
      
      const results = await Promise.all([
        readTables(),
        readTables(),
        readTables()
      ]);
      
      results.forEach(tables => {
        expect(tables).toHaveLength(1);
        expect(tables[0]).toEqual(table);
      });
    });
  });

  describe('Initialization', () => {
    it('should create data directory if it does not exist', async () => {
      const dataDir = path.join(__dirname, '../../data');
      
      // Clean up if exists
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true });
      }
      
      await initializeStorage();
      
      expect(fs.existsSync(dataDir)).toBe(true);
      expect(fs.existsSync(path.join(dataDir, 'tables.json'))).toBe(true);
      expect(fs.existsSync(path.join(dataDir, 'menuItems.json'))).toBe(true);
      expect(fs.existsSync(path.join(dataDir, 'orders.json'))).toBe(true);
    });

    it('should not overwrite existing files during initialization', async () => {
      const table = createTestTable();
      await writeTables([table]);
      
      await initializeStorage();
      
      const tables = await readTables();
      expect(tables).toHaveLength(1);
      expect(tables[0]).toEqual(table);
    });
  });

  describe('Clear Data', () => {
    it('should clear all data', async () => {
      const table = createTestTable();
      const item = createTestMenuItem();
      const order = createTestOrder();
      
      await writeTables([table]);
      await writeMenuItems([item]);
      await writeOrders([order]);
      
      await clearAllData();
      
      const tables = await readTables();
      const items = await readMenuItems();
      const orders = await readOrders();
      
      expect(tables).toEqual([]);
      expect(items).toEqual([]);
      expect(orders).toEqual([]);
    });
  });
});
