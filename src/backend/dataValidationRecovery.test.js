/**
 * Tests for data validation and recovery mechanisms
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readTablesWithRecovery,
  readMenuItemsWithRecovery,
  readOrdersWithRecovery,
  writeTables,
  writeMenuItems,
  writeOrders,
  clearAllData,
  clearAllBackups
} from './persistenceManager.js';
import { TableStatus, OrderStatus } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const FILE_PATHS = {
  tables: path.join(DATA_DIR, 'tables.json'),
  menuItems: path.join(DATA_DIR, 'menuItems.json'),
  orders: path.join(DATA_DIR, 'orders.json')
};

describe('Data Validation and Recovery', () => {
  beforeEach(async () => {
    await clearAllData();
    await clearAllBackups();
  });

  afterEach(async () => {
    await clearAllData();
    await clearAllBackups();
  });

  describe('Data Validation on Load - Tables', () => {
    it('should validate table structure on load', async () => {
      const validTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await writeTables([validTable]);
      const loaded = await readTablesWithRecovery();

      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject(validTable);
    });

    it('should reject tables with missing id', async () => {
      const invalidTable = {
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Write directly to bypass validation
      fs.writeFileSync(FILE_PATHS.tables, JSON.stringify([invalidTable], null, 2));

      const loaded = await readTablesWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject tables with invalid status', async () => {
      const invalidTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: 'INVALID_STATUS',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.tables, JSON.stringify([invalidTable], null, 2));

      const loaded = await readTablesWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject tables with invalid timestamps', async () => {
      const invalidTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: -1,
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.tables, JSON.stringify([invalidTable], null, 2));

      const loaded = await readTablesWithRecovery();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('Data Validation on Load - Menu Items', () => {
    it('should validate menu item structure on load', async () => {
      const validMenuItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious burger',
        price: 1200,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await writeMenuItems([validMenuItem]);
      const loaded = await readMenuItemsWithRecovery();

      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject(validMenuItem);
    });

    it('should reject menu items with negative price', async () => {
      const invalidMenuItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious burger',
        price: -100,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.menuItems, JSON.stringify([invalidMenuItem], null, 2));

      const loaded = await readMenuItemsWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject menu items with missing name', async () => {
      const invalidMenuItem = {
        id: 'item-1',
        description: 'Delicious burger',
        price: 1200,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.menuItems, JSON.stringify([invalidMenuItem], null, 2));

      const loaded = await readMenuItemsWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject menu items with non-boolean availability', async () => {
      const invalidMenuItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious burger',
        price: 1200,
        available: 'yes',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.menuItems, JSON.stringify([invalidMenuItem], null, 2));

      const loaded = await readMenuItemsWithRecovery();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('Data Validation on Load - Orders', () => {
    it('should validate order structure on load', async () => {
      const validOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1200,
            name: 'Burger'
          }
        ],
        status: OrderStatus.PENDING,
        totalPrice: 2400,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: null
      };

      await writeOrders([validOrder]);
      const loaded = await readOrdersWithRecovery();

      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toMatchObject(validOrder);
    });

    it('should reject orders with invalid status', async () => {
      const invalidOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1200,
            name: 'Burger'
          }
        ],
        status: 'INVALID_STATUS',
        totalPrice: 2400,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.orders, JSON.stringify([invalidOrder], null, 2));

      const loaded = await readOrdersWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject orders with negative total price', async () => {
      const invalidOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1200,
            name: 'Burger'
          }
        ],
        status: OrderStatus.PENDING,
        totalPrice: -100,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.orders, JSON.stringify([invalidOrder], null, 2));

      const loaded = await readOrdersWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject orders with invalid order items', async () => {
      const invalidOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: -1, // Invalid negative quantity
            price: 1200,
            name: 'Burger'
          }
        ],
        status: OrderStatus.PENDING,
        totalPrice: 2400,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.orders, JSON.stringify([invalidOrder], null, 2));

      const loaded = await readOrdersWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should reject orders with non-array items', async () => {
      const invalidOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: 'not-an-array',
        status: OrderStatus.PENDING,
        totalPrice: 2400,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.writeFileSync(FILE_PATHS.orders, JSON.stringify([invalidOrder], null, 2));

      const loaded = await readOrdersWithRecovery();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('Data Corruption Detection', () => {
    it('should detect malformed JSON in tables file', async () => {
      fs.writeFileSync(FILE_PATHS.tables, '{ "invalid": json }');

      const loaded = await readTablesWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should detect malformed JSON in menu items file', async () => {
      fs.writeFileSync(FILE_PATHS.menuItems, '[{ incomplete');

      const loaded = await readMenuItemsWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should detect malformed JSON in orders file', async () => {
      fs.writeFileSync(FILE_PATHS.orders, 'not json at all');

      const loaded = await readOrdersWithRecovery();
      expect(loaded).toHaveLength(0);
    });

    it('should detect non-array data structure', async () => {
      fs.writeFileSync(FILE_PATHS.tables, '{"tables": []}');

      const loaded = await readTablesWithRecovery();
      expect(loaded).toHaveLength(0);
    });
  });

  describe('Recovery from Backups', () => {
    it('should recover tables from backup after corruption', async () => {
      const validTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Write valid data
      await writeTables([validTable]);

      // Create backup
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(BACKUP_DIR, `tables_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify([validTable], null, 2));

      // Corrupt main file
      fs.writeFileSync(FILE_PATHS.tables, '{ corrupted }');

      // Recover
      const recovered = await readTablesWithRecovery();

      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('table-1');
    });

    it('should recover menu items from backup after corruption', async () => {
      const validMenuItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious burger',
        price: 1200,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await writeMenuItems([validMenuItem]);

      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(BACKUP_DIR, `menuItems_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify([validMenuItem], null, 2));

      fs.writeFileSync(FILE_PATHS.menuItems, '{ corrupted }');

      const recovered = await readMenuItemsWithRecovery();

      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('item-1');
    });

    it('should recover orders from backup after corruption', async () => {
      const validOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1200,
            name: 'Burger'
          }
        ],
        status: OrderStatus.PENDING,
        totalPrice: 2400,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: null
      };

      await writeOrders([validOrder]);

      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(BACKUP_DIR, `orders_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify([validOrder], null, 2));

      fs.writeFileSync(FILE_PATHS.orders, '{ corrupted }');

      const recovered = await readOrdersWithRecovery();

      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('order-1');
    });

    it('should use most recent backup when multiple backups exist', async () => {
      const oldTable = {
        id: 'table-old',
        qrCode: 'qr-old',
        status: TableStatus.ACTIVE,
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 10000
      };

      const newTable = {
        id: 'table-new',
        qrCode: 'qr-new',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.mkdirSync(BACKUP_DIR, { recursive: true });

      // Create old backup
      const oldBackupPath = path.join(BACKUP_DIR, `tables_${Date.now() - 5000}.json`);
      fs.writeFileSync(oldBackupPath, JSON.stringify([oldTable], null, 2));

      // Create new backup
      await new Promise(resolve => setTimeout(resolve, 10));
      const newBackupPath = path.join(BACKUP_DIR, `tables_${Date.now()}.json`);
      fs.writeFileSync(newBackupPath, JSON.stringify([newTable], null, 2));

      // Corrupt main file
      fs.writeFileSync(FILE_PATHS.tables, '{ corrupted }');

      // Recover
      const recovered = await readTablesWithRecovery();

      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('table-new');
    });

    it('should write recovered data back to main file', async () => {
      const validTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backupPath = path.join(BACKUP_DIR, `tables_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify([validTable], null, 2));

      fs.writeFileSync(FILE_PATHS.tables, '{ corrupted }');

      await readTablesWithRecovery();

      // Verify main file was restored
      const fileContent = fs.readFileSync(FILE_PATHS.tables, 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('table-1');
    });
  });

  describe('Mixed Valid and Invalid Data', () => {
    it('should filter out invalid tables and keep valid ones', async () => {
      const validTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const invalidTable = {
        id: 'table-2',
        status: 'INVALID'
      };

      fs.writeFileSync(
        FILE_PATHS.tables,
        JSON.stringify([validTable, invalidTable], null, 2)
      );

      const loaded = await readTablesWithRecovery();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('table-1');
    });

    it('should filter out invalid menu items and keep valid ones', async () => {
      const validItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious',
        price: 1200,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const invalidItem = {
        id: 'item-2',
        name: 'Pizza',
        price: -100
      };

      fs.writeFileSync(
        FILE_PATHS.menuItems,
        JSON.stringify([validItem, invalidItem], null, 2)
      );

      const loaded = await readMenuItemsWithRecovery();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('item-1');
    });

    it('should filter out invalid orders and keep valid ones', async () => {
      const validOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2,
            price: 1200,
            name: 'Burger'
          }
        ],
        status: OrderStatus.PENDING,
        totalPrice: 2400,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: null
      };

      const invalidOrder = {
        id: 'order-2',
        tableId: 'table-2',
        items: 'not-an-array',
        status: OrderStatus.PENDING
      };

      fs.writeFileSync(
        FILE_PATHS.orders,
        JSON.stringify([validOrder, invalidOrder], null, 2)
      );

      const loaded = await readOrdersWithRecovery();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('order-1');
    });
  });
});
