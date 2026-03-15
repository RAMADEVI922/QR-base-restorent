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

// File paths for each data type
const FILE_PATHS = {
  tables: path.join(DATA_DIR, 'tables.json'),
  menuItems: path.join(DATA_DIR, 'menuItems.json'),
  orders: path.join(DATA_DIR, 'orders.json')
};

// Lock management for concurrent write safety
const locks = new Map();

/**
 * Ensures data directory exists
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
      throw new Error(`Invalid data format: expected array, got ${typeof parsed}`);
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
 * Clears all data from storage (for testing purposes)
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  // Clean up any temp files first
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.tmp') || file.includes('.tmp.')) {
        const tempPath = path.join(DATA_DIR, file);
        try {
          fs.unlinkSync(tempPath);
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
  
  // Small delay to ensure file system operations complete
  await new Promise(resolve => setTimeout(resolve, 20));
}
