/**
 * Metrics Service for dashboard metrics calculations
 * Handles calculation of active tables, order counts by status, and revenue
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { readTables } from './persistenceManager.js';
import { readOrders } from './persistenceManager.js';
import { TableStatus, OrderStatus } from '../shared/types.js';

/**
 * Calculates the number of active tables
 * @returns {Promise<number>} - The count of active tables
 * Requirements: 7.1
 */
export async function calculateActiveTableCount() {
  const tables = await readTables();
  return tables.filter(table => table.status === TableStatus.ACTIVE).length;
}

/**
 * Calculates the count of orders for each status
 * @returns {Promise<Object>} - Object with counts for each order status
 * Requirements: 7.2
 */
export async function calculateOrderCountsByStatus() {
  const orders = await readOrders();
  
  const counts = {
    [OrderStatus.PENDING]: 0,
    [OrderStatus.PREPARING]: 0,
    [OrderStatus.READY]: 0,
    [OrderStatus.SERVED]: 0,
    [OrderStatus.COMPLETED]: 0
  };
  
  orders.forEach(order => {
    if (counts.hasOwnProperty(order.status)) {
      counts[order.status]++;
    }
  });
  
  return counts;
}

/**
 * Calculates the total revenue from completed orders
 * @returns {Promise<number>} - The total revenue in cents
 * Requirements: 7.3
 */
export async function calculateTotalRevenue() {
  const orders = await readOrders();
  
  return orders
    .filter(order => order.status === OrderStatus.COMPLETED)
    .reduce((total, order) => total + order.totalPrice, 0);
}
