/**
 * Main frontend application controller
 * Handles page navigation, user interactions, and API communication
 */

import { NavigationController } from './navigationController.js';
import MenuDisplayController from './menuDisplayController.js';
import OrderBuilderController from './orderBuilderController.js';

class App {
  constructor() {
    this.navigationController = new NavigationController();
    this.menuDisplayController = new MenuDisplayController();
    this.orderBuilderController = new OrderBuilderController();
    this.init();
  }

  init() {
    this.navigationController.init();
    this.menuDisplayController.init();
    this.orderBuilderController.init();
    this.setupNavigationIntegration();
    this.setupOrderEventListeners();
    
    // Set default role and navigate to menu page
    this.navigationController.setUserRole('customer');
    this.navigationController.navigateTo('menu');
  }

  setupNavigationIntegration() {
    // Override the navigation controller's navigateTo method to load page content
    const originalNavigateTo = this.navigationController.navigateTo.bind(this.navigationController);
    this.navigationController.navigateTo = (pageName, context = {}) => {
      const result = originalNavigateTo(pageName, context);
      if (result) {
        this.loadPageContent(pageName);
      }
      return result;
    };
  }

  /**
   * Setup event listeners for order interactions
   */
  setupOrderEventListeners() {
    // Listen for order submission events
    document.addEventListener('orderSubmitted', (event) => {
      this.handleOrderSubmitted(event.detail.order);
    });

    // Listen for order updates
    document.addEventListener('orderUpdated', (event) => {
      this.handleOrderUpdated(event.detail);
    });
  }

  /**
   * Handle successful order submission
   * @param {Object} order - The submitted order
   */
  handleOrderSubmitted(order) {
    console.log('Order submitted successfully:', order);
    // Could navigate to a confirmation page or show additional UI feedback
  }

  /**
   * Handle order updates
   * @param {Object} orderData - Updated order data
   */
  handleOrderUpdated(orderData) {
    console.log('Order updated:', orderData);
    // Could update UI elements that depend on order state
  }
  /**
   * Get current page from navigation controller
   */
  get currentPage() {
    return this.navigationController.getCurrentPage();
  }

  /**
   * Get current table from navigation controller context
   */
  get currentTable() {
    return this.navigationController.getContext().tableId;
  }

  /**
   * Navigate to a page using the navigation controller
   */
  showPage(pageName, context = {}) {
    return this.navigationController.navigateTo(pageName, context);
  }

  /**
   * Set user role and apply access control
   */
  setUserRole(role) {
    this.navigationController.setUserRole(role);
  }

  /**
   * Handle QR code scanning navigation
   */
  handleQRCodeScan(tableId) {
    return this.navigationController.navigateFromQRCode(tableId);
  }

  loadPageContent(pageName) {
    switch (pageName) {
      case 'menu':
        this.loadMenuPage();
        break;
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'tables':
        this.loadTablesPage();
        break;
      case 'queue':
        this.loadQueuePage();
        break;
      case 'menu-management':
        this.loadMenuManagementPage();
        break;
    }
  }

  async loadMenuPage() {
    try {
      // Set table context if available
      const context = this.navigationController.getContext();
      if (context.tableId) {
        this.menuDisplayController.setTableContext(context.tableId);
        this.orderBuilderController.setTableContext(context.tableId);
      }
      
      // Display menu items using the controller
      await this.menuDisplayController.displayMenuItems();
      
    } catch (error) {
      console.error('Error loading menu:', error);
    }
  }

  updateTableInfo() {
    const context = this.navigationController.getContext();
    const tableInfoElement = document.getElementById('table-info');
    if (tableInfoElement && context.tableId) {
      tableInfoElement.textContent = `Table: ${context.tableId}`;
    }
  }

  async loadDashboard() {
    try {
      const response = await fetch('/api/metrics');
      const metrics = await response.json();
      this.renderDashboard(metrics);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  renderDashboard(metrics) {
    document.getElementById('active-tables-count').textContent = metrics.activeTables || 0;
    document.getElementById('pending-orders-count').textContent = metrics.pendingOrders || 0;
    document.getElementById('preparing-orders-count').textContent = metrics.preparingOrders || 0;
    document.getElementById('ready-orders-count').textContent = metrics.readyOrders || 0;
    document.getElementById('served-orders-count').textContent = metrics.servedOrders || 0;
    document.getElementById('total-revenue').textContent = `${((metrics.totalRevenue || 0) / 100).toFixed(2)}`;
  }

  /**
   * Switch to manager role for administrative access
   */
  switchToManagerRole() {
    this.navigationController.setUserRole('manager');
    this.navigationController.navigateTo('dashboard');
  }

  /**
   * Switch to kitchen role for order queue access
   */
  switchToKitchenRole() {
    this.navigationController.setUserRole('kitchen');
    this.navigationController.navigateTo('queue');
  }

  /**
   * Switch to waiter role for order queue access
   */
  switchToWaiterRole() {
    this.navigationController.setUserRole('waiter');
    this.navigationController.navigateTo('queue');
  }

  /**
   * Switch to customer role for menu access
   */
  switchToCustomerRole(tableId = null) {
    this.navigationController.setUserRole('customer');
    if (tableId) {
      this.navigationController.setTableContext(tableId);
    }
    this.navigationController.navigateTo('menu');
  }
  async loadTablesPage() {
    try {
      const response = await fetch('/api/tables');
      const tables = await response.json();
      this.renderTables(tables);
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  }

  renderTables(tables) {
    const container = document.getElementById('tables-list');
    container.innerHTML = '';

    tables.forEach(table => {
      const tableElement = document.createElement('div');
      tableElement.className = 'table-card';
      tableElement.innerHTML = `
        <h3>Table ${table.id}</h3>
        <p>Status: ${table.status}</p>
        <div class="table-qr">
          <img src="${table.qrCode}" alt="QR Code for Table ${table.id}">
        </div>
        <div class="table-controls">
          <button class="btn btn-secondary" onclick="app.printQRCode('${table.id}')">Print</button>
          <button class="btn btn-danger" onclick="app.deleteTable('${table.id}')">Delete</button>
        </div>
      `;
      container.appendChild(tableElement);
    });
  }

  async loadQueuePage() {
    try {
      const response = await fetch('/api/orders/queue');
      const orders = await response.json();
      this.renderQueue(orders);
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  }

  renderQueue(orders) {
    const container = document.getElementById('orders-queue');
    container.innerHTML = '';

    orders.forEach(order => {
      const orderElement = document.createElement('div');
      orderElement.className = `order-card ${order.status === 'ready' ? 'ready' : ''}`;
      
      const itemsHtml = order.items.map(item => 
        `<div class="order-item"><span>${item.name} x${item.quantity}</span></div>`
      ).join('');

      orderElement.innerHTML = `
        <div class="order-header">
          <span class="order-id">Order #${order.id}</span>
          <span class="order-status ${order.status}">${order.status}</span>
        </div>
        <div class="order-table">Table: ${order.tableId}</div>
        <div class="order-items">${itemsHtml}</div>
        <div class="order-controls">
          ${order.status === 'pending' ? `<button class="btn btn-primary" onclick="app.updateOrderStatus('${order.id}', 'preparing')">Start Preparing</button>` : ''}
          ${order.status === 'preparing' ? `<button class="btn btn-primary" onclick="app.updateOrderStatus('${order.id}', 'ready')">Mark Ready</button>` : ''}
          ${order.status === 'ready' ? `<button class="btn btn-primary" onclick="app.updateOrderStatus('${order.id}', 'served')">Mark Served</button>` : ''}
          ${order.status === 'served' ? `<button class="btn btn-primary" onclick="app.updateOrderStatus('${order.id}', 'completed')">Mark Completed</button>` : ''}
        </div>
      `;
      container.appendChild(orderElement);
    });
  }

  async loadMenuManagementPage() {
    try {
      const response = await fetch('/api/menu-items');
      const menuItems = await response.json();
      this.renderMenuManagement(menuItems);
    } catch (error) {
      console.error('Error loading menu management:', error);
    }
  }

  renderMenuManagement(menuItems) {
    const container = document.getElementById('menu-management-list');
    container.innerHTML = '';

    menuItems.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'menu-management-item';
      itemElement.innerHTML = `
        <div class="menu-management-info">
          <h3>${item.name}</h3>
          <p>${item.description}</p>
          <p>Price: ${(item.price / 100).toFixed(2)}</p>
          <p>Status: ${item.available ? 'Available' : 'Unavailable'}</p>
        </div>
        <div class="menu-management-controls">
          <button class="btn btn-secondary" onclick="app.toggleAvailability('${item.id}')">
            ${item.available ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn-danger" onclick="app.deleteMenuItem('${item.id}')">Delete</button>
        </div>
      `;
      container.appendChild(itemElement);
    });
  }
  async updateOrderStatus(orderId, newStatus) {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        this.loadQueuePage();
      } else {
        alert('Error updating order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  printQRCode(tableId) {
    alert(`Print QR code for table ${tableId}`);
  }

  async deleteTable(tableId) {
    if (confirm('Are you sure you want to delete this table?')) {
      try {
        const response = await fetch(`/api/tables/${tableId}`, { method: 'DELETE' });
        if (response.ok) {
          this.loadTablesPage();
        }
      } catch (error) {
        console.error('Error deleting table:', error);
      }
    }
  }

  async toggleAvailability(menuItemId) {
    try {
      const response = await fetch(`/api/menu-items/${menuItemId}`, { method: 'GET' });
      const item = await response.json();
      
      const updateResponse = await fetch(`/api/menu-items/${menuItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, available: !item.available })
      });

      if (updateResponse.ok) {
        this.loadMenuManagementPage();
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  }

  async deleteMenuItem(menuItemId) {
    if (confirm('Are you sure you want to delete this menu item?')) {
      try {
        const response = await fetch(`/api/menu-items/${menuItemId}`, { method: 'DELETE' });
        if (response.ok) {
          this.loadMenuManagementPage();
        }
      } catch (error) {
        console.error('Error deleting menu item:', error);
      }
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

// Export for testing
export default App;