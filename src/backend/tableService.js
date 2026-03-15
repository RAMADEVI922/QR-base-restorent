/**
 * Table Service for managing table operations
 * Handles table creation, retrieval, updates, and soft deletion
 * 
 * Requirements: 1.1, 8.1, 8.2, 8.3
 */

import { v4 as uuidv4 } from 'uuid';
import { readTables, writeTables } from './persistenceManager.js';
import { TableStatus } from '../shared/types.js';

/**
 * Creates a new table with a unique ID
 * @param {string} qrCode - The QR code data (data URL) for the table
 * @returns {Promise<Object>} - The created table object
 * @throws {Error} - If table creation fails
 */
export async function createTable(qrCode) {
  if (!qrCode || typeof qrCode !== 'string') {
    throw new Error('QR code must be a non-empty string');
  }

  const table = {
    id: uuidv4(),
    qrCode,
    status: TableStatus.ACTIVE,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Read existing tables
  const tables = await readTables();

  // Add new table
  tables.push(table);

  // Write back to storage
  await writeTables(tables);

  return table;
}

/**
 * Retrieves a table by ID
 * @param {string} tableId - The ID of the table to retrieve
 * @returns {Promise<Object|null>} - The table object or null if not found
 * @throws {Error} - If retrieval fails
 */
export async function getTableById(tableId) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Table ID must be a non-empty string');
  }

  const tables = await readTables();
  const table = tables.find(t => t.id === tableId);

  return table || null;
}

/**
 * Retrieves all tables
 * @returns {Promise<Array>} - Array of all table objects
 * @throws {Error} - If retrieval fails
 */
export async function getAllTables() {
  return readTables();
}

/**
 * Retrieves all active tables
 * @returns {Promise<Array>} - Array of active table objects
 * @throws {Error} - If retrieval fails
 */
export async function getActiveTables() {
  const tables = await readTables();
  return tables.filter(t => t.status === TableStatus.ACTIVE);
}

/**
 * Updates a table's status
 * @param {string} tableId - The ID of the table to update
 * @param {string} status - The new status (must be a valid TableStatus)
 * @returns {Promise<Object>} - The updated table object
 * @throws {Error} - If table not found or update fails
 */
export async function updateTableStatus(tableId, status) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Table ID must be a non-empty string');
  }

  if (!Object.values(TableStatus).includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${Object.values(TableStatus).join(', ')}`);
  }

  const tables = await readTables();
  const tableIndex = tables.findIndex(t => t.id === tableId);

  if (tableIndex === -1) {
    throw new Error(`Table not found: ${tableId}`);
  }

  tables[tableIndex].status = status;
  tables[tableIndex].updatedAt = Date.now();

  await writeTables(tables);

  return tables[tableIndex];
}

/**
 * Soft deletes a table by marking it as inactive
 * @param {string} tableId - The ID of the table to delete
 * @returns {Promise<Object>} - The updated table object
 * @throws {Error} - If table not found or deletion fails
 */
export async function deleteTable(tableId) {
  return updateTableStatus(tableId, TableStatus.INACTIVE);
}

/**
 * Validates that a table is active
 * @param {string} tableId - The ID of the table to validate
 * @returns {Promise<boolean>} - True if table exists and is active, false otherwise
 * @throws {Error} - If validation fails
 */
export async function isTableActive(tableId) {
  const table = await getTableById(tableId);
  return table !== null && table.status === TableStatus.ACTIVE;
}

/**
 * Retrieves all orders associated with a table (both active and completed)
 * @param {string} tableId - The ID of the table
 * @returns {Promise<Array>} - Array of all order objects for the table
 * @throws {Error} - If tableId is invalid
 * Requirements: 8.5
 */
export async function getTableOrderHistory(tableId) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Table ID must be a non-empty string');
  }

  // Import orderService to get orders by table
  const { getOrdersByTable } = await import('./orderService.js');
  
  // Get all orders for this table (includes all statuses)
  const orders = await getOrdersByTable(tableId);
  
  // Sort by creation time (oldest first)
  orders.sort((a, b) => a.createdAt - b.createdAt);
  
  return orders;
}
