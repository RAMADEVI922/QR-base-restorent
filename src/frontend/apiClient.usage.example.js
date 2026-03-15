/**
 * Usage examples for the API Client
 * This file demonstrates how to use the apiClient in your application
 */

import apiClient from './apiClient.js';

// Example 1: Fetching menu items (GET request)
async function fetchMenuItems() {
  try {
    const menuItems = await apiClient.get('/api/menu-items');
    console.log('Menu items:', menuItems);
    return menuItems;
  } catch (error) {
    console.error('Failed to fetch menu items:', error.message);
    // Error object includes: status, statusText, details, url
    if (error.status === 404) {
      console.log('Menu items not found');
    }
  }
}

// Example 2: Creating an order (POST request)
async function createOrder(orderData) {
  try {
    const order = await apiClient.post('/api/orders', {
      tableId: orderData.tableId,
      items: orderData.items,
      totalPrice: orderData.totalPrice
    });
    console.log('Order created:', order);
    return order;
  } catch (error) {
    console.error('Failed to create order:', error.message);
    if (error.status === 400) {
      console.log('Invalid order data:', error.details);
    }
  }
}

// Example 3: Updating order status (PUT request)
async function updateOrderStatus(orderId, newStatus) {
  try {
    const updatedOrder = await apiClient.put(`/api/orders/${orderId}/status`, {
      status: newStatus
    });
    console.log('Order status updated:', updatedOrder);
    return updatedOrder;
  } catch (error) {
    console.error('Failed to update order status:', error.message);
  }
}

// Example 4: Deleting a table (DELETE request)
async function deleteTable(tableId) {
  try {
    await apiClient.delete(`/api/tables/${tableId}`);
    console.log('Table deleted successfully');
  } catch (error) {
    console.error('Failed to delete table:', error.message);
  }
}

// Example 5: Handling network errors with automatic retry
async function fetchWithRetry() {
  try {
    // The client will automatically retry on network errors and 5xx errors
    // with exponential backoff (1s, 2s, 4s delays)
    const data = await apiClient.get('/api/metrics');
    console.log('Metrics:', data);
    return data;
  } catch (error) {
    // If all retries fail, the error is thrown
    console.error('Failed after retries:', error.message);
  }
}

// Example 6: Custom configuration
import { ApiClient } from './apiClient.js';

const customClient = new ApiClient({
  baseUrl: 'https://api.example.com',
  maxRetries: 5,
  initialRetryDelay: 500,
  maxRetryDelay: 5000
});

async function useCustomClient() {
  const data = await customClient.get('/endpoint');
  return data;
}

// Export examples for testing or demonstration
export {
  fetchMenuItems,
  createOrder,
  updateOrderStatus,
  deleteTable,
  fetchWithRetry,
  useCustomClient
};
