/**
 * Order Queue Controller
 * Main controller that integrates queue display, status updates, and real-time updates
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 12.1, 12.2, 12.3
 */

import QueueDisplayController from './queueDisplayController.js';
import StatusUpdateController from './statusUpdateController.js';
import RealTimeQueueUpdatesHandler from './realTimeQueueUpdatesHandler.js';

export default class OrderQueueController {
  constructor() {
    this.queueDisplayController = new QueueDisplayController();
    this.statusUpdateController = new StatusUpdateController();
    this.realTimeUpdatesHandler = new RealTimeQueueUpdatesHandler();
    this.isInitialized = false;
    this.connectionStatusElement = null;
  }

  /**
   * Initialize the order queue controller
   */
  init() {
    if (this.isInitialized) {
      return;
    }

    // Initialize all sub-controllers
    this.queueDisplayController.init();
    this.statusUpdateController.init();
    this.realTimeUpdatesHandler.init();

    // Setup integration between controllers
    this.setupControllerIntegration();
    this.setupConnectionStatusIndicator();

    this.isInitialized = true;
    console.log('Order Queue Controller initialized');
  }

  /**
   * Setup integration between controllers
   */
  setupControllerIntegration() {
    // Handle status updates from StatusUpdateController
    this.statusUpdateController.onStatusUpdate((eventType, data) => {
      if (eventType === 'statusUpdated') {
        // Update the display with the new order status
        this.queueDisplayController.updateOrder(data);
      } else if (eventType === 'statusUpdateError') {
        console.error('Status update error:', data);
      }
    });

    // Handle real-time updates from RealTimeUpdatesHandler
    this.realTimeUpdatesHandler.onUpdate((eventType, data) => {
      switch (eventType) {
        case 'orderAdded':
          // New order arrived, add to display
          this.queueDisplayController.updateOrder(data);
          this.showNewOrderNotification(data);
          break;

        case 'orderUpdated':
          // Order status changed, update display
          this.queueDisplayController.updateOrder(data);
          break;

        case 'orderRemoved':
          // Order served/completed, remove from display
          this.queueDisplayController.removeOrder(data.id);
          break;

        case 'metricsUpdated':
          // Metrics updated (could be used for additional UI updates)
          console.log('Metrics updated:', data);
          break;
      }
    });

    // Handle connection status changes
    this.realTimeUpdatesHandler.onConnection((eventType, data) => {
      this.updateConnectionStatus(eventType, data);
    });
  }

  /**
   * Setup connection status indicator
   */
  setupConnectionStatusIndicator() {
    // Create connection status element if it doesn't exist
    const queuePage = document.getElementById('queue-page');
    if (queuePage && !document.getElementById('connection-status')) {
      const statusElement = document.createElement('div');
      statusElement.id = 'connection-status';
      statusElement.className = 'connection-status';
      statusElement.setAttribute('role', 'status');
      statusElement.setAttribute('aria-live', 'polite');
      
      // Insert after the page header
      const pageHeader = queuePage.querySelector('.page-header');
      if (pageHeader) {
        pageHeader.insertAdjacentElement('afterend', statusElement);
      }
      
      this.connectionStatusElement = statusElement;
    }
  }

  /**
   * Load and display the order queue
   */
  async loadQueue() {
    try {
      await this.queueDisplayController.fetchAndDisplayOrders();
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  }

  /**
   * Refresh the queue display
   */
  async refreshQueue() {
    await this.loadQueue();
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(eventType, data) {
    if (!this.connectionStatusElement) return;

    switch (eventType) {
      case 'connected':
        this.connectionStatusElement.innerHTML = `
          <div class="connection-indicator connected">
            <span class="status-icon" aria-hidden="true">●</span>
            <span class="status-text">Real-time updates active</span>
          </div>
        `;
        this.connectionStatusElement.className = 'connection-status connected';
        break;

      case 'disconnected':
        this.connectionStatusElement.innerHTML = `
          <div class="connection-indicator disconnected">
            <span class="status-icon" aria-hidden="true">●</span>
            <span class="status-text">Connection lost - attempting to reconnect...</span>
          </div>
        `;
        this.connectionStatusElement.className = 'connection-status disconnected';
        break;

      case 'error':
        this.connectionStatusElement.innerHTML = `
          <div class="connection-indicator error">
            <span class="status-icon" aria-hidden="true">⚠</span>
            <span class="status-text">Connection error</span>
            <button class="btn btn-small" onclick="orderQueueController.reconnect()">Retry</button>
          </div>
        `;
        this.connectionStatusElement.className = 'connection-status error';
        break;

      case 'maxReconnectAttemptsReached':
        this.connectionStatusElement.innerHTML = `
          <div class="connection-indicator error">
            <span class="status-icon" aria-hidden="true">⚠</span>
            <span class="status-text">Unable to connect to real-time updates</span>
            <button class="btn btn-small" onclick="orderQueueController.reconnect()">Retry</button>
          </div>
        `;
        this.connectionStatusElement.className = 'connection-status error';
        break;
    }
  }

  /**
   * Show notification for new orders
   */
  showNewOrderNotification(order) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'new-order-notification';
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon" aria-hidden="true">🔔</span>
        <span class="notification-text">New order #${order.id} from Table ${order.tableId}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()" aria-label="Close notification">×</button>
      </div>
    `;

    // Add to page
    const queuePage = document.getElementById('queue-page');
    if (queuePage) {
      queuePage.appendChild(notification);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    // Play notification sound if available
    this.playNotificationSound();
  }

  /**
   * Play notification sound for new orders
   */
  playNotificationSound() {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // 800 Hz tone
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // Silently fail if audio is not supported
      console.log('Audio notification not available');
    }
  }

  /**
   * Manually reconnect to real-time updates
   */
  reconnect() {
    this.realTimeUpdatesHandler.reconnect();
  }

  /**
   * Get current queue orders
   */
  getCurrentOrders() {
    return this.queueDisplayController.getOrders();
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return this.realTimeUpdatesHandler.getConnectionStatus();
  }

  /**
   * Check if controller is initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.realTimeUpdatesHandler) {
      this.realTimeUpdatesHandler.disconnect();
    }
    this.isInitialized = false;
  }
}