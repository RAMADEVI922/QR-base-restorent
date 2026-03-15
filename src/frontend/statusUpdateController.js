/**
 * Status Update Controller
 * Handles order status updates and API communication
 * 
 * Requirements: 4.3, 4.4, 5.2, 12.1, 12.2
 */

export default class StatusUpdateController {
  constructor() {
    this.isUpdating = false;
    this.updateCallbacks = [];
  }

  /**
   * Initialize the controller
   */
  init() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for status update buttons
   */
  setupEventListeners() {
    // Use event delegation to handle dynamically created buttons
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('status-btn')) {
        event.preventDefault();
        this.handleStatusUpdate(event.target);
      }
    });
  }

  /**
   * Handle status update button click
   * Requirements: 4.3, 4.4, 5.2, 12.1, 12.2
   */
  async handleStatusUpdate(button) {
    if (this.isUpdating) {
      return; // Prevent multiple simultaneous updates
    }

    const orderId = button.getAttribute('data-order-id');
    const newStatus = button.getAttribute('data-new-status');

    if (!orderId || !newStatus) {
      console.error('Missing order ID or status');
      return;
    }

    // Validate status transition
    if (!this.isValidStatusTransition(newStatus)) {
      this.showError('Invalid status transition');
      return;
    }

    try {
      this.isUpdating = true;
      this.setButtonLoading(button, true);

      const updatedOrder = await this.updateOrderStatus(orderId, newStatus);
      
      // Notify listeners about the successful update
      this.notifyUpdateCallbacks('statusUpdated', updatedOrder);
      
      // Show success feedback
      this.showSuccessFeedback(button, newStatus);

    } catch (error) {
      console.error('Error updating order status:', error);
      this.showError('Failed to update order status. Please try again.');
      
      // Notify listeners about the error
      this.notifyUpdateCallbacks('statusUpdateError', { orderId, newStatus, error });
      
    } finally {
      this.isUpdating = false;
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Update order status via API
   * Requirements: 4.3, 4.4, 5.2, 12.1, 12.2
   */
  async updateOrderStatus(orderId, newStatus) {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const updatedOrder = await response.json();
    return updatedOrder;
  }

  /**
   * Validate if status transition is allowed
   */
  isValidStatusTransition(newStatus) {
    const validStatuses = ['pending', 'preparing', 'ready', 'served', 'completed'];
    return validStatuses.includes(newStatus);
  }

  /**
   * Set button loading state
   */
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.dataset.originalText = button.textContent;
      button.innerHTML = `
        <span class="loading-spinner" aria-hidden="true"></span>
        Updating...
      `;
    } else {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  /**
   * Show success feedback
   */
  showSuccessFeedback(button, newStatus) {
    const originalText = button.textContent;
    const statusText = this.formatStatusText(newStatus);
    
    button.classList.add('success-feedback');
    button.innerHTML = `
      <span class="success-icon" aria-hidden="true">✓</span>
      ${statusText}
    `;

    // Reset after 2 seconds
    setTimeout(() => {
      button.classList.remove('success-feedback');
      button.textContent = originalText;
    }, 2000);
  }

  /**
   * Format status text for feedback
   */
  formatStatusText(status) {
    const statusMap = {
      'preparing': 'Started!',
      'ready': 'Ready!',
      'served': 'Served!',
      'completed': 'Completed!'
    };
    return statusMap[status] || 'Updated!';
  }

  /**
   * Show error message
   */
  showError(message) {
    // Create or update error notification
    let errorNotification = document.getElementById('status-error-notification');
    
    if (!errorNotification) {
      errorNotification = document.createElement('div');
      errorNotification.id = 'status-error-notification';
      errorNotification.className = 'error-notification';
      errorNotification.setAttribute('role', 'alert');
      errorNotification.setAttribute('aria-live', 'assertive');
      
      // Insert at top of queue page
      const queuePage = document.getElementById('queue-page');
      if (queuePage) {
        queuePage.insertBefore(errorNotification, queuePage.firstChild);
      }
    }

    errorNotification.innerHTML = `
      <div class="error-content">
        <span class="error-icon" aria-hidden="true">⚠</span>
        <span class="error-text">${this.escapeHtml(message)}</span>
        <button class="error-close" onclick="this.parentElement.parentElement.remove()" aria-label="Close error message">×</button>
      </div>
    `;

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorNotification && errorNotification.parentNode) {
        errorNotification.remove();
      }
    }, 5000);
  }

  /**
   * Add callback for status update events
   */
  onStatusUpdate(callback) {
    if (typeof callback === 'function') {
      this.updateCallbacks.push(callback);
    }
  }

  /**
   * Remove callback for status update events
   */
  offStatusUpdate(callback) {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks
   */
  notifyUpdateCallbacks(eventType, data) {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('Error in status update callback:', error);
      }
    });
  }

  /**
   * Batch update multiple orders (for efficiency)
   */
  async batchUpdateOrders(updates) {
    const results = [];
    
    for (const { orderId, newStatus } of updates) {
      try {
        const result = await this.updateOrderStatus(orderId, newStatus);
        results.push({ success: true, orderId, result });
      } catch (error) {
        results.push({ success: false, orderId, error });
      }
    }
    
    return results;
  }

  /**
   * Get current updating state
   */
  isCurrentlyUpdating() {
    return this.isUpdating;
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