/**
 * WebSocket Client for real-time updates
 * Handles connection management, reconnection logic, and event listeners
 * 
 * Requirements: 4.2, 7.4, 9.5
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event listener registration for different event types
 * - Connection state management
 * - Proper error handling and logging
 * 
 * Event Types:
 * - orderCreated: New order submitted
 * - orderStatusChanged: Order status updated
 * - menuItemUpdated: Menu item details or availability changed
 * - metricsUpdated: Dashboard metrics changed
 * - tableUpdated: Table configuration changed
 */

class WebSocketClient {
  constructor(config = {}) {
    this.url = config.url || this.getDefaultWebSocketUrl();
    this.maxReconnectAttempts = config.maxReconnectAttempts || Infinity;
    this.initialReconnectDelay = config.initialReconnectDelay || 1000; // 1 second
    this.maxReconnectDelay = config.maxReconnectDelay || 30000; // 30 seconds
    this.reconnectDelayMultiplier = config.reconnectDelayMultiplier || 2;
    
    this.ws = null;
    this.state = 'disconnected'; // disconnected, connecting, connected, reconnecting
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.listeners = new Map(); // eventType -> Set of callback functions
    this.shouldReconnect = true;
  }

  /**
   * Get default WebSocket URL based on current location
   * @returns {string} WebSocket URL
   */
  getDefaultWebSocketUrl() {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}`;
    }
    return 'ws://localhost:3000';
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.state === 'connected' || this.state === 'connecting') {
        resolve();
        return;
      }

      this.state = 'connecting';
      this.shouldReconnect = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.clearReconnectTimeout();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.state = 'disconnected';
          this.ws = null;

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.state = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = 'disconnected';
    console.log('WebSocket disconnected');
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.maxReconnectAttempts !== Infinity && 
        this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.state = 'disconnected';
      return;
    }

    this.state = 'reconnecting';
    const delay = this.calculateReconnectDelay();
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Calculate reconnection delay with exponential backoff
   * @returns {number} Delay in milliseconds
   */
  calculateReconnectDelay() {
    const delay = this.initialReconnectDelay * 
                  Math.pow(this.reconnectDelayMultiplier, this.reconnectAttempts);
    return Math.min(delay, this.maxReconnectDelay);
  }

  /**
   * Clear reconnection timeout
   */
  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param {MessageEvent} event - WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      const { type, data, timestamp } = message;

      // Emit event to registered listeners
      this.emit(type, data, timestamp);

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Register event listener for specific event type
   * @param {string} eventType - Type of event to listen for
   * @param {Function} callback - Callback function to invoke when event occurs
   */
  on(eventType, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);
  }

  /**
   * Unregister event listener
   * @param {string} eventType - Type of event
   * @param {Function} callback - Callback function to remove
   */
  off(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      return;
    }

    this.listeners.get(eventType).delete(callback);

    // Clean up empty listener sets
    if (this.listeners.get(eventType).size === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Emit event to all registered listeners
   * @param {string} eventType - Type of event
   * @param {any} data - Event data
   * @param {number} timestamp - Event timestamp
   */
  emit(eventType, data, timestamp) {
    if (!this.listeners.has(eventType)) {
      return;
    }

    this.listeners.get(eventType).forEach((callback) => {
      try {
        callback(data, timestamp);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Get current connection state
   * @returns {string} Current state (disconnected, connecting, connected, reconnecting)
   */
  getState() {
    return this.state;
  }

  /**
   * Check if WebSocket is connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.state === 'connected';
  }

  /**
   * Send message to server (if needed for future features)
   * @param {string} type - Message type
   * @param {any} data - Message data
   */
  send(type, data) {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    this.ws.send(message);
  }
}

// Create and export default instance
const websocketClient = new WebSocketClient();

export default websocketClient;
export { WebSocketClient };
