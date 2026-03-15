/**
 * Menu Display Controller
 * Handles fetching and displaying menu items from the API
 * Requirements: 2.1, 2.2, 2.5
 */

class MenuDisplayController {
  constructor() {
    this.menuItems = [];
    this.menuItemsContainer = null;
    this.tableInfo = null;
    this.currentTableId = null;
  }

  /**
   * Initialize the menu display controller
   */
  init() {
    this.menuItemsContainer = document.getElementById('menu-items');
    this.tableInfo = document.getElementById('table-info');
    
    if (!this.menuItemsContainer) {
      console.error('Menu items container not found');
      return;
    }

    // Setup WebSocket for real-time updates
    this.setupWebSocketConnection();
  }

  /**
   * Set the current table context
   * @param {string} tableId - The table ID from QR code scan
   */
  setTableContext(tableId) {
    this.currentTableId = tableId;
    if (this.tableInfo) {
      this.tableInfo.textContent = `Table: ${tableId}`;
    }
  }

  /**
   * Fetch menu items from the API
   * Requirements: 2.1
   * @returns {Promise<MenuItem[]>} Array of menu items
   */
  async fetchMenuItems() {
    try {
      const response = await fetch('/api/menu-items');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch menu items: ${response.status} ${response.statusText}`);
      }
      
      const menuItems = await response.json();
      this.menuItems = menuItems;
      return menuItems;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      // Don't display error here, let the caller handle it
      throw error;
    }
  }

  /**
   * Display menu items in the UI
   * Requirements: 2.1, 2.2, 2.5
   */
  async displayMenuItems() {
    if (!this.menuItemsContainer) {
      console.error('Menu items container not initialized');
      return;
    }

    // Clear existing content
    this.menuItemsContainer.innerHTML = '';

    try {
      // Fetch fresh menu items
      const menuItems = await this.fetchMenuItems();

      if (menuItems.length === 0 && this.menuItems.length === 0) {
        this.displayEmptyState();
        return;
      }

      // Create menu item elements
      this.menuItems.forEach(item => {
        const menuItemElement = this.createMenuItemElement(item);
        this.menuItemsContainer.appendChild(menuItemElement);
      });
    } catch (error) {
      console.error('Error displaying menu items:', error);
      this.displayError('Failed to load menu items. Please try again.');
    }
  }

  /**
   * Create a menu item element
   * Requirements: 2.2, 2.5
   * @param {MenuItem} item - Menu item data
   * @returns {HTMLElement} Menu item element
   */
  createMenuItemElement(item) {
    const menuItemDiv = document.createElement('div');
    menuItemDiv.className = `menu-item ${!item.available ? 'menu-item-unavailable' : ''}`;
    menuItemDiv.setAttribute('role', 'listitem');
    menuItemDiv.setAttribute('data-menu-item-id', item.id);

    // Format price from cents to dollars
    const formattedPrice = (item.price / 100).toFixed(2);

    menuItemDiv.innerHTML = `
      <div class="menu-item-content">
        <div class="menu-item-header">
          <h3 class="menu-item-name">${this.escapeHtml(item.name)}</h3>
          <span class="menu-item-price">$${formattedPrice}</span>
        </div>
        <p class="menu-item-description">${this.escapeHtml(item.description)}</p>
        ${!item.available ? '<p class="menu-item-unavailable-text" aria-live="polite">Currently unavailable</p>' : ''}
      </div>
      <div class="menu-item-actions">
        <button 
          class="btn btn-secondary add-to-order-btn" 
          ${!item.available ? 'disabled aria-disabled="true"' : ''}
          aria-label="Add item to order"
          data-menu-item-id="${item.id}"
        >
          ${!item.available ? 'Unavailable' : 'Add to Order'}
        </button>
      </div>
    `;

    // Add click handler for available items
    if (item.available) {
      const addButton = menuItemDiv.querySelector('.add-to-order-btn');
      addButton.addEventListener('click', () => {
        this.handleAddToOrder(item);
      });
    }

    return menuItemDiv;
  }

  /**
   * Handle adding an item to the order
   * Requirements: 2.3 (referenced for context)
   * @param {MenuItem} item - Menu item to add
   */
  handleAddToOrder(item) {
    // Dispatch custom event for order builder to handle
    const event = new (window.CustomEvent || CustomEvent)('menuItemSelected', {
      detail: {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * Display empty state when no menu items are available
   */
  displayEmptyState() {
    this.menuItemsContainer.innerHTML = `
      <div class="empty-state" role="status">
        <p>No menu items available at the moment.</p>
      </div>
    `;
  }

  /**
   * Display error message
   * @param {string} message - Error message to display
   */
  displayError(message) {
    if (!this.menuItemsContainer) return;
    
    this.menuItemsContainer.innerHTML = `
      <div class="error-state" role="alert">
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-secondary" onclick="window.menuDisplayController.displayMenuItems()">
          Try Again
        </button>
      </div>
    `;
  }

  /**
   * Handle real-time menu item updates
   * Requirements: 9.5
   * @param {MenuItem} updatedItem - Updated menu item
   */
  handleMenuItemUpdate(updatedItem) {
    // Update local cache
    const index = this.menuItems.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      this.menuItems[index] = updatedItem;
    }

    // Update the specific menu item element
    const menuItemElement = this.menuItemsContainer.querySelector(`[data-menu-item-id="${updatedItem.id}"]`);
    if (menuItemElement) {
      const newElement = this.createMenuItemElement(updatedItem);
      menuItemElement.replaceWith(newElement);
    }
  }

  /**
   * Refresh menu items display
   */
  async refresh() {
    await this.displayMenuItems();
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

  /**
   * Setup WebSocket connection for real-time updates
   * Requirements: 9.5
   */
  setupWebSocketConnection() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('WebSocket connected for menu updates');
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'menuItemUpdate') {
            this.handleMenuItemUpdate(data.payload);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('WebSocket connection closed, attempting to reconnect...');
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          this.setupWebSocketConnection();
        }, 3000);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
    }
  }
}

// Export for use in other modules
export default MenuDisplayController;