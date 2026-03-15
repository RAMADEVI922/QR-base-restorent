/**
 * Main frontend application controller
 * Handles page navigation, user interactions, and API communication
 */

import { NavigationController } from './navigationController.js';
import MenuDisplayController from './menuDisplayController.js';
import OrderBuilderController from './orderBuilderController.js';
import OrderQueueController from './orderQueueController.js';
import TablesController from './tablesController.js';
import MenuManagementController from './menuManagementController.js';

class App {
  constructor() {
    this.navigationController = new NavigationController();
    this.menuDisplayController = new MenuDisplayController();
    this.orderBuilderController = new OrderBuilderController();
    this.orderQueueController = new OrderQueueController();
    this.tablesController = new TablesController();
    this.menuManagementController = new MenuManagementController();
    this.init();
  }

  init() {
    this.navigationController.init();
    this.menuDisplayController.init();
    this.orderBuilderController.init();
    this.orderQueueController.init();
    this.tablesController.init();
    this.menuManagementController.init();
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
      // Use the TablesController to display tables
      await this.tablesController.displayTables();
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  }

  async loadQueuePage() {
    try {
      await this.orderQueueController.loadQueue();
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  }

  async loadMenuManagementPage() {
    try {
      // Use the MenuManagementController to display menu items
      await this.menuManagementController.displayMenuItems();
    } catch (error) {
      console.error('Error loading menu management:', error);
    }
  }
  async updateOrderStatus(orderId, newStatus) {
    // This method is now handled by the OrderQueueController
    // Keep for backward compatibility but delegate to the controller
    console.warn('updateOrderStatus called on App - this should be handled by OrderQueueController');
  }


}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  // Make orderQueueController globally accessible for HTML event handlers
  window.orderQueueController = window.app.orderQueueController;
});

// Export for testing
export default App;