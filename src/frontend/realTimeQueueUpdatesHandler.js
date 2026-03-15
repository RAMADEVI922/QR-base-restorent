/**
 * Real-Time Queue Updates Handler
 * Handles WebSocket connections and real-time updates for the order queue
 * 
 * Requirements: 4.2, 5.3, 12.3
 */

export default class RealTimeQueueUpdatesHandler {
  constructor() {
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.updateCallbacks = [];
    this.connectionCallbacks = [];
  }

  /**
   * Initialize the WebSocket connection
   * Requirements: 4.2
   */
  init() {
    this.connect();
    this.setupVisibilityHandling();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      this.websocket = new WebSocket(wsUrl);
      this.setupWebSocketEventListeners();
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  setupWebSocketEventListeners() {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.notifyConnectionCallbacks('connected');
    };

    this.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnected = false;
      this.notifyConnectionCallbacks('disconnected');
      
      // Attempt to reconnect unless it was a clean close
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyConnectionCallbacks('error', error);
    };
  }

  /**
   * Handle incoming WebSocket messages
   * Requirements: 4.2, 5.3, 12.3
   */
  handleWebSocketMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'connected':
        console.log('WebSocket connection confirmed');
        break;

      case 'orderCreated':
        // New order arrived - Requirements: 4.2
        this.handleNewOrder(data);
        break;

      case 'orderStatusUpdate':
        // Order status changed - Requirements: 4.2, 5.3, 12.3
        this.handleOrderStatusUpdate(data);
        break;

      case 'metricsUpdate':
        // Dashboard metrics updated
        this.handleMetricsUpdate(data);
        break;

      case 'menuItemUpdate':
        // Menu item updated
        this.handleMenuItemUpdate(data);
        break;

      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }

  /**
   * Handle new order creation
   * Requirements: 4.2
   */
  handleNewOrder(order) {
    console.log('New order received:', order);
    
    // Only show orders that should be in the queue (pending or preparing)
    if (order.status === 'pending' || order.status === 'preparing') {
      this.notifyUpdateCallbacks('orderAdded', order);
    }
  }

  /**
   * Handle order status updates
   * Requirements: 4.2, 5.3, 12.3
   */
  handleOrderStatusUpdate(order) {
    console.log('Order status updated:', order);

    // If order is served or completed, remove from queue - Requirements: 5.3, 12.3
    if (order.status === 'served' || order.status === 'completed') {
      this.notifyUpdateCallbacks('orderRemoved', order);
    } else if (order.status === 'pending' || order.status === 'preparing' || order.status === 'ready') {
      // Update order in queue
      this.notifyUpdateCallbacks('orderUpdated', order);
    }
  }

  /**
   * Handle metrics updates
   */
  handleMetricsUpdate(metrics) {
    this.notifyUpdateCallbacks('metricsUpdated', metrics);
  }

  /**
   * Handle menu item updates
   */
  handleMenuItemUpdate(menuItem) {
    this.notifyUpdateCallbacks('menuItemUpdated', menuItem);
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyConnectionCallbacks('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Setup page visibility handling to manage connections
   */
  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, we can reduce activity
        console.log('Page hidden, WebSocket remains active');
      } else {
        // Page is visible, ensure connection is active
        if (!this.isConnected && this.websocket?.readyState !== WebSocket.CONNECTING) {
          console.log('Page visible, reconnecting WebSocket');
          this.connect();
        }
      }
    });
  }

  /**
   * Add callback for real-time updates
   */
  onUpdate(callback) {
    if (typeof callback === 'function') {
      this.updateCallbacks.push(callback);
    }
  }

  /**
   * Remove callback for real-time updates
   */
  offUpdate(callback) {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  /**
   * Add callback for connection events
   */
  onConnection(callback) {
    if (typeof callback === 'function') {
      this.connectionCallbacks.push(callback);
    }
  }

  /**
   * Remove callback for connection events
   */
  offConnection(callback) {
    const index = this.connectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.connectionCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify update callbacks
   */
  notifyUpdateCallbacks(eventType, data) {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('Error in real-time update callback:', error);
      }
    });
  }

  /**
   * Notify connection callbacks
   */
  notifyConnectionCallbacks(eventType, data = null) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      websocketState: this.websocket?.readyState
    };
  }

  /**
   * Manually trigger reconnection
   */
  reconnect() {
    if (this.websocket) {
      this.websocket.close();
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close(1000, 'Manual disconnect');
      this.websocket = null;
    }
    this.isConnected = false;
  }

  /**
   * Send message to server (if needed for future features)
   */
  sendMessage(type, data) {
    if (this.isConnected && this.websocket) {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      this.websocket.send(message);
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }
}