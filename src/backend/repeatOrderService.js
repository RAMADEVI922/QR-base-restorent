/**
 * Repeat Order Service for managing repeat order functionality
 * Handles detection of returning customers and creation of linked orders
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from '../shared/types.js';
import { readOrders, writeOrders } from './persistenceManager.js';

/**
 * Detects if a customer has previously ordered at a table
 * Returns the most recent served order for the table
 * @param {string} tableId - The table ID to check
 * @returns {Promise<Object|null>} - The most recent served order or null if none exists
 * @throws {Error} - If tableId is invalid
 * Requirements: 6.1
 */
export async function detectPreviousOrder(tableId) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Invalid tableId: must be a non-empty string');
  }

  const orders = await readOrders();
  
  // Find all served orders for this table
  const servedOrders = orders.filter(order => 
    order.tableId === tableId && order.status === OrderStatus.SERVED
  );

  // Return the most recent served order (by createdAt)
  if (servedOrders.length === 0) {
    return null;
  }

  servedOrders.sort((a, b) => b.createdAt - a.createdAt);
  return servedOrders[0];
}

/**
 * Creates a repeat order linked to the same table and original order
 * @param {string} tableId - The table ID to associate with the order
 * @param {Array} items - Array of order items (optional, defaults to empty)
 * @param {string|null} previousOrderId - Reference to the original order (optional)
 * @returns {Promise<Object>} - The created repeat order object
 * @throws {Error} - If tableId is invalid
 * Requirements: 6.2, 6.3, 6.5
 */
export async function createRepeatOrder(tableId, items = [], previousOrderId = null) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Invalid tableId: must be a non-empty string');
  }

  if (previousOrderId !== null && typeof previousOrderId !== 'string') {
    throw new Error('Invalid previousOrderId: must be a string or null');
  }

  const now = Date.now();
  const orderId = uuidv4();

  // Calculate total price from items
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const order = {
    id: orderId,
    tableId,
    items,
    status: OrderStatus.PENDING,
    totalPrice,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    previousOrderId
  };

  // Persist the new order
  const orders = await readOrders();
  orders.push(order);
  await writeOrders(orders);

  return order;
}

/**
 * Creates a repeat order for a returning customer at a table
 * Automatically detects previous order and links the new order
 * @param {string} tableId - The table ID to associate with the order
 * @param {Array} items - Array of order items (optional, defaults to empty)
 * @returns {Promise<Object>} - The created repeat order object with previousOrderId set
 * @throws {Error} - If tableId is invalid
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
export async function createRepeatOrderForTable(tableId, items = []) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Invalid tableId: must be a non-empty string');
  }

  // Detect if there's a previous order for this table
  const previousOrder = await detectPreviousOrder(tableId);
  const previousOrderId = previousOrder ? previousOrder.id : null;

  // Create the repeat order with reference to previous order
  return createRepeatOrder(tableId, items, previousOrderId);
}

/**
 * Retrieves all orders in the chain starting from an original order
 * @param {string} orderId - The order ID to start from
 * @returns {Promise<Array>} - Array of orders in the chain (original + all repeat orders)
 * @throws {Error} - If orderId is invalid
 * Requirements: 6.5
 */
export async function getOrderChain(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid orderId: must be a non-empty string');
  }

  const orders = await readOrders();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Find the root order (the one with no previousOrderId)
  let rootOrder = order;
  while (rootOrder.previousOrderId) {
    const previous = orders.find(o => o.id === rootOrder.previousOrderId);
    if (!previous) break;
    rootOrder = previous;
  }

  // Collect all orders in the chain
  const chain = [rootOrder];
  let currentId = rootOrder.id;

  while (true) {
    const nextOrder = orders.find(o => o.previousOrderId === currentId);
    if (!nextOrder) break;
    chain.push(nextOrder);
    currentId = nextOrder.id;
  }

  return chain;
}
