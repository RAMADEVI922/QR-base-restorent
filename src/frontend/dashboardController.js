/**
 * Dashboard Controller
 * Handles fetching and displaying dashboard metrics with real-time updates
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

class DashboardController {
  constructor() {
    this.metrics = {
      activeTableCount: 0,
      orderCountsByStatus: {
        pending: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        completed: 0
      },
      totalRevenue: 0,
      timestamp: null
    };
    
    // DOM element references
    this.activeTablesElement = null;
    this.pendingOrdersElement = null;
    this.preparingOrdersElement = null;
    this.readyOrdersElement = null;
    this.servedOrdersElement = null;
    this.totalRevenueElement = null;
    
    this.websocket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  /**
   * Initialize the dashboard controller
   */
  init() {
    this.cacheElementReferences();
    
    if (!this.validateElements()) {
      console.error('Dashboard elements not found');
      return;
    }

    // Fetch initial metrics
    this.fetchAndDisplayMetrics();
    
    // Setup WebSocket for real-time updates
    this.setupWebSocketConnection();
  }

  /**
   * Cache references to DOM elements
   */
  cacheElementReferences() {
    this.activeTablesElement = document.getElementById('active-tables-count');
    this.pendingOrdersElement = document.getElementById('pending-orders-count');
    this.preparingOrdersElement = document.getElementById('preparing-orders-count');
    this.readyOrdersElement = document.getElementById('ready-orders-count');
    this.servedOrdersElement = document.getElementById('served-orders-count');
    this.totalRevenueElement = document.getElementById('total-revenue');
  }

  /**
   * Validate that all required DOM elements exist
   * @returns {boolean} True if all elements exist
   */
  validateElements() {
    return !!(
      this.activeTablesElement &&
      this.pendingOrdersElement &&
      this.preparingOrdersElement &&
      this.readyOrdersElement &&
      this.servedOrdersElement &&
      this.totalRevenueElement
    );
  }

  /**
   * Fetch metrics from API and display them
   * Requirements: 7.1, 7.2, 7.3
   */
  async fetchAndDisplayMetrics() {
    try {
      const metrics = await this.fetchMetrics();
      this.metrics = metrics;
      this.displayMetrics();
    } catch (error) {
      console.error('Error fetching and displaying metrics:', error);
      this.displayError('Failed to load dashboard metrics. Please try again.');
    }
  }

  /**
   * Fetch metrics from the API
   * Requirements: 7.1, 7.2, 7.3
   * @returns {Promise<Object>} Metrics data
   */
  async fetchMetrics() {
    const response = await fetch('/api/metrics');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Display metrics in the UI
   * Requirements: 7.1, 7.2, 7.3
   */
  displayMetrics() {
    // Display active table count (Requirement 7.1)
    this.activeTablesElement.textContent = this.metrics.activeTableCount.toString();
    
    // Display order counts by status (Requirement 7.2)
    this.pendingOrdersElement.textContent = this.metrics.orderCountsByStatus.pending.toString();
    this.preparingOrdersElement.textContent = this.metrics.orderCountsByStatus.preparing.toString();
    this.readyOrdersElement.textContent = this.metrics.orderCountsByStatus.ready.toString();
    this.servedOrdersElement.textContent = this.metrics.orderCountsByStatus.served.toString();
    
    // Display total revenue (Requirement 7.3)
    const formattedRevenue = (this.metrics.totalRevenue / 100).toFixed(2);
    this.totalRevenueElement.textContent = `$${formattedRevenue}`;
  }

  /**
   * Setup WebSocket connection for real-time updates
   * Requirements: 7.4
   */
  setupWebSocketConnection() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('Dashboard WebSocket connected');
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.websocket.onclose = () => {
        console.log('Dashboard WebSocket connection closed');
        this.handleReconnection();
      };

      this.websocket.onerror = (error) => {
        console.error('Dashboard WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
      this.handleReconnection();
    }
  }

  /**
   * Handle incoming WebSocket messages
   * Requirements: 7.4
   * @param {MessageEvent} event - WebSocket message event
   */
  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'metricsUpdate') {
        this.handleMetricsUpdate(data.data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle metrics update from WebSocket
   * Requirements: 7.4
   * @param {Object} updatedMetrics - Updated metrics data
   */
  handleMetricsUpdate(updatedMetrics) {
    this.metrics = updatedMetrics;
    this.displayMetrics();
  }

  /**
   * Handle WebSocket reconnection with exponential backoff
   */
  handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Please refresh the page.');
      this.displayError('Connection lost. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.setupWebSocketConnection();
    }, delay);
  }

  /**
   * Display error message
   * @param {string} message - Error message to display
   */
  displayError(message) {
    // Create or update error display
    let errorElement = document.getElementById('dashboard-error');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'dashboard-error';
      errorElement.className = 'dashboard-error';
      errorElement.setAttribute('role', 'alert');
      
      const dashboardPage = document.getElementById('dashboard-page');
      if (dashboardPage) {
        const header = dashboardPage.querySelector('.page-header');
        if (header && header.nextSibling) {
          dashboardPage.insertBefore(errorElement, header.nextSibling);
        } else {
          dashboardPage.appendChild(errorElement);
        }
      }
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }

  /**
   * Refresh metrics manually
   */
  async refresh() {
    await this.fetchAndDisplayMetrics();
  }

  /**
   * Cleanup resources when controller is destroyed
   */
  destroy() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

// Export for use in other modules
export default DashboardController;
