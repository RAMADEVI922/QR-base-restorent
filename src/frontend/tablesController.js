/**
 * Tables Controller
 * Handles table management functionality including list display, creation, deletion,
 * QR code display/print, and order history
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

class TablesController {
  constructor() {
    this.tables = [];
    this.tablesListContainer = null;
    this.createTableButton = null;
    this.modalOverlay = null;
    this.modalTitle = null;
    this.modalBody = null;
    this.modalClose = null;
    this.selectedTableId = null;
  }

  /**
   * Initialize the tables controller
   */
  init() {
    this.cacheElementReferences();
    
    if (!this.validateElements()) {
      console.error('Tables page elements not found');
      return;
    }

    this.setupEventListeners();
  }

  /**
   * Cache references to DOM elements
   */
  cacheElementReferences() {
    this.tablesListContainer = document.getElementById('tables-list');
    this.createTableButton = document.getElementById('create-table-btn');
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
      this.tablesListContainer &&
      this.createTableButton &&
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
    // Create table button
    this.createTableButton.addEventListener('click', () => {
      this.showCreateTableModal();
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
   * Fetch all tables from API and display them
   * Requirements: 8.1
   */
  async displayTables() {
    if (!this.tablesListContainer) {
      console.error('Tables list container not initialized');
      return;
    }

    try {
      // Fetch tables from API
      const tables = await this.fetchTables();
      this.tables = tables;

      // Clear existing content
      this.tablesListContainer.innerHTML = '';

      if (tables.length === 0) {
        this.displayEmptyState();
        return;
      }

      // Create table elements
      tables.forEach(table => {
        const tableElement = this.createTableElement(table);
        this.tablesListContainer.appendChild(tableElement);
      });
    } catch (error) {
      console.error('Error displaying tables:', error);
      this.displayError('Failed to load tables. Please try again.');
    }
  }

  /**
   * Fetch tables from the API
   * Requirements: 8.1
   * @returns {Promise<Array>} Array of table objects
   */
  async fetchTables() {
    const response = await fetch('/api/tables');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Create a table element for display
   * Requirements: 8.1, 8.4
   * @param {Object} table - Table data
   * @returns {HTMLElement} Table element
   */
  createTableElement(table) {
    const tableDiv = document.createElement('div');
    tableDiv.className = 'table-card';
    tableDiv.setAttribute('role', 'listitem');
    tableDiv.setAttribute('data-table-id', table.id);

    tableDiv.innerHTML = `
      <div class="table-card-header">
        <h3 class="table-card-title">Table ${this.escapeHtml(table.id)}</h3>
        <span class="table-status ${table.status}">${this.escapeHtml(table.status)}</span>
      </div>
      <div class="table-qr-container">
        <img src="${this.escapeHtml(table.qrCode)}" alt="QR Code for Table ${this.escapeHtml(table.id)}" class="table-qr-image">
      </div>
      <div class="table-controls">
        <button class="btn btn-secondary print-qr-btn" data-table-id="${table.id}" aria-label="Print QR code for table ${this.escapeHtml(table.id)}">
          Print QR
        </button>
        <button class="btn btn-secondary download-qr-btn" data-table-id="${table.id}" aria-label="Download QR code for table ${this.escapeHtml(table.id)}">
          Download QR
        </button>
        <button class="btn btn-secondary view-history-btn" data-table-id="${table.id}" aria-label="View order history for table ${this.escapeHtml(table.id)}">
          View History
        </button>
        <button class="btn btn-danger delete-table-btn" data-table-id="${table.id}" aria-label="Delete table ${this.escapeHtml(table.id)}">
          Delete
        </button>
      </div>
    `;

    // Add event listeners to buttons
    const printBtn = tableDiv.querySelector('.print-qr-btn');
    const downloadBtn = tableDiv.querySelector('.download-qr-btn');
    const viewHistoryBtn = tableDiv.querySelector('.view-history-btn');
    const deleteBtn = tableDiv.querySelector('.delete-table-btn');

    printBtn.addEventListener('click', () => this.handlePrintQRCode(table));
    downloadBtn.addEventListener('click', () => this.handleDownloadQRCode(table));
    viewHistoryBtn.addEventListener('click', () => this.handleViewOrderHistory(table.id));
    deleteBtn.addEventListener('click', () => this.handleDeleteTable(table.id));

    return tableDiv;
  }

  /**
   * Display empty state when no tables exist
   */
  displayEmptyState() {
    this.tablesListContainer.innerHTML = `
      <div class="empty-state" role="status">
        <p>No tables configured yet. Create your first table to get started.</p>
      </div>
    `;
  }

  /**
   * Display error message
   * @param {string} message - Error message to display
   */
  displayError(message) {
    this.tablesListContainer.innerHTML = `
      <div class="error-state" role="alert">
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-secondary" onclick="window.tablesController.displayTables()">
          Try Again
        </button>
      </div>
    `;
  }

  /**
   * Show create table modal
   * Requirements: 8.2
   */
  showCreateTableModal() {
    this.modalTitle.textContent = 'Create New Table';
    this.modalBody.innerHTML = `
      <form id="create-table-form" class="modal-form">
        <p class="form-description">A new table will be created with a unique QR code.</p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Create Table</button>
          <button type="button" class="btn btn-secondary cancel-btn">Cancel</button>
        </div>
      </form>
    `;

    const form = document.getElementById('create-table-form');
    const cancelBtn = form.querySelector('.cancel-btn');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleCreateTable();
    });

    cancelBtn.addEventListener('click', () => {
      this.hideModal();
    });

    this.showModal();
  }

  /**
   * Handle table creation
   * Requirements: 8.2
   */
  async handleCreateTable() {
    try {
      const submitBtn = document.querySelector('#create-table-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
      }

      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create table: ${response.status}`);
      }

      const newTable = await response.json();
      
      this.hideModal();
      this.showSuccess(`Table ${newTable.id} created successfully!`);
      
      // Refresh table list
      await this.displayTables();
      
      // Show QR code for the new table
      this.showQRCodeModal(newTable);
      
    } catch (error) {
      console.error('Error creating table:', error);
      this.showModalError('Failed to create table. Please try again.');
    }
  }

  /**
   * Show QR code modal for a newly created table
   * Requirements: 8.2, 8.4
   * @param {Object} table - Table object with QR code
   */
  showQRCodeModal(table) {
    this.modalTitle.textContent = `QR Code for Table ${table.id}`;
    this.modalBody.innerHTML = `
      <div class="qr-code-modal">
        <p class="qr-code-description">Your table has been created! Use this QR code for customer orders.</p>
        <div class="qr-code-display">
          <img src="${this.escapeHtml(table.qrCode)}" alt="QR Code for Table ${this.escapeHtml(table.id)}" class="qr-code-large">
        </div>
        <div class="qr-code-actions">
          <button class="btn btn-primary print-qr-modal-btn">Print QR Code</button>
          <button class="btn btn-secondary download-qr-modal-btn">Download QR Code</button>
          <button class="btn btn-secondary close-modal-btn">Close</button>
        </div>
      </div>
    `;

    const printBtn = this.modalBody.querySelector('.print-qr-modal-btn');
    const downloadBtn = this.modalBody.querySelector('.download-qr-modal-btn');
    const closeBtn = this.modalBody.querySelector('.close-modal-btn');

    printBtn.addEventListener('click', () => this.handlePrintQRCode(table));
    downloadBtn.addEventListener('click', () => this.handleDownloadQRCode(table));
    closeBtn.addEventListener('click', () => this.hideModal());

    this.showModal();
  }

  /**
   * Handle table deletion
   * Requirements: 8.3
   * @param {string} tableId - ID of table to delete
   */
  async handleDeleteTable(tableId) {
    const confirmed = confirm(`Are you sure you want to delete table ${tableId}? This action cannot be undone.`);
    
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/tables/${tableId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete table: ${response.status}`);
      }

      this.showSuccess(`Table ${tableId} deleted successfully!`);
      
      // Refresh table list
      await this.displayTables();
      
    } catch (error) {
      console.error('Error deleting table:', error);
      this.showError('Failed to delete table. Please try again.');
    }
  }

  /**
   * Handle printing QR code
   * Requirements: 8.4
   * @param {Object} table - Table object with QR code
   */
  handlePrintQRCode(table) {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      this.showError('Please allow popups to print QR codes.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - Table ${this.escapeHtml(table.id)}</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .print-container {
            text-align: center;
            padding: 20px;
          }
          h1 {
            margin-bottom: 20px;
            font-size: 24px;
          }
          img {
            max-width: 400px;
            height: auto;
          }
          @media print {
            body {
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <h1>Table ${this.escapeHtml(table.id)}</h1>
          <img src="${this.escapeHtml(table.qrCode)}" alt="QR Code for Table ${this.escapeHtml(table.id)}">
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for image to load before printing
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  /**
   * Handle downloading QR code
   * Requirements: 8.4
   * @param {Object} table - Table object with QR code
   */
  handleDownloadQRCode(table) {
    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = table.qrCode;
      link.download = `table-${table.id}-qr-code.png`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showSuccess(`QR code for table ${table.id} downloaded!`);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      this.showError('Failed to download QR code. Please try again.');
    }
  }

  /**
   * Handle viewing order history for a table
   * Requirements: 8.5
   * @param {string} tableId - ID of table to view history for
   */
  async handleViewOrderHistory(tableId) {
    try {
      this.modalTitle.textContent = `Order History - Table ${tableId}`;
      this.modalBody.innerHTML = '<div class="loading">Loading order history...</div>';
      this.showModal();

      // Fetch order history from API
      const response = await fetch(`/api/tables/${tableId}/orders`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order history: ${response.status}`);
      }

      const orders = await response.json();
      
      this.displayOrderHistory(tableId, orders);
      
    } catch (error) {
      console.error('Error fetching order history:', error);
      this.showModalError('Failed to load order history. Please try again.');
    }
  }

  /**
   * Display order history in modal
   * Requirements: 8.5
   * @param {string} tableId - Table ID
   * @param {Array} orders - Array of order objects
   */
  displayOrderHistory(tableId, orders) {
    if (orders.length === 0) {
      this.modalBody.innerHTML = `
        <div class="order-history-empty">
          <p>No orders found for table ${this.escapeHtml(tableId)}.</p>
          <button class="btn btn-secondary close-modal-btn">Close</button>
        </div>
      `;
      
      const closeBtn = this.modalBody.querySelector('.close-modal-btn');
      closeBtn.addEventListener('click', () => this.hideModal());
      return;
    }

    let historyHtml = '<div class="order-history-list">';
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt).toLocaleString();
      const totalPrice = (order.totalPrice / 100).toFixed(2);
      
      historyHtml += `
        <div class="order-history-item">
          <div class="order-history-header">
            <span class="order-id">Order #${this.escapeHtml(order.id)}</span>
            <span class="order-status ${order.status}">${this.escapeHtml(order.status)}</span>
          </div>
          <div class="order-history-details">
            <p class="order-date">${orderDate}</p>
            <div class="order-items">
              ${order.items.map(item => `
                <div class="order-item">
                  <span>${this.escapeHtml(item.name)} x${item.quantity}</span>
                  <span>$${(item.price * item.quantity / 100).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
            <div class="order-total">
              <strong>Total: $${totalPrice}</strong>
            </div>
          </div>
        </div>
      `;
    });
    
    historyHtml += `
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary close-modal-btn">Close</button>
      </div>
    `;
    
    this.modalBody.innerHTML = historyHtml;
    
    const closeBtn = this.modalBody.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => this.hideModal());
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
    let successElement = document.getElementById('tables-success');
    
    if (!successElement) {
      successElement = document.createElement('div');
      successElement.id = 'tables-success';
      successElement.className = 'tables-message tables-success';
      successElement.setAttribute('role', 'status');
      successElement.setAttribute('aria-live', 'polite');
      
      const tablesPage = document.getElementById('tables-page');
      if (tablesPage) {
        const header = tablesPage.querySelector('.page-header');
        if (header && header.nextSibling) {
          tablesPage.insertBefore(successElement, header.nextSibling);
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
    let errorElement = document.getElementById('tables-error');
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'tables-error';
      errorElement.className = 'tables-message tables-error';
      errorElement.setAttribute('role', 'alert');
      
      const tablesPage = document.getElementById('tables-page');
      if (tablesPage) {
        const header = tablesPage.querySelector('.page-header');
        if (header && header.nextSibling) {
          tablesPage.insertBefore(errorElement, header.nextSibling);
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
    this.modalBody.innerHTML = `
      <div class="modal-error" role="alert">
        <p>${this.escapeHtml(message)}</p>
        <button class="btn btn-secondary close-modal-btn">Close</button>
      </div>
    `;
    
    const closeBtn = this.modalBody.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => this.hideModal());
  }

  /**
   * Refresh tables display
   */
  async refresh() {
    await this.displayTables();
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
export default TablesController;
