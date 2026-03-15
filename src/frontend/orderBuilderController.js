/**
 * Order Builder Controller
 * Handles item selection, removal, and order total calculation
 * Requirements: 2.3, 2.4, 3.1
 */

class OrderBuilderController {
  constructor() {
    this.currentOrder = {
      items: [],
      tableId: null,
      totalPrice: 0
    };
    this.summaryItemsContainer = null;
    this.totalPriceElement = null;
    this.submitOrderButton = null;
  }

  /**
   * Initialize the order builder controller
   */
  init() {
    this.summaryItemsContainer = document.getElementById('summary-items');
    this.totalPriceElement = document.getElementById('total-price');
    this.submitOrderButton = document.getElementById('submit-order');
    
    if (!this.summaryItemsContainer || !this.totalPriceElement || !this.submitOrderButton) {
      console.error('Order builder elements not found');
      return;
    }

    this.setupEventListeners();
    this.updateOrderSummary();
  }

  /**
   * Setup event listeners for order interactions
   */
  setupEventListeners() {
    // Listen for menu item selection events
    document.addEventListener('menuItemSelected', (event) => {
      this.addItemToOrder(event.detail);
    });

    // Setup submit order button
    this.submitOrderButton.addEventListener('click', () => {
      this.handleSubmitOrder();
    });
  }

  /**
   * Set the current table context for the order
   * Requirements: 3.2
   * @param {string} tableId - The table ID from QR code scan
   */
  setTableContext(tableId) {
    this.currentOrder.tableId = tableId;
  }

  /**
   * Add an item to the current order
   * Requirements: 2.3
   * @param {Object} itemData - Item data from menu selection
   * @param {string} itemData.menuItemId - Menu item ID
   * @param {string} itemData.name - Menu item name
   * @param {number} itemData.price - Menu item price in cents
   * @param {number} itemData.quantity - Quantity to add (default: 1)
   */
  addItemToOrder(itemData) {
    const { menuItemId, name, price, quantity = 1 } = itemData;

    if (quantity <= 0) {
      console.warn('Cannot add item with zero or negative quantity');
      return;
    }

    // Find existing item in order
    const existingItemIndex = this.currentOrder.items.findIndex(
      item => item.menuItemId === menuItemId
    );

    if (existingItemIndex !== -1) {
      // Update existing item quantity
      this.currentOrder.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item to order
      this.currentOrder.items.push({
        menuItemId,
        name,
        price,
        quantity
      });
    }

    this.calculateOrderTotal();
    this.updateOrderSummary();
    this.dispatchOrderUpdateEvent();
  }

  /**
   * Remove an item from the current order
   * Requirements: 2.4
   * @param {string} menuItemId - Menu item ID to remove
   * @param {number} quantity - Quantity to remove (optional, removes all if not specified)
   */
  removeItemFromOrder(menuItemId, quantity = null) {
    const itemIndex = this.currentOrder.items.findIndex(
      item => item.menuItemId === menuItemId
    );

    if (itemIndex === -1) {
      console.warn(`Item ${menuItemId} not found in order`);
      return;
    }

    const item = this.currentOrder.items[itemIndex];

    if (quantity === null || quantity >= item.quantity) {
      // Remove entire item
      this.currentOrder.items.splice(itemIndex, 1);
    } else {
      // Reduce quantity
      item.quantity -= quantity;
    }

    this.calculateOrderTotal();
    this.updateOrderSummary();
    this.dispatchOrderUpdateEvent();
  }

  /**
   * Calculate the total price of the current order
   * Requirements: 3.1
   */
  calculateOrderTotal() {
    this.currentOrder.totalPrice = this.currentOrder.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  /**
   * Update the order summary display
   * Requirements: 3.1
   */
  updateOrderSummary() {
    if (!this.summaryItemsContainer || !this.totalPriceElement) {
      console.error('Order summary elements not initialized');
      return;
    }

    // Clear existing summary items
    this.summaryItemsContainer.innerHTML = '';

    if (this.currentOrder.items.length === 0) {
      this.displayEmptyOrderState();
      this.updateSubmitButtonState();
      return;
    }

    // Create summary items
    this.currentOrder.items.forEach(item => {
      const summaryItemElement = this.createSummaryItemElement(item);
      this.summaryItemsContainer.appendChild(summaryItemElement);
    });

    // Update total price display
    const formattedTotal = (this.currentOrder.totalPrice / 100).toFixed(2);
    this.totalPriceElement.textContent = formattedTotal;

    this.updateSubmitButtonState();
  }

  /**
   * Create a summary item element
   * @param {Object} item - Order item
   * @returns {HTMLElement} Summary item element
   */
  createSummaryItemElement(item) {
    const summaryItemDiv = document.createElement('div');
    summaryItemDiv.className = 'summary-item';
    summaryItemDiv.setAttribute('role', 'listitem');
    summaryItemDiv.setAttribute('data-menu-item-id', item.menuItemId);

    const itemTotal = item.price * item.quantity;
    const formattedItemTotal = (itemTotal / 100).toFixed(2);

    summaryItemDiv.innerHTML = `
      <div class="summary-item-info">
        <span class="summary-item-name">${this.escapeHtml(item.name)}</span>
        <span class="summary-item-quantity">x${item.quantity}</span>
      </div>
      <div class="summary-item-actions">
        <span class="summary-item-price">$${formattedItemTotal}</span>
        <button 
          class="btn btn-small btn-danger remove-item-btn" 
          aria-label="Remove ${this.escapeHtml(item.name)} from order"
          data-menu-item-id="${item.menuItemId}"
        >
          Remove
        </button>
      </div>
    `;

    // Add click handler for remove button
    const removeButton = summaryItemDiv.querySelector('.remove-item-btn');
    removeButton.addEventListener('click', () => {
      this.removeItemFromOrder(item.menuItemId);
    });

    return summaryItemDiv;
  }

  /**
   * Display empty order state
   */
  displayEmptyOrderState() {
    this.summaryItemsContainer.innerHTML = `
      <div class="empty-order-state" role="status">
        <p>No items in your order yet</p>
        <p class="empty-order-hint">Select items from the menu to add them to your order</p>
      </div>
    `;

    this.totalPriceElement.textContent = '0.00';
  }

  /**
   * Update submit button state based on order contents
   */
  updateSubmitButtonState() {
    if (!this.submitOrderButton) return;

    const hasItems = this.currentOrder.items.length > 0;
    this.submitOrderButton.disabled = !hasItems;
    
    if (hasItems) {
      this.submitOrderButton.textContent = 'Submit Order';
      this.submitOrderButton.setAttribute('aria-label', 'Submit your order');
    } else {
      this.submitOrderButton.textContent = 'Add items to order';
      this.submitOrderButton.setAttribute('aria-label', 'Add items to your order first');
    }
  }

  /**
   * Handle order submission
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  async handleSubmitOrder() {
    if (this.currentOrder.items.length === 0) {
      this.showError('Please add items to your order before submitting');
      return;
    }

    if (!this.currentOrder.tableId) {
      this.showError('Table information is missing. Please scan the QR code again.');
      return;
    }

    try {
      this.setSubmitButtonLoading(true);

      const orderData = {
        tableId: this.currentOrder.tableId,
        items: this.currentOrder.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          name: item.name
        }))
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to submit order: ${response.status} ${response.statusText}`);
      }

      const submittedOrder = await response.json();
      
      this.handleOrderSubmissionSuccess(submittedOrder);
      
    } catch (error) {
      console.error('Error submitting order:', error);
      this.showError('Failed to submit order. Please try again.');
    } finally {
      this.setSubmitButtonLoading(false);
    }
  }

  /**
   * Handle successful order submission
   * @param {Object} submittedOrder - The submitted order data
   */
  handleOrderSubmissionSuccess(submittedOrder) {
    // Show success message briefly
    this.showSuccess(`Order #${submittedOrder.id} submitted successfully!`);
    
    // Navigate to confirmation page with order details
    this.navigateToConfirmation(submittedOrder);
    
    // Dispatch order submitted event
    const event = new (window.CustomEvent || CustomEvent)('orderSubmitted', {
      detail: {
        order: submittedOrder
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Clear the current order
   */
  /**
   * Navigate to confirmation page with order details
   * @param {Object} submittedOrder - The submitted order data
   */
  navigateToConfirmation(submittedOrder) {
    // Get navigation controller instance
    const navigationController = window.navigationController;
    if (!navigationController) {
      console.error('Navigation controller not available');
      return;
    }

    // Navigate to confirmation page
    navigationController.navigateTo('confirmation', { 
      order: submittedOrder,
      originalOrder: { ...this.currentOrder } // Keep copy of original order for display
    });

    // Clear the current order after navigation
    this.clearOrder();

    // Populate confirmation page with order details
    this.populateConfirmationPage(submittedOrder);
  }

  /**
   * Populate confirmation page with order details
   * @param {Object} submittedOrder - The submitted order data
   */
  populateConfirmationPage(submittedOrder) {
    // Update order ID
    const orderIdElement = document.getElementById('confirmation-order-id');
    if (orderIdElement) {
      orderIdElement.textContent = `Order #${submittedOrder.id}`;
    }

    // Populate order items
    const itemsContainer = document.getElementById('confirmation-items');
    const totalElement = document.getElementById('confirmation-total-price');
    
    if (itemsContainer && submittedOrder.items) {
      itemsContainer.innerHTML = '';
      
      submittedOrder.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'confirmation-item';
        itemElement.innerHTML = `
          <span class="item-name">${this.escapeHtml(item.name)}</span>
          <span class="item-quantity">x${item.quantity}</span>
          <span class="item-price">$${(item.price * item.quantity / 100).toFixed(2)}</span>
        `;
        itemsContainer.appendChild(itemElement);
      });
    }

    // Update total price
    if (totalElement && submittedOrder.totalPrice) {
      totalElement.textContent = (submittedOrder.totalPrice / 100).toFixed(2);
    }

    // Set up confirmation page event listeners
    this.setupConfirmationEventListeners();
  }

  /**
   * Set up event listeners for confirmation page buttons
   */
  setupConfirmationEventListeners() {
    const placeAnotherOrderBtn = document.getElementById('place-another-order');
    const viewOrderStatusBtn = document.getElementById('view-order-status');

    if (placeAnotherOrderBtn) {
      placeAnotherOrderBtn.onclick = () => {
        const navigationController = window.navigationController;
        if (navigationController) {
          navigationController.navigateTo('menu');
        }
      };
    }

    if (viewOrderStatusBtn) {
      viewOrderStatusBtn.onclick = () => {
        const navigationController = window.navigationController;
        if (navigationController) {
          // For now, navigate to queue page - in a real app this might be a customer order status page
          navigationController.navigateTo('queue');
        }
      };
    }
  }

  clearOrder() {
    this.currentOrder = {
      items: [],
      tableId: this.currentOrder.tableId, // Keep table context
      totalPrice: 0
    };
    
    this.updateOrderSummary();
    this.dispatchOrderUpdateEvent();
  }

  /**
   * Set submit button loading state
   * @param {boolean} loading - Whether button is in loading state
   */
  setSubmitButtonLoading(loading) {
    if (!this.submitOrderButton) return;

    if (loading) {
      this.submitOrderButton.disabled = true;
      this.submitOrderButton.textContent = 'Submitting...';
      this.submitOrderButton.setAttribute('aria-label', 'Submitting your order');
    } else {
      this.updateSubmitButtonState();
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    // Create or update error display
    let errorElement = document.getElementById('order-error');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'order-error';
      errorElement.className = 'order-message order-error';
      errorElement.setAttribute('role', 'alert');
      
      // Insert before order summary
      const orderSummary = document.getElementById('order-summary');
      if (orderSummary && orderSummary.parentNode) {
        orderSummary.parentNode.insertBefore(errorElement, orderSummary);
      }
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorElement) {
        errorElement.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Show success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    // Create or update success display
    let successElement = document.getElementById('order-success');
    
    if (!successElement) {
      successElement = document.createElement('div');
      successElement.id = 'order-success';
      successElement.className = 'order-message order-success';
      successElement.setAttribute('role', 'status');
      successElement.setAttribute('aria-live', 'polite');
      
      // Insert before order summary
      const orderSummary = document.getElementById('order-summary');
      if (orderSummary && orderSummary.parentNode) {
        orderSummary.parentNode.insertBefore(successElement, orderSummary);
      }
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (successElement) {
        successElement.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Dispatch order update event for other components to listen to
   */
  dispatchOrderUpdateEvent() {
    const event = new (window.CustomEvent || CustomEvent)('orderUpdated', {
      detail: {
        order: { ...this.currentOrder },
        itemCount: this.currentOrder.items.length,
        totalPrice: this.currentOrder.totalPrice
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Get current order data
   * @returns {Object} Current order data
   */
  getCurrentOrder() {
    return { ...this.currentOrder };
  }

  /**
   * Get order item count
   * @returns {number} Total number of items in order
   */
  getItemCount() {
    return this.currentOrder.items.reduce((count, item) => count + item.quantity, 0);
  }

  /**
   * Check if order has items
   * @returns {boolean} True if order has items
   */
  hasItems() {
    return this.currentOrder.items.length > 0;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other modules
export default OrderBuilderController;