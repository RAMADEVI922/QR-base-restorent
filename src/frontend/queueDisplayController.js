/**
 * Queue Display Controller
 * Handles fetching and displaying active orders in the order queue
 * 
 * Requirements: 4.1, 4.5, 5.1, 5.4
 */

export default class QueueDisplayController {
  constructor() {
    this.orders = [];
    this.container = null;
    this.emptyStateElement = null;
  }

  /**
   * Initialize the controller
   */
  init() {
    this.container = document.getElementById('orders-queue');
    this.emptyStateElement = document.getElementById('queue-empty');
    
    if (!this.container) {
      console.error('Queue container element not found');
      return;
    }
  }

  /**
   * Fetch active orders from API and display them
   * Requirements: 4.1, 4.5
   */
  async fetchAndDisplayOrders() {
    try {
      const response = await fetch('/api/orders/queue');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const orders = await response.json();
      this.orders = orders;
      this.displayOrders();
      
      return orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      this.showError('Failed to load orders. Please try again.');
      throw error;
    }
  }

  /**
   * Display orders in the queue
   * Requirements: 4.1, 4.5, 5.1, 5.4
   */
  displayOrders() {
    if (!this.container) {
      console.error('Container not initialized');
      return;
    }

    // Clear existing content
    this.container.innerHTML = '';

    // Show empty state if no orders
    if (!this.orders || this.orders.length === 0) {
      this.showEmptyState();
      return;
    }

    // Hide empty state
    this.hideEmptyState();

    // Sort orders by submission time (oldest first) - Requirement 4.5
    const sortedOrders = [...this.orders].sort((a, b) => a.createdAt - b.createdAt);

    // Create order elements
    sortedOrders.forEach(order => {
      const orderElement = this.createOrderElement(order);
      this.container.appendChild(orderElement);
    });
  }

  /**
   * Create HTML element for a single order
   * Requirements: 5.1, 5.4
   */
  createOrderElement(order) {
    const orderElement = document.createElement('div');
    orderElement.className = `order-card ${order.status}`;
    orderElement.setAttribute('data-order-id', order.id);
    orderElement.setAttribute('role', 'article');
    orderElement.setAttribute('aria-labelledby', `order-${order.id}-title`);

    // Highlight ready orders - Requirement 5.1
    if (order.status === 'ready') {
      orderElement.classList.add('ready-highlight');
    }

    // Format creation time
    const createdTime = new Date(order.createdAt).toLocaleTimeString();

    // Create items HTML
    const itemsHtml = order.items.map(item => 
      `<div class="order-item" role="listitem">
        <span class="item-name">${this.escapeHtml(item.name)}</span>
        <span class="item-quantity">x${item.quantity}</span>
      </div>`
    ).join('');

    // Calculate total price
    const totalPrice = (order.totalPrice / 100).toFixed(2);

    orderElement.innerHTML = `
      <div class="order-header">
        <h3 id="order-${order.id}-title" class="order-id">Order #${this.escapeHtml(order.id)}</h3>
        <span class="order-status status-${order.status}" aria-label="Order status: ${order.status}">
          ${this.formatStatus(order.status)}
        </span>
      </div>
      
      <div class="order-info">
        <div class="order-table" aria-label="Table identifier">
          <strong>Table: ${this.escapeHtml(order.tableId)}</strong>
        </div>
        <div class="order-time" aria-label="Order time">
          <span>Ordered: ${createdTime}</span>
        </div>
      </div>
      
      <div class="order-items" role="list" aria-label="Order items">
        ${itemsHtml}
      </div>
      
      <div class="order-total" aria-label="Order total">
        <strong>Total: $${totalPrice}</strong>
      </div>
      
      <div class="order-controls" role="group" aria-label="Order actions">
        ${this.createStatusButtons(order)}
      </div>
    `;

    return orderElement;
  }

  /**
   * Create status update buttons based on current order status
   * Requirements: 4.3, 4.4, 5.2
   */
  createStatusButtons(order) {
    const buttons = [];

    switch (order.status) {
      case 'pending':
        buttons.push(`
          <button class="btn btn-primary status-btn" 
                  data-order-id="${order.id}" 
                  data-new-status="preparing"
                  aria-label="Start preparing order ${order.id}">
            Start Preparing
          </button>
        `);
        break;
        
      case 'preparing':
        buttons.push(`
          <button class="btn btn-success status-btn" 
                  data-order-id="${order.id}" 
                  data-new-status="ready"
                  aria-label="Mark order ${order.id} as ready">
            Mark Ready
          </button>
        `);
        break;
        
      case 'ready':
        buttons.push(`
          <button class="btn btn-info status-btn" 
                  data-order-id="${order.id}" 
                  data-new-status="served"
                  aria-label="Mark order ${order.id} as served">
            Mark Served
          </button>
        `);
        break;
        
      case 'served':
        buttons.push(`
          <button class="btn btn-secondary status-btn" 
                  data-order-id="${order.id}" 
                  data-new-status="completed"
                  aria-label="Mark order ${order.id} as completed">
            Mark Completed
          </button>
        `);
        break;
    }

    return buttons.join('');
  }

  /**
   * Format status for display
   */
  formatStatus(status) {
    const statusMap = {
      'pending': 'Pending',
      'preparing': 'Preparing',
      'ready': 'Ready',
      'served': 'Served',
      'completed': 'Completed'
    };
    return statusMap[status] || status;
  }

  /**
   * Show empty state when no orders
   */
  showEmptyState() {
    if (this.emptyStateElement) {
      this.emptyStateElement.classList.remove('hidden');
    }
  }

  /**
   * Hide empty state when orders exist
   */
  hideEmptyState() {
    if (this.emptyStateElement) {
      this.emptyStateElement.classList.add('hidden');
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-state" role="alert">
        <p class="error-message">${this.escapeHtml(message)}</p>
        <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  /**
   * Update a specific order in the display
   */
  updateOrder(updatedOrder) {
    // Update orders array
    const index = this.orders.findIndex(order => order.id === updatedOrder.id);
    if (index !== -1) {
      this.orders[index] = updatedOrder;
    } else {
      // Add new order if not found
      this.orders.push(updatedOrder);
    }

    // Re-display orders
    this.displayOrders();
  }

  /**
   * Remove an order from the display
   */
  removeOrder(orderId) {
    this.orders = this.orders.filter(order => order.id !== orderId);
    this.displayOrders();
  }

  /**
   * Get current orders
   */
  getOrders() {
    return [...this.orders];
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}