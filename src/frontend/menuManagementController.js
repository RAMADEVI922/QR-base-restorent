/**
 * Menu Management Controller
 * Handles menu management functionality including list display, creation, updates,
 * availability toggling, and real-time updates
 * Requirements: 9.1, 9.2, 9.3, 9.5
 */

class MenuManagementController {
  constructor() {
    this.menuItems = [];
    this.menuListContainer = null;
    this.createMenuItemButton = null;
    this.modalOverlay = null;
    this.modalTitle = null;
    this.modalBody = null;
    this.modalClose = null;
    this.websocket = null;
  }

  /**
   * Initialize the menu management controller
   */
  init() {
    this.cacheElementReferences();
    
    if (!this.validateElements()) {
      console.error('Menu management page elements not found');
      return;
    }

    this.setupEventListeners();
    this.setupWebSocketConnection();
  }

  /**
   * Cache references to DOM elements
   */
  cacheElementReferences() {
    this.menuListContainer = document.getElementById('menu-management-list');
    this.createMenuItemButton = document.getElementById('create-menu-item-btn');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalTitle = document.getElementById('modal-title');
    this.modalBody = document.getElementById('modal-body');
    this.modalClose = document.getElementById('modal-close');
  }

  /**
   * Validate that all required DOM elements exist
   * @returns {boolean} True if all elements exist
   */
  validateElements() {
    return !!(
      this.menuListContainer &&
      this.createMenuItemButton &&
      this.modalOverlay &&
      this.modalTitle &&
      this.modalBody &&
      this.modalClose
    );
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Create menu item button
    this.createMenuItemButton.addEventListener('click', () => {
      this.showCreateMenuItemModal();
    });

    // Modal close button
    this.modalClose.addEventListener('click', () => {
      this.hideModal();
    });

    // Close modal when clicking outside
    this.modalOverlay.addEventListener('click', (event) => {
      if (event.target === this.modalOverlay) {
        this.hideModal();
      }
    });
  }

  /**
   * Fetch all menu items from API and display them
   * Requirements: 9.1
   */
  async displayMenuItems() {
    if (!this.menuListContainer) {
      console.error('Menu list container not initialized');
      return;
    }

    try {
      // Fetch menu items from API
      const menuItems = await this.fetchMenuItems();
      this.menuItems = menuItems;

      // Clear existing content
      this.menuListContainer.innerHTML = '';

      if (menuItems.length === 0) {
        this.displayEmptyState();
        return;
      }

      // Create menu item elements
      menuItems.forEach(item => {
        const itemElement = this.createMenuItemElement(item);
        this.menuListContainer.appendChild(itemElement);
      });
    } catch (error) {
      console.error('Error displaying menu items:', error);
      this.displayError('Failed to load menu items. Please try again.');
    }
  }

  /**
   * Fetch menu items from the API
   * Requirements: 9.1
   * @returns {Promise<Array>} Array of menu item objects
   */
  async fetchMenuItems() {
    const response = await fetch('/api/menu-items');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu items: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Create a menu item element for display
   * Requirements: 9.1, 9.3
   * @param {Object} item - Menu item data
   * @returns {HTMLElement} Menu item element
   */
  createMenuItemElement(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'menu-management-item';
    itemDiv.setAttribute('role', 'listitem');
    itemDiv.setAttribute('data-menu-item-id', item.id);

    const formattedPrice = (item.price / 100).toFixed(2);
    const availabilityClass = item.available ? 'available' : 'unavailable';
    const availabilityText = item.available ? 'Available' : 'Unavailable';

    itemDiv.innerHTML = `
      <div class="menu-management-info">
        <h3 class="menu-item-name">${this.escapeHtml(item.name)}</h3>
        <p class="menu-item-description">${this.escapeHtml(item.description)}</p>
        <div class="menu-item-details">
          <span class="menu-item-price">$${formattedPrice}</span>
          <span class="menu-item-status ${availabilityClass}" aria-live="polite">${availabilityText}</span>
        </div>
      </div>
      <div class="menu-management-controls">
        <button class="btn btn-secondary edit-btn" data-item-id="${item.id}" aria-label="Edit ${this.escapeHtml(item.name)}">
          Edit
        </button>
        <button class="btn ${item.available ? 'btn-warning' : 'btn-success'} toggle-availability-btn" 
                data-item-id="${item.id}" 
                aria-label="${item.available ? 'Disable' : 'Enable'} ${this.escapeHtml(item.name)}">
          ${item.available ? 'Disable' : 'Enable'}
        </button>
        <button class="btn btn-danger delete-btn" data-item-id="${item.id}" aria-label="Delete ${this.escapeHtml(item.name)}">
          Delete
        </button>
      </div>
    `;

    // Add event listeners to buttons
    const editBtn = itemDiv.querySelector('.edit-btn');
    const toggleBtn = itemDiv.querySelector('.toggle-availability-btn');
    const deleteBtn = itemDiv.querySelector('.delete-btn');

    editBtn.addEventListener('click', () => this.handleEditMenuItem(item));
    toggleBtn.addEventListener('click', () => this.handleToggleAvailability(item.id));
    deleteBtn.addEventListener('click', () => this.handleDeleteMenuItem(item.id));

    return itemDiv;
  }

  /**
   * Display empty state when no menu items exist
   */
  displayEmptyState() {
    this.menuListContainer.innerHTML = `
      <div class="empty-state" role="status">
        <p>No menu items yet. Add your first item to get started.</p>
      </div>
    `;
  }

  /**
   * Display error message
   * @param {string} message - Error message to display
   */
  displayError(message) {
    this.menuListContainer.innerHTML = `
      <div class="error-state" role="alert">
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-secondary" onclick="window.menuManagementController.displayMenuItems()">
          Try Again
        </button>
      </div>
    `;
  }

  /**
   * Show create menu item modal
   * Requirements: 9.1
   */
  showCreateMenuItemModal() {
    this.modalTitle.textContent = 'Add Menu Item';
    this.modalBody.innerHTML = `
      <form id="create-menu-item-form" class="modal-form">
        <div class="form-group">
          <label for="item-name">Name *</label>
          <input type="text" id="item-name" name="name" required class="form-input" 
                 aria-required="true" placeholder="e.g., Margherita Pizza">
        </div>
        
        <div class="form-group">
          <label for="item-description">Description *</label>
          <textarea id="item-description" name="description" required class="form-input" 
                    aria-required="true" rows="3" 
                    placeholder="Describe the menu item..."></textarea>
        </div>
        
        <div class="form-group">
          <label for="item-price">Price ($) *</label>
          <input type="number" id="item-price" name="price" required class="form-input" 
                 aria-required="true" min="0" step="0.01" placeholder="0.00">
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Add Item</button>
          <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    const form = document.getElementById('create-menu-item-form');
    const cancelBtn = form.querySelector('.cancel-btn');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleCreateMenuItem(form);
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal();
    });

    this.showModal();
  }

  /**
   * Handle menu item creation
   * Requirements: 9.1
   * @param {HTMLFormElement} form - The form element
   */
  async handleCreateMenuItem(form) {
    try {
      const formData = new FormData(form);
      const name = formData.get('name').trim();
      const description = formData.get('description').trim();
      const priceInDollars = parseFloat(formData.get('price'));

      // Validate inputs
      if (!name || !description || isNaN(priceInDollars) || priceInDollars < 0) {
        this.showModalError('Please fill in all fields with valid values.');
        return;
      }

      // Convert price to cents
      const priceInCents = Math.round(priceInDollars * 100);

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';
      }

      const response = await fetch('/api/menu-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          price: priceInCents
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create menu item: ${response.status}`);
      }

      const newItem = await response.json();
      
      this.hideModal();
      this.showSuccess(`Menu item "${newItem.name}" created successfully!`);
      
      // Refresh menu list
      await this.displayMenuItems();
      
    } catch (error) {
      console.error('Error creating menu item:', error);
      this.showModalError('Failed to create menu item. Please try again.');
    }
  }

  /**
   * Show edit menu item modal
   * Requirements: 9.2
   * @param {Object} item - Menu item to edit
   */
  handleEditMenuItem(item) {
    this.modalTitle.textContent = 'Edit Menu Item';
    this.modalBody.innerHTML = `
      <form id="edit-menu-item-form" class="modal-form">
        <div class="form-group">
          <label for="edit-item-name">Name *</label>
          <input type="text" id="edit-item-name" name="name" required class="form-input" 
                 aria-required="true" value="${this.escapeHtml(item.name)}">
        </div>
        
        <div class="form-group">
          <label for="edit-item-description">Description *</label>
          <textarea id="edit-item-description" name="description" required class="form-input" 
                    aria-required="true" rows="3">${this.escapeHtml(item.description)}</textarea>
        </div>
        
        <div class="form-group">
          <label for="edit-item-price">Price ($) *</label>
          <input type="number" id="edit-item-price" name="price" required class="form-input" 
                 aria-required="true" min="0" step="0.01" value="${(item.price / 100).toFixed(2)}">
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save Changes</button>
          <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    const form = document.getElementById('edit-menu-item-form');
    const cancelBtn = form.querySelector('.cancel-btn');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleUpdateMenuItem(item.id, form);
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal();
    });

    this.showModal();
  }

  /**
   * Handle menu item update
   * Requirements: 9.2
   * @param {string} itemId - ID of item to update
   * @param {HTMLFormElement} form - The form element
   */
  async handleUpdateMenuItem(itemId, form) {
    try {
      const formData = new FormData(form);
      const name = formData.get('name').trim();
      const description = formData.get('description').trim();
      const priceInDollars = parseFloat(formData.get('price'));

      // Validate inputs
      if (!name || !description || isNaN(priceInDollars) || priceInDollars < 0) {
        this.showModalError('Please fill in all fields with valid values.');
        return;
      }

      // Convert price to cents
      const priceInCents = Math.round(priceInDollars * 100);

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      const response = await fetch(`/api/menu-items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          price: priceInCents
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update menu item: ${response.status}`);
      }

      const updatedItem = await response.json();
      
      this.hideModal();
      this.showSuccess(`Menu item "${updatedItem.name}" updated successfully!`);
      
      // Refresh menu list
      await this.displayMenuItems();
      
    } catch (error) {
      console.error('Error updating menu item:', error);
      this.showModalError('Failed to update menu item. Please try again.');
    }
  }

  /**
   * Handle availability toggle
   * Requirements: 9.3
   * @param {string} itemId - ID of item to toggle
   */
  async handleToggleAvailability(itemId) {
    try {
      // Get current item state
      const item = this.menuItems.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Menu item not found');
      }

      const newAvailability = !item.available;

      const response = await fetch(`/api/menu-items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          available: newAvailability
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to toggle availability: ${response.status}`);
      }

      const updatedItem = await response.json();
      
      this.showSuccess(`Menu item "${updatedItem.name}" is now ${updatedItem.available ? 'available' : 'unavailable'}.`);
      
      // Update local cache
      const index = this.menuItems.findIndex(i => i.id === itemId);
      if (index !== -1) {
        this.menuItems[index] = updatedItem;
      }

      // Update the specific menu item element
      this.updateMenuItemElement(updatedItem);
      
    } catch (error) {
      console.error('Error toggling availability:', error);
      this.showError('Failed to toggle availability. Please try again.');
    }
  }

  /**
   * Handle menu item deletion
   * Requirements: 9.1
   * @param {string} itemId - ID of item to delete
   */
  async handleDeleteMenuItem(itemId) {
    const item = this.menuItems.find(i => i.id === itemId);
    const itemName = item ? item.name : 'this item';
    
    const confirmed = confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`);
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/menu-items/${itemId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete menu item: ${response.status}`);
      }

      this.showSuccess(`Menu item "${itemName}" deleted successfully!`);
      
      // Refresh menu list
      await this.displayMenuItems();
      
    } catch (error) {
      console.error('Error deleting menu item:', error);
      this.showError('Failed to delete menu item. Please try again.');
    }
  }

  /**
   * Update a specific menu item element in the DOM
   * Requirements: 9.5
   * @param {Object} updatedItem - Updated menu item data
   */
  updateMenuItemElement(updatedItem) {
    const itemElement = this.menuListContainer.querySelector(`[data-menu-item-id="${updatedItem.id}"]`);
    if (itemElement) {
      const newElement = this.createMenuItemElement(updatedItem);
      itemElement.replaceWith(newElement);
    }
  }

  /**
   * Handle real-time menu item updates from WebSocket
   * Requirements: 9.5
   * @param {Object} updatedItem - Updated menu item
   */
  handleMenuItemUpdate(updatedItem) {
    // Update local cache
    const index = this.menuItems.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      this.menuItems[index] = updatedItem;
      // Update the specific menu item element
      this.updateMenuItemElement(updatedItem);
    } else {
      // New item added, refresh the list
      this.displayMenuItems();
    }
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
        console.log('WebSocket connected for menu management updates');
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

  /**
   * Show modal
   */
  showModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('hidden');
      this.modalOverlay.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Hide modal
   */
  hideModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.add('hidden');
      this.modalOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    let successElement = document.getElementById('menu-management-success');
    
    if (!successElement) {
      successElement = document.createElement('div');
      successElement.id = 'menu-management-success';
      successElement.className = 'menu-management-message menu-management-success';
      successElement.setAttribute('role', 'status');
      successElement.setAttribute('aria-live', 'polite');
      
      const menuManagementPage = document.getElementById('menu-management-page');
      if (menuManagementPage) {
        const header = menuManagementPage.querySelector('.page-header');
        if (header && header.nextSibling) {
          menuManagementPage.insertBefore(successElement, header.nextSibling);
        }
      }
    }
    
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    setTimeout(() => {
      if (successElement) {
        successElement.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    let errorElement = document.getElementById('menu-management-error');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'menu-management-error';
      errorElement.className = 'menu-management-message menu-management-error';
      errorElement.setAttribute('role', 'alert');
      
      const menuManagementPage = document.getElementById('menu-management-page');
      if (menuManagementPage) {
        const header = menuManagementPage.querySelector('.page-header');
        if (header && header.nextSibling) {
          menuManagementPage.insertBefore(errorElement, header.nextSibling);
        }
      }
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
      if (errorElement) {
        errorElement.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Show error message in modal
   * @param {string} message - Error message to display
   */
  showModalError(message) {
    const existingError = this.modalBody.querySelector('.modal-error');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'modal-error';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.textContent = message;
    
    this.modalBody.insertBefore(errorDiv, this.modalBody.firstChild);
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
}

// Export for use in other modules
export default MenuManagementController;
