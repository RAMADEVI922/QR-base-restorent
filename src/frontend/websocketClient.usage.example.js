/**
 * WebSocket Client Usage Examples
 * Demonstrates how to use the WebSocket client for real-time updates
 */

import websocketClient from './websocketClient.js';

// Example 1: Basic Connection
async function basicConnectionExample() {
  try {
    // Connect to WebSocket server
    await websocketClient.connect();
    console.log('Connected to WebSocket server');
    
    // Check connection state
    console.log('Is connected:', websocketClient.isConnected());
    console.log('Current state:', websocketClient.getState());
    
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

// Example 2: Listen for Order Updates
function orderUpdatesExample() {
  // Listen for new orders
  websocketClient.on('orderCreated', (data, timestamp) => {
    console.log('New order created:', data);
    console.log('Order ID:', data.orderId);
    console.log('Table ID:', data.tableId);
    console.log('Timestamp:', new Date(timestamp));
    
    // Update UI to show new order
    updateOrderQueue(data);
  });
  
  // Listen for order status changes
  websocketClient.on('orderStatusChanged', (data, timestamp) => {
    console.log('Order status changed:', data);
    console.log('Order ID:', data.orderId);
    console.log('New status:', data.status);
    
    // Update UI to reflect status change
    updateOrderStatus(data.orderId, data.status);
  });
}

// Example 3: Listen for Menu Updates
function menuUpdatesExample() {
  websocketClient.on('menuItemUpdated', (data, timestamp) => {
    console.log('Menu item updated:', data);
    console.log('Item ID:', data.itemId);
    console.log('Available:', data.available);
    
    // Update menu display
    updateMenuItem(data);
  });
}

// Example 4: Listen for Dashboard Metrics Updates
function metricsUpdatesExample() {
  websocketClient.on('metricsUpdated', (data, timestamp) => {
    console.log('Metrics updated:', data);
    console.log('Active tables:', data.activeTables);
    console.log('Pending orders:', data.pendingOrders);
    console.log('Total revenue:', data.totalRevenue);
    
    // Update dashboard display
    updateDashboardMetrics(data);
  });
}

// Example 5: Listen for Table Updates
function tableUpdatesExample() {
  websocketClient.on('tableUpdated', (data, timestamp) => {
    console.log('Table updated:', data);
    console.log('Table ID:', data.tableId);
    console.log('Status:', data.status);
    
    // Update tables page
    updateTableDisplay(data);
  });
}

// Example 6: Multiple Listeners for Same Event
function multipleListenersExample() {
  // First listener - update UI
  websocketClient.on('orderCreated', (data) => {
    updateOrderQueue(data);
  });
  
  // Second listener - play notification sound
  websocketClient.on('orderCreated', (data) => {
    playNotificationSound();
  });
  
  // Third listener - log analytics
  websocketClient.on('orderCreated', (data) => {
    logAnalyticsEvent('order_created', data);
  });
}

// Example 7: Removing Event Listeners
function removeListenerExample() {
  // Define listener function
  const orderListener = (data) => {
    console.log('Order created:', data);
  };
  
  // Register listener
  websocketClient.on('orderCreated', orderListener);
  
  // Later, remove listener when no longer needed
  websocketClient.off('orderCreated', orderListener);
}

// Example 8: Handling Connection States
function connectionStateExample() {
  // Check connection state before performing actions
  if (websocketClient.isConnected()) {
    console.log('WebSocket is connected');
  } else {
    console.log('WebSocket is not connected');
    console.log('Current state:', websocketClient.getState());
  }
  
  // States: 'disconnected', 'connecting', 'connected', 'reconnecting'
}

// Example 9: Graceful Disconnection
function disconnectExample() {
  // Disconnect when leaving page or no longer need updates
  websocketClient.disconnect();
  console.log('Disconnected from WebSocket server');
}

// Example 10: Complete Order Queue Page Integration
async function orderQueuePageIntegration() {
  try {
    // Connect to WebSocket
    await websocketClient.connect();
    
    // Listen for new orders
    websocketClient.on('orderCreated', (data) => {
      addOrderToQueue(data);
      showNotification(`New order from Table ${data.tableId}`);
    });
    
    // Listen for status changes
    websocketClient.on('orderStatusChanged', (data) => {
      updateOrderInQueue(data.orderId, data.status);
      
      if (data.status === 'ready') {
        highlightReadyOrder(data.orderId);
        playAlertSound();
      }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      websocketClient.disconnect();
    });
    
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    // Fall back to polling if WebSocket fails
    startPollingFallback();
  }
}

// Example 11: Dashboard Page Integration
async function dashboardPageIntegration() {
  try {
    await websocketClient.connect();
    
    // Listen for metrics updates
    websocketClient.on('metricsUpdated', (data) => {
      document.getElementById('active-tables').textContent = data.activeTables;
      document.getElementById('pending-orders').textContent = data.pendingOrders;
      document.getElementById('preparing-orders').textContent = data.preparingOrders;
      document.getElementById('ready-orders').textContent = data.readyOrders;
      document.getElementById('total-revenue').textContent = `$${(data.totalRevenue / 100).toFixed(2)}`;
    });
    
    // Listen for order updates to refresh metrics
    websocketClient.on('orderCreated', () => {
      // Metrics will be updated via metricsUpdated event
    });
    
    websocketClient.on('orderStatusChanged', () => {
      // Metrics will be updated via metricsUpdated event
    });
    
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
  }
}

// Example 12: Menu Page Integration (Customer View)
async function menuPageIntegration() {
  try {
    await websocketClient.connect();
    
    // Listen for menu item updates
    websocketClient.on('menuItemUpdated', (data) => {
      const menuItemElement = document.getElementById(`menu-item-${data.itemId}`);
      
      if (menuItemElement) {
        // Update availability
        if (data.available) {
          menuItemElement.classList.remove('unavailable');
          menuItemElement.querySelector('.add-button').disabled = false;
        } else {
          menuItemElement.classList.add('unavailable');
          menuItemElement.querySelector('.add-button').disabled = true;
        }
        
        // Update price if changed
        if (data.price !== undefined) {
          menuItemElement.querySelector('.price').textContent = `$${(data.price / 100).toFixed(2)}`;
        }
        
        // Update name/description if changed
        if (data.name) {
          menuItemElement.querySelector('.name').textContent = data.name;
        }
        if (data.description) {
          menuItemElement.querySelector('.description').textContent = data.description;
        }
      }
    });
    
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
  }
}

// Example 13: Custom Configuration
function customConfigurationExample() {
  // Create custom WebSocket client instance with specific configuration
  const customClient = new WebSocketClient({
    url: 'ws://custom-server:8080',
    maxReconnectAttempts: 5,
    initialReconnectDelay: 2000,
    maxReconnectDelay: 60000,
    reconnectDelayMultiplier: 1.5
  });
  
  customClient.connect();
}

// Example 14: Error Handling
async function errorHandlingExample() {
  try {
    await websocketClient.connect();
    
    // Listen for events with error handling
    websocketClient.on('orderCreated', (data) => {
      try {
        // Process order data
        processOrder(data);
      } catch (error) {
        console.error('Error processing order:', error);
        // Handle error gracefully
        showErrorMessage('Failed to process order');
      }
    });
    
  } catch (error) {
    console.error('Connection failed:', error);
    // Show user-friendly error message
    showErrorMessage('Unable to connect to real-time updates. Using manual refresh.');
    // Provide manual refresh button
    enableManualRefresh();
  }
}

// Helper functions (placeholders for actual implementation)
function updateOrderQueue(data) {
  console.log('Updating order queue with:', data);
}

function updateOrderStatus(orderId, status) {
  console.log(`Updating order ${orderId} to status ${status}`);
}

function updateMenuItem(data) {
  console.log('Updating menu item:', data);
}

function updateDashboardMetrics(data) {
  console.log('Updating dashboard metrics:', data);
}

function updateTableDisplay(data) {
  console.log('Updating table display:', data);
}

function playNotificationSound() {
  console.log('Playing notification sound');
}

function logAnalyticsEvent(eventName, data) {
  console.log(`Analytics: ${eventName}`, data);
}

function addOrderToQueue(data) {
  console.log('Adding order to queue:', data);
}

function showNotification(message) {
  console.log('Notification:', message);
}

function updateOrderInQueue(orderId, status) {
  console.log(`Updating order ${orderId} in queue to ${status}`);
}

function highlightReadyOrder(orderId) {
  console.log(`Highlighting ready order: ${orderId}`);
}

function playAlertSound() {
  console.log('Playing alert sound');
}

function startPollingFallback() {
  console.log('Starting polling fallback');
}

function processOrder(data) {
  console.log('Processing order:', data);
}

function showErrorMessage(message) {
  console.log('Error:', message);
}

function enableManualRefresh() {
  console.log('Enabling manual refresh');
}

// Export examples for documentation
export {
  basicConnectionExample,
  orderUpdatesExample,
  menuUpdatesExample,
  metricsUpdatesExample,
  tableUpdatesExample,
  multipleListenersExample,
  removeListenerExample,
  connectionStateExample,
  disconnectExample,
  orderQueuePageIntegration,
  dashboardPageIntegration,
  menuPageIntegration,
  customConfigurationExample,
  errorHandlingExample
};
