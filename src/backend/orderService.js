/**
 * Order Service for managing order operations
 * Handles order creation, item management, total calculation, and retrieval
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from '../shared/types.js';
import { readOrders, writeOrders } from './persistenceManager.js';

/**
 * Creates a new order with unique ID and table association
 * @param {string} tableId - The table ID to associate with the order
 * @param {Array} items - Array of order items (optional, defaults to empty)
 * @returns {Promise<Object>} - The created order object
 * @throws {Error} - If tableId is invalid
 */
export async function createOrder(tableId, items = []) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Invalid tableId: must be a non-empty string');
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
    previousOrderId: null
  };

  // Persist the new order
  const orders = await readOrders();
  orders.push(order);
  await writeOrders(orders);

  return order;
}

/**
 * Adds an item to an order
 * @param {string} orderId - The order ID
 * @param {Object} item - The item to add (must have menuItemId, quantity, price, name)
 * @returns {Promise<Object>} - The updated order object
 * @throws {Error} - If order not found or item is invalid
 */
export async function addItemToOrder(orderId, item) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid orderId: must be a non-empty string');
  }

  if (!item || typeof item !== 'object') {
    throw new Error('Invalid item: must be an object');
  }

  if (!item.menuItemId || !item.name || typeof item.quantity !== 'number' || typeof item.price !== 'number') {
    throw new Error('Invalid item: must have menuItemId, name, quantity, and price');
  }

  if (item.quantity <= 0) {
    throw new Error('Invalid quantity: must be greater than 0');
  }

  if (item.price < 0) {
    throw new Error('Invalid price: must be non-negative');
  }

  const orders = await readOrders();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Add the item to the order
  order.items.push(item);
  order.totalPrice += item.price * item.quantity;
  order.updatedAt = Date.now();

  await writeOrders(orders);
  return order;
}

/**
 * Removes an item from an order by index
 * @param {string} orderId - The order ID
 * @param {number} itemIndex - The index of the item to remove
 * @returns {Promise<Object>} - The updated order object
 * @throws {Error} - If order not found or index is invalid
 */
export async function removeItemFromOrder(orderId, itemIndex) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid orderId: must be a non-empty string');
  }

  if (typeof itemIndex !== 'number' || itemIndex < 0) {
    throw new Error('Invalid itemIndex: must be a non-negative number');
  }

  const orders = await readOrders();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (itemIndex >= order.items.length) {
    throw new Error(`Invalid itemIndex: index out of bounds`);
  }

  // Remove the item and recalculate total
  const removedItem = order.items[itemIndex];
  order.items.splice(itemIndex, 1);
  order.totalPrice -= removedItem.price * removedItem.quantity;
  order.updatedAt = Date.now();

  await writeOrders(orders);
  return order;
}

/**
 * Calculates the total price of an order
 * @param {string} orderId - The order ID
 * @returns {Promise<number>} - The total price in cents
 * @throws {Error} - If order not found
 */
export async function calculateOrderTotal(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid orderId: must be a non-empty string');
  }

  const orders = await readOrders();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return order.totalPrice;
}

/**
 * Retrieves an order by ID
 * @param {string} orderId - The order ID
 * @returns {Promise<Object|null>} - The order object or null if not found
 */
export async function getOrderById(orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid orderId: must be a non-empty string');
  }

  const orders = await readOrders();
  return orders.find(o => o.id === orderId) || null;
}

/**
 * Retrieves all orders for a specific table
 * @param {string} tableId - The table ID
 * @returns {Promise<Array>} - Array of order objects for the table
 */
export async function getOrdersByTable(tableId) {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Invalid tableId: must be a non-empty string');
  }

  const orders = await readOrders();
  return orders.filter(o => o.tableId === tableId);
}

/**
 * Retrieves all orders
 * @returns {Promise<Array>} - Array of all order objects
 */
export async function getAllOrders() {
  return readOrders();
}

/**
 * Retrieves the total number of orders
 * @returns {Promise<number>} - The count of all orders
 */
export async function getOrderCount() {
  const orders = await readOrders();
  return orders.length;
}

/**
 * Updates the status of an order with validation
 * @param {string} orderId - The order ID
 * @param {string} newStatus - The new status to set
 * @returns {Promise<Object>} - The updated order object
 * @throws {Error} - If order not found, status is invalid, or transition is not allowed
 */
export async function updateOrderStatus(orderId, newStatus) {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Invalid orderId: must be a non-empty string');
  }

  if (!newStatus || typeof newStatus !== 'string') {
    throw new Error('Invalid status: must be a non-empty string');
  }

  // Validate that the new status is a valid order status
  const validStatuses = Object.values(OrderStatus);
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: must be one of ${validStatuses.join(', ')}`);
  }

  const orders = await readOrders();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Validate status transition
  const { ValidStatusTransitions } = await import('../shared/types.js');
  const allowedTransitions = ValidStatusTransitions[order.status] || [];
  
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition: cannot transition from ${order.status} to ${newStatus}`);
  }

  // Update status and timestamp
  order.status = newStatus;
  order.updatedAt = Date.now();

  // Set completedAt timestamp when order is completed
  if (newStatus === OrderStatus.COMPLETED) {
    order.completedAt = Date.now();
  }

  await writeOrders(orders);
  return order;
}

/**
 * Retrieves the order queue with active orders (pending or preparing)
 * Orders are sorted by submission time (oldest first) and include table identifier
 * @returns {Promise<Array>} - Array of active orders sorted by createdAt (ascending)
 * Requirements: 4.1, 4.5, 5.4
 */
export async function getOrderQueue() {
  const orders = await readOrders();
  
  // Filter orders with status "pending" or "preparing"
  const activeOrders = orders.filter(order => 
    order.status === OrderStatus.PENDING || order.status === OrderStatus.PREPARING
  );
  
  // Sort by submission time (createdAt), oldest first
  activeOrders.sort((a, b) => a.createdAt - b.createdAt);
  
  return activeOrders;
}
