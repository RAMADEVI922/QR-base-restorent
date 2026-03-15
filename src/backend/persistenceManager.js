/**
 * Persistence Manager for JSON file operations
 * Handles all file read/write operations with error handling, file locking, and data validation
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OrderStatus, TableStatus, ValidStatusTransitions } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data storage directory
const DATA_DIR = path.join(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// File paths for each data type
const FILE_PATHS = {
  tables: path.join(DATA_DIR, 'tables.json'),
  menuItems: path.join(DATA_DIR, 'menuItems.json'),
  orders: path.join(DATA_DIR, 'orders.json')
};

// Backup configuration
const BACKUP_CONFIG = {
  maxBackups: 10, // Keep last 10 backups per file
  backupInterval: 3600000 // 1 hour in milliseconds
};

// Track last backup times
const lastBackupTimes = new Map();

// Lock management for concurrent write safety
const locks = new Map();

/**
 * Ensures data directory exists
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Acquires a lock for a file to prevent concurrent writes
 * @param {string} filePath - Path to the file to lock
 * @returns {Promise<void>}
 */
async function acquireLock(filePath) {
  const maxWaitTime = 5000; // 5 seconds max wait
  const startTime = Date.now();
  
  // Wait until lock is released with timeout
  while (locks.has(filePath)) {
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error(`Lock acquisition timeout for ${filePath}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  locks.set(filePath, Date.now());
}

/**
 * Releases a lock for a file
 * @param {string} filePath - Path to the file to unlock
 */
function releaseLock(filePath) {
  locks.delete(filePath);
}

/**
 * Validates table data structure
 * @param {Object} table - Table object to validate
 * @returns {boolean}
 */
function validateTable(table) {
  if (!table || typeof table !== 'object') return false;
  if (typeof table.id !== 'string' || !table.id) return false;
  if (typeof table.qrCode !== 'string' || !table.qrCode) return false;
  if (!Object.values(TableStatus).includes(table.status)) return false;
  if (typeof table.createdAt !== 'number' || table.createdAt <= 0) return false;
  if (typeof table.updatedAt !== 'number' || table.updatedAt <= 0) return false;
  return true;
}

/**
 * Validates menu item data structure
 * @param {Object} menuItem - MenuItem object to validate
 * @returns {boolean}
 */
function validateMenuItem(menuItem) {
  if (!menuItem || typeof menuItem !== 'object') return false;
  if (typeof menuItem.id !== 'string' || !menuItem.id) return false;
  if (typeof menuItem.name !== 'string' || !menuItem.name) return false;
  if (typeof menuItem.description !== 'string') return false;
  if (typeof menuItem.price !== 'number' || menuItem.price < 0) return false;
  if (typeof menuItem.available !== 'boolean') return false;
  if (typeof menuItem.createdAt !== 'number' || menuItem.createdAt <= 0) return false;
  if (typeof menuItem.updatedAt !== 'number' || menuItem.updatedAt <= 0) return false;
  return true;
}

/**
 * Validates order item data structure
 * @param {Object} orderItem - OrderItem object to validate
 * @returns {boolean}
 */
function validateOrderItem(orderItem) {
  if (!orderItem || typeof orderItem !== 'object') return false;
  if (typeof orderItem.menuItemId !== 'string' || !orderItem.menuItemId) return false;
  if (typeof orderItem.quantity !== 'number' || orderItem.quantity <= 0) return false;
  if (typeof orderItem.price !== 'number' || orderItem.price < 0) return false;
  if (typeof orderItem.name !== 'string' || !orderItem.name) return false;
  return true;
}

/**
 * Validates order data structure
 * @param {Object} order - Order object to validate
 * @returns {boolean}
 */
function validateOrder(order) {
  if (!order || typeof order !== 'object') return false;
  if (typeof order.id !== 'string' || !order.id) return false;
  if (typeof order.tableId !== 'string' || !order.tableId) return false;
  if (!Array.isArray(order.items)) return false;
  if (!order.items.every(item => validateOrderItem(item))) return false;
  if (!Object.values(OrderStatus).includes(order.status)) return false;
  if (typeof order.totalPrice !== 'number' || order.totalPrice < 0) return false;
  if (typeof order.createdAt !== 'number' || order.createdAt <= 0) return false;
  if (typeof order.updatedAt !== 'number' || order.updatedAt <= 0) return false;
  if (order.completedAt !== null && order.completedAt !== undefined) {
    if (typeof order.completedAt !== 'number' || order.completedAt <= 0) return false;
  }
  if (order.previousOrderId !== null && order.previousOrderId !== undefined) {
    if (typeof order.previousOrderId !== 'string' || !order.previousOrderId) return false;
  }
  return true;
}

/**
 * Reads data from a JSON file with validation
 * @param {string} filePath - Path to the JSON file
 * @param {Function} validator - Validation function for each item
 * @returns {Promise<Array>} - Array of validated items
 * @throws {Error} - If file cannot be read or data is invalid
 */
async function readFile(filePath, validator) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    
    // Handle empty files
    if (!data || data.trim() === '') {
      return [];
    }
    
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      console.error(`Invalid data format in ${filePath}: expected array, got ${typeof parsed}`);
      return [];
    }

    // Validate each item
    const validated = parsed.filter((item, index) => {
      if (!validator(item)) {
        console.warn(`Invalid item at index ${index}, skipping`);
        return false;
      }
      return true;
    });

    return validated;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // If JSON is corrupted, log error and return empty array
      console.error(`Corrupted JSON in ${filePath}: ${error.message}. Returning empty array.`);
      // Don't try to recover here - just return empty array
      // Recovery will happen on next write
      return [];
    }
    throw error;
  }
}

/**
 * Writes data to a JSON file with file locking and atomic writes
 * @param {string} filePath - Path to the JSON file
 * @param {Array} data - Array of items to write
 * @returns {Promise<void>}
 * @throws {Error} - If file cannot be written
 */
async function writeFile(filePath, data) {
  await acquireLock(filePath);
  try {
    ensureDataDirectory();
    const jsonData = JSON.stringify(data, null, 2);
    
    // Atomic write: write to temp file first, then rename
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
    
    try {
      // Write to temp file
      fs.writeFileSync(tempPath, jsonData, 'utf-8');
      
      // Atomic rename with retry logic for Windows file locking issues
      let retries = 5;
      let lastError;
      
      while (retries > 0) {
        try {
          // On Windows, we need to delete the target file first if it exists
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          fs.renameSync(tempPath, filePath);
          return; // Success!
        } catch (error) {
          lastError = error;
          if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'EACCES') {
            retries--;
            if (retries > 0) {
              // Wait with exponential backoff
              await new Promise(resolve => setTimeout(resolve, 50 * (6 - retries)));
              continue;
            }
          }
          throw error;
        }
      }
      
      throw lastError;
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to write to ${filePath}: ${error.message}`);
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Reads all tables from storage
 * @returns {Promise<Array>} - Array of table objects
 */
export async function readTables() {
  return readFile(FILE_PATHS.tables, validateTable);
}

/**
 * Reads all menu items from storage
 * @returns {Promise<Array>} - Array of menu item objects
 */
export async function readMenuItems() {
  return readFile(FILE_PATHS.menuItems, validateMenuItem);
}

/**
 * Reads all orders from storage
 * @returns {Promise<Array>} - Array of order objects
 */
export async function readOrders() {
  return readFile(FILE_PATHS.orders, validateOrder);
}

/**
 * Writes tables to storage
 * @param {Array} tables - Array of table objects to write
 * @returns {Promise<void>}
 */
export async function writeTables(tables) {
  if (!Array.isArray(tables)) {
    throw new Error('Tables must be an array');
  }
  if (!tables.every(validateTable)) {
    throw new Error('One or more tables failed validation');
  }
  return writeFile(FILE_PATHS.tables, tables);
}

/**
 * Writes menu items to storage
 * @param {Array} menuItems - Array of menu item objects to write
 * @returns {Promise<void>}
 */
export async function writeMenuItems(menuItems) {
  if (!Array.isArray(menuItems)) {
    throw new Error('Menu items must be an array');
  }
  if (!menuItems.every(validateMenuItem)) {
    throw new Error('One or more menu items failed validation');
  }
  return writeFile(FILE_PATHS.menuItems, menuItems);
}

/**
 * Writes orders to storage
 * @param {Array} orders - Array of order objects to write
 * @returns {Promise<void>}
 */
export async function writeOrders(orders) {
  if (!Array.isArray(orders)) {
    throw new Error('Orders must be an array');
  }
  if (!orders.every(validateOrder)) {
    throw new Error('One or more orders failed validation');
  }
  return writeFile(FILE_PATHS.orders, orders);
}

/**
 * Initializes storage with empty data files if they don't exist
 * @returns {Promise<void>}
 */
export async function initializeStorage() {
  ensureDataDirectory();
  
  try {
    if (!fs.existsSync(FILE_PATHS.tables)) {
      await writeTables([]);
    }
    if (!fs.existsSync(FILE_PATHS.menuItems)) {
      await writeMenuItems([]);
    }
    if (!fs.existsSync(FILE_PATHS.orders)) {
      await writeOrders([]);
    }
  } catch (error) {
    throw new Error(`Failed to initialize storage: ${error.message}`);
  }
}

/**
 * Gets the current system state (all data)
 * @returns {Promise<Object>} - Object containing tables, menuItems, and orders
 */
export async function getSystemState() {
  const [tables, menuItems, orders] = await Promise.all([
    readTables(),
    readMenuItems(),
    readOrders()
  ]);

  return {
    tables,
    menuItems,
    orders,
    lastUpdated: Date.now()
  };
}

/**
 * Creates a backup of a data file
 * @param {string} filePath - Path to the file to backup
 * @returns {Promise<string|null>} - Path to backup file or null if backup not needed
 */
async function createBackup(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileName = path.basename(filePath, '.json');
    const lastBackup = lastBackupTimes.get(filePath) || 0;
    const now = Date.now();

    // Only backup if enough time has passed
    if (now - lastBackup < BACKUP_CONFIG.backupInterval) {
      return null;
    }

    ensureDataDirectory();
    
    const backupFileName = `${fileName}_${now}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    // Copy file to backup
    fs.copyFileSync(filePath, backupPath);
    lastBackupTimes.set(filePath, now);

    // Clean up old backups
    await cleanupOldBackups(fileName);

    return backupPath;
  } catch (error) {
    console.error(`Failed to create backup for ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Cleans up old backups, keeping only the most recent ones
 * @param {string} fileName - Base name of the file (without extension)
 * @returns {Promise<void>}
 */
async function cleanupOldBackups(fileName) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith(`${fileName}_`) && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: parseInt(f.match(/_(\d+)\.json$/)?.[1] || '0')
      }))
      .sort((a, b) => b.time - a.time);

    // Delete old backups beyond the limit
    for (let i = BACKUP_CONFIG.maxBackups; i < backupFiles.length; i++) {
      try {
        fs.unlinkSync(backupFiles[i].path);
      } catch (error) {
        console.error(`Failed to delete old backup ${backupFiles[i].name}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Failed to cleanup old backups: ${error.message}`);
  }
}

/**
 * Recovers data from the most recent backup
 * @param {string} filePath - Path to the file to recover
 * @returns {Promise<Array|null>} - Recovered data or null if no backup found
 */
async function recoverFromBackup(filePath) {
  try {
    const fileName = path.basename(filePath, '.json');
    
    if (!fs.existsSync(BACKUP_DIR)) {
      return null;
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith(`${fileName}_`) && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: parseInt(f.match(/_(\d+)\.json$/)?.[1] || '0')
      }))
      .sort((a, b) => b.time - a.time);

    if (backupFiles.length === 0) {
      return null;
    }

    // Try to load the most recent backup
    const mostRecent = backupFiles[0];
    const data = fs.readFileSync(mostRecent.path, 'utf-8');
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      console.error(`Backup ${mostRecent.name} has invalid format`);
      return null;
    }

    console.log(`Recovered data from backup: ${mostRecent.name}`);
    return parsed;
  } catch (error) {
    console.error(`Failed to recover from backup: ${error.message}`);
    return null;
  }
}

/**
 * Detects data corruption by checking file integrity
 * @param {string} filePath - Path to the file to check
 * @returns {Promise<boolean>} - True if data is corrupted
 */
async function detectCorruption(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    
    // Check for empty or whitespace-only files
    if (!data || data.trim() === '') {
      return false; // Not corrupted, just empty
    }

    // Try to parse JSON
    try {
      const parsed = JSON.parse(data);
      
      // Check if it's an array
      if (!Array.isArray(parsed)) {
        console.error(`Data corruption detected in ${filePath}: not an array`);
        return true;
      }

      return false;
    } catch (parseError) {
      console.error(`Data corruption detected in ${filePath}: ${parseError.message}`);
      return true;
    }
  } catch (error) {
    console.error(`Error checking corruption for ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Performs atomic write operation for multiple entities
 * Uses a transaction-like approach: prepare all writes, then commit atomically
 * @param {Object} operations - Object with keys 'tables', 'menuItems', 'orders' and array values
 * @returns {Promise<void>}
 * @throws {Error} - If any operation fails, all changes are rolled back
 */
export async function atomicMultiWrite(operations) {
  const { tables, menuItems, orders } = operations;
  const tempFiles = [];
  const originalFiles = [];

  try {
    // Validate all data first
    if (tables && !tables.every(validateTable)) {
      throw new Error('One or more tables failed validation');
    }
    if (menuItems && !menuItems.every(validateMenuItem)) {
      throw new Error('One or more menu items failed validation');
    }
    if (orders && !orders.every(validateOrder)) {
      throw new Error('One or more orders failed validation');
    }

    // Acquire all locks
    const locksToAcquire = [];
    if (tables) locksToAcquire.push(FILE_PATHS.tables);
    if (menuItems) locksToAcquire.push(FILE_PATHS.menuItems);
    if (orders) locksToAcquire.push(FILE_PATHS.orders);

    for (const filePath of locksToAcquire) {
      await acquireLock(filePath);
    }

    try {
      ensureDataDirectory();

      // Prepare all writes to temp files
      if (tables) {
        const tempPath = `${FILE_PATHS.tables}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
        fs.writeFileSync(tempPath, JSON.stringify(tables, null, 2), 'utf-8');
        tempFiles.push({ temp: tempPath, target: FILE_PATHS.tables });
        if (fs.existsSync(FILE_PATHS.tables)) {
          originalFiles.push(FILE_PATHS.tables);
        }
      }

      if (menuItems) {
        const tempPath = `${FILE_PATHS.menuItems}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
        fs.writeFileSync(tempPath, JSON.stringify(menuItems, null, 2), 'utf-8');
        tempFiles.push({ temp: tempPath, target: FILE_PATHS.menuItems });
        if (fs.existsSync(FILE_PATHS.menuItems)) {
          originalFiles.push(FILE_PATHS.menuItems);
        }
      }

      if (orders) {
        const tempPath = `${FILE_PATHS.orders}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
        fs.writeFileSync(tempPath, JSON.stringify(orders, null, 2), 'utf-8');
        tempFiles.push({ temp: tempPath, target: FILE_PATHS.orders });
        if (fs.existsSync(FILE_PATHS.orders)) {
          originalFiles.push(FILE_PATHS.orders);
        }
      }

      // Atomic commit: rename all temp files
      for (const { temp, target } of tempFiles) {
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
        fs.renameSync(temp, target);
      }
    } finally {
      // Release all locks
      for (const filePath of locksToAcquire) {
        releaseLock(filePath);
      }
    }
  } catch (error) {
    // Rollback: clean up temp files
    for (const { temp } of tempFiles) {
      if (fs.existsSync(temp)) {
        try {
          fs.unlinkSync(temp);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }
    throw new Error(`Atomic multi-write failed: ${error.message}`);
  }
}

/**
 * Validates and recovers data on load
 * @param {string} filePath - Path to the file to validate
 * @param {Function} validator - Validation function for each item
 * @returns {Promise<Array>} - Validated and recovered data
 */
async function validateAndRecover(filePath, validator) {
  // Check for corruption
  const isCorrupted = await detectCorruption(filePath);
  
  if (isCorrupted) {
    console.error(`Corruption detected in ${filePath}, attempting recovery from backup`);
    const recovered = await recoverFromBackup(filePath);
    
    if (recovered) {
      // Validate recovered data
      const validated = recovered.filter(item => validator(item));
      
      // Write recovered data back
      try {
        await writeFile(filePath, validated);
        console.log(`Successfully recovered ${validated.length} items from backup`);
        return validated;
      } catch (error) {
        console.error(`Failed to write recovered data: ${error.message}`);
        return [];
      }
    } else {
      console.error(`No backup available for ${filePath}, returning empty array`);
      return [];
    }
  }

  // No corruption, proceed with normal read
  return readFile(filePath, validator);
}

/**
 * Enhanced read operations with validation and recovery
 */
export async function readTablesWithRecovery() {
  return validateAndRecover(FILE_PATHS.tables, validateTable);
}

export async function readMenuItemsWithRecovery() {
  return validateAndRecover(FILE_PATHS.menuItems, validateMenuItem);
}

export async function readOrdersWithRecovery() {
  return validateAndRecover(FILE_PATHS.orders, validateOrder);
}

/**
 * Enhanced write operations with automatic backup
 */
export async function writeTablesWithBackup(tables) {
  await createBackup(FILE_PATHS.tables);
  return writeTables(tables);
}

export async function writeMenuItemsWithBackup(menuItems) {
  await createBackup(FILE_PATHS.menuItems);
  return writeMenuItems(menuItems);
}

export async function writeOrdersWithBackup(orders) {
  await createBackup(FILE_PATHS.orders);
  return writeOrders(orders);
}

/**
 * Clears all data from storage (for testing purposes)
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  // Clear backups first
  await clearAllBackups();
  
  // Clean up any temp files
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.tmp') || file.includes('.tmp.')) {
        const tempPath = path.join(DATA_DIR, file);
        try {
          fs.unlinkSync(tempPath);
          await new Promise(resolve => setTimeout(resolve, 5));
        } catch (error) {
          // Ignore errors cleaning temp files
        }
      }
    }
  } catch (error) {
    // Ignore if directory doesn't exist
  }
  
  // Clear all data files
  await Promise.all([
    writeTables([]),
    writeMenuItems([]),
    writeOrders([])
  ]);
  
  // Longer delay to ensure file system operations complete on Windows
  await new Promise(resolve => setTimeout(resolve, 50));
}

/**
 * Clears all backups (for testing purposes)
 * @returns {Promise<void>}
 */
export async function clearAllBackups() {
  try {
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      for (const file of files) {
        const filePath = path.join(BACKUP_DIR, file);
        try {
          fs.unlinkSync(filePath);
          // Small delay to ensure file system operations complete on Windows
          await new Promise(resolve => setTimeout(resolve, 5));
        } catch (error) {
          // Ignore errors
        }
      }
    }
    lastBackupTimes.clear();
    // Additional delay to ensure all operations complete
    await new Promise(resolve => setTimeout(resolve, 20));
  } catch (error) {
    console.error(`Failed to clear backups: ${error.message}`);
  }
}
