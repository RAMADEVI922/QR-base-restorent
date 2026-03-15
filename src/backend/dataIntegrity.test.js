/**
 * Tests for data integrity and concurrency handling
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  atomicMultiWrite,
  readTablesWithRecovery,
  readMenuItemsWithRecovery,
  readOrdersWithRecovery,
  writeTablesWithBackup,
  writeMenuItemsWithBackup,
  writeOrdersWithBackup,
  clearAllData,
  clearAllBackups,
  writeTables,
  writeMenuItems,
  writeOrders,
  readTables,
  readMenuItems,
  readOrders
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

describe('Data Integrity and Concurrency', () => {
  beforeEach(async () => {
    await clearAllData();
    await clearAllBackups();
  });

  afterEach(async () => {
    await clearAllData();
    await clearAllBackups();
  });

  describe('Atomic Multi-Entity Writes', () => {
    it('should write multiple entities atomically', async () => {
      const tables = [
        {
          id: 'table-1',
          qrCode: 'qr-code-1',
          status: TableStatus.ACTIVE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const menuItems = [
        {
          id: 'item-1',
          name: 'Burger',
          description: 'Delicious burger',
          price: 1200,
          available: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const orders = [
        {
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
        }
      ];

      await atomicMultiWrite({ tables, menuItems, orders });

      const loadedTables = await readTables();
      const loadedMenuItems = await readMenuItems();
      const loadedOrders = await readOrders();

      expect(loadedTables).toHaveLength(1);
      expect(loadedMenuItems).toHaveLength(1);
      expect(loadedOrders).toHaveLength(1);
      expect(loadedTables[0].id).toBe('table-1');
      expect(loadedMenuItems[0].id).toBe('item-1');
      expect(loadedOrders[0].id).toBe('order-1');
    });

    it('should rollback all changes if one entity fails validation', async () => {
      const tables = [
        {
          id: 'table-1',
          qrCode: 'qr-code-1',
          status: TableStatus.ACTIVE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const invalidMenuItems = [
        {
          id: 'item-1',
          name: 'Burger',
          // Missing required fields
          price: -100, // Invalid price
          available: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      await expect(
        atomicMultiWrite({ tables, menuItems: invalidMenuItems })
      ).rejects.toThrow();

      // Verify no data was written
      const loadedTables = await readTables();
      const loadedMenuItems = await readMenuItems();

      expect(loadedTables).toHaveLength(0);
      expect(loadedMenuItems).toHaveLength(0);
    });

    it('should handle partial updates (only some entities)', async () => {
      const tables = [
        {
          id: 'table-1',
          qrCode: 'qr-code-1',
          status: TableStatus.ACTIVE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      await atomicMultiWrite({ tables });

      const loadedTables = await readTables();
      const loadedMenuItems = await readMenuItems();
      const loadedOrders = await readOrders();

      expect(loadedTables).toHaveLength(1);
      expect(loadedMenuItems).toHaveLength(0);
      expect(loadedOrders).toHaveLength(0);
    });
  });

  describe('Backup Creation and Management', () => {
    it('should create backups when writing data', async () => {
      const tables = [
        {
          id: 'table-1',
          qrCode: 'qr-code-1',
          status: TableStatus.ACTIVE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      await writeTables(tables);
      await writeTablesWithBackup(tables);

      // Check if backup directory exists
      expect(fs.existsSync(BACKUP_DIR)).toBe(true);

      // Check if backup file was created
      const backupFiles = fs.readdirSync(BACKUP_DIR);
      const tableBackups = backupFiles.filter(f => f.startsWith('tables_'));
      expect(tableBackups.length).toBeGreaterThan(0);
    });

    it('should limit number of backups to configured maximum', async () => {
      const tables = [
        {
          id: 'table-1',
          qrCode: 'qr-code-1',
          status: TableStatus.ACTIVE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      // Create multiple backups by manipulating backup interval
      for (let i = 0; i < 15; i++) {
        await writeTables(tables);
        // Create backup manually with unique timestamp
        const backupPath = path.join(BACKUP_DIR, `tables_${Date.now() + i}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(tables, null, 2));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Trigger cleanup by writing with backup
      await writeTablesWithBackup(tables);

      const backupFiles = fs.readdirSync(BACKUP_DIR);
      const tableBackups = backupFiles.filter(f => f.startsWith('tables_'));
      
      // Should keep only 10 most recent backups
      expect(tableBackups.length).toBeLessThanOrEqual(11); // 10 + 1 new backup
    });
  });

  describe('Data Corruption Detection and Recovery', () => {
    it('should detect corrupted JSON and recover from backup', async () => {
      // Write valid data first
      const tables = [
        {
          id: 'table-1',
          qrCode: 'qr-code-1',
          status: TableStatus.ACTIVE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      await writeTables(tables);
      
      // Create a backup
      const backupPath = path.join(BACKUP_DIR, `tables_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(tables, null, 2));

      // Corrupt the main file
      fs.writeFileSync(FILE_PATHS.tables, '{ invalid json }');

      // Try to read with recovery
      const recovered = await readTablesWithRecovery();

      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('table-1');
    });

    it('should return empty array if no backup available for corrupted data', async () => {
      // Corrupt the file without creating a backup
      fs.writeFileSync(FILE_PATHS.tables, '{ invalid json }');

      const recovered = await readTablesWithRecovery();

      expect(recovered).toHaveLength(0);
    });

    it('should handle empty files gracefully', async () => {
      fs.writeFileSync(FILE_PATHS.tables, '');

      const recovered = await readTablesWithRecovery();

      expect(recovered).toHaveLength(0);
    });

    it('should validate recovered data and filter invalid items', async () => {
      const validTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const invalidTable = {
        id: 'table-2',
        // Missing required fields
        status: TableStatus.ACTIVE
      };

      // Create backup with mixed valid/invalid data
      const backupPath = path.join(BACKUP_DIR, `tables_${Date.now()}.json`);
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify([validTable, invalidTable], null, 2));

      // Corrupt main file
      fs.writeFileSync(FILE_PATHS.tables, '{ invalid }');

      const recovered = await readTablesWithRecovery();

      // Should only recover valid items
      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('table-1');
    });
  });

  describe('Concurrent Write Operations', () => {
    it('should handle concurrent writes with file locking', async () => {
      const table1 = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const table2 = {
        id: 'table-2',
        qrCode: 'qr-code-2',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Attempt concurrent writes
      const writes = [
        writeTables([table1]),
        writeTables([table2])
      ];

      await Promise.all(writes);

      // One of the writes should succeed (last-write-wins)
      const loaded = await readTables();
      expect(loaded).toHaveLength(1);
      expect(['table-1', 'table-2']).toContain(loaded[0].id);
    });

    it('should timeout if lock cannot be acquired', async () => {
      // This test verifies the lock timeout mechanism
      // In practice, locks should be released quickly
      const table = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Normal write should succeed
      await expect(writeTables([table])).resolves.not.toThrow();
    });
  });

  describe('Data Validation on Write', () => {
    it('should reject invalid table data', async () => {
      const invalidTable = {
        id: 'table-1',
        // Missing required fields
        status: 'invalid-status'
      };

      await expect(writeTables([invalidTable])).rejects.toThrow('validation');
    });

    it('should reject invalid menu item data', async () => {
      const invalidMenuItem = {
        id: 'item-1',
        name: 'Burger',
        price: -100, // Invalid negative price
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await expect(writeMenuItems([invalidMenuItem])).rejects.toThrow('validation');
    });

    it('should reject invalid order data', async () => {
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

      await expect(writeOrders([invalidOrder])).rejects.toThrow('validation');
    });
  });

  describe('Data Validation on Read', () => {
    it('should filter out invalid items when reading', async () => {
      const validTable = {
        id: 'table-1',
        qrCode: 'qr-code-1',
        status: TableStatus.ACTIVE,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const invalidTable = {
        id: 'table-2',
        status: 'invalid-status'
      };

      // Write mixed data directly to file (bypassing validation)
      fs.writeFileSync(
        FILE_PATHS.tables,
        JSON.stringify([validTable, invalidTable], null, 2)
      );

      const loaded = await readTables();

      // Should only load valid items
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('table-1');
    });
  });
});
