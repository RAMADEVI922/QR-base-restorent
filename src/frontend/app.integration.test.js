/**
 * Integration tests for App with NavigationController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Set up jsdom environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <nav class="navigation">
    <ul class="nav-links">
      <li><a href="#" data-page="menu" class="nav-link" data-role="customer">Menu</a></li>
      <li><a href="#" data-page="queue" class="nav-link" data-role="kitchen,waiter">Queue</a></li>
      <li><a href="#" data-page="dashboard" class="nav-link" data-role="manager">Dashboard</a></li>
      <li><a href="#" data-page="tables" class="nav-link" data-role="manager">Tables</a></li>
      <li><a href="#" data-page="menu-management" class="nav-link" data-role="manager">Menu Management</a></li>
    </ul>
  </nav>
  <main>
    <section id="menu-page" class="page hidden">
      <p id="table-info"></p>
      <div id="menu-items"></div>
      <div id="summary-items"></div>
      <span id="total-price">0.00</span>
      <button id="submit-order">Submit Order</button>
    </section>
    <section id="queue-page" class="page hidden">
      <div id="orders-queue"></div>
    </section>
    <section id="dashboard-page" class="page hidden">
      <span id="active-tables-count">0</span>
      <span id="pending-orders-count">0</span>
      <span id="preparing-orders-count">0</span>
      <span id="ready-orders-count">0</span>
      <span id="served-orders-count">0</span>
      <span id="total-revenue">$0.00</span>
    </section>
    <section id="tables-page" class="page hidden">
      <div id="tables-list"></div>
    </section>
    <section id="menu-management-page" class="page hidden">
      <div id="menu-management-list"></div>
    </section>
  </main>
</body>
</html>
`);

global.document = dom.window.document;
global.window = dom.window;
global.fetch = vi.fn();

// Mock the NavigationController module
vi.mock('./navigationController.js', () => {
  return {
    NavigationController: vi.fn().mockImplementation(() => ({
      init: vi.fn(),
      navigateTo: vi.fn().mockReturnValue(true),
      setUserRole: vi.fn(),
      setTableContext: vi.fn(),
      getContext: vi.fn().mockReturnValue({ role: 'customer', tableId: 'table-1', sessionId: null }),
      getCurrentPage: vi.fn().mockReturnValue('menu'),
      navigateFromQRCode: vi.fn().mockReturnValue(true)
    }))
  };
});

// Import App after mocking
const { default: App } = await import('./app.js');

describe('App Integration with NavigationController', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
    app = new App();
  });

  describe('Initialization', () => {
    it('should create navigation controller instance', () => {
      expect(app.navigationController).toBeDefined();
    });

    it('should initialize navigation controller', () => {
      expect(app.navigationController.init).toHaveBeenCalled();
    });

    it('should set default customer role', () => {
      expect(app.navigationController.setUserRole).toHaveBeenCalledWith('customer');
    });

    it('should navigate to menu page on init', () => {
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('menu');
    });
  });

  describe('Navigation Integration', () => {
    it('should use navigation controller for page switching', () => {
      app.showPage('dashboard');
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('dashboard', {});
    });

    it('should get current page from navigation controller', () => {
      const currentPage = app.currentPage;
      expect(app.navigationController.getCurrentPage).toHaveBeenCalled();
    });

    it('should get current table from navigation controller context', () => {
      const currentTable = app.currentTable;
      expect(app.navigationController.getContext).toHaveBeenCalled();
    });
  });

  describe('Role Management', () => {
    it('should switch to manager role', () => {
      app.switchToManagerRole();
      expect(app.navigationController.setUserRole).toHaveBeenCalledWith('manager');
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('dashboard');
    });

    it('should switch to kitchen role', () => {
      app.switchToKitchenRole();
      expect(app.navigationController.setUserRole).toHaveBeenCalledWith('kitchen');
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('queue');
    });

    it('should switch to waiter role', () => {
      app.switchToWaiterRole();
      expect(app.navigationController.setUserRole).toHaveBeenCalledWith('waiter');
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('queue');
    });

    it('should switch to customer role', () => {
      app.switchToCustomerRole();
      expect(app.navigationController.setUserRole).toHaveBeenCalledWith('customer');
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('menu');
    });

    it('should switch to customer role with table context', () => {
      app.switchToCustomerRole('table-5');
      expect(app.navigationController.setUserRole).toHaveBeenCalledWith('customer');
      expect(app.navigationController.setTableContext).toHaveBeenCalledWith('table-5');
      expect(app.navigationController.navigateTo).toHaveBeenCalledWith('menu');
    });
  });

  describe('QR Code Integration', () => {
    it('should handle QR code scanning', () => {
      app.handleQRCodeScan('table-3');
      expect(app.navigationController.navigateFromQRCode).toHaveBeenCalledWith('table-3');
    });
  });

  describe('Context Integration', () => {
    it('should use table context in order submission', async () => {
      // Mock successful fetch response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'order-1' })
      });

      // Set up order with items
      app.currentOrder = {
        items: [{ menuItemId: 'item-1', quantity: 1, price: 1000, name: 'Test Item' }]
      };

      // Mock alert
      global.alert = vi.fn();

      await app.submitOrder();

      expect(global.fetch).toHaveBeenCalledWith('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ menuItemId: 'item-1', quantity: 1, price: 1000, name: 'Test Item' }],
          tableId: 'table-1'
        })
      });
    });

    it('should update table info on menu page load', async () => {
      // Mock successful fetch response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      await app.loadMenuPage();

      const tableInfoElement = document.getElementById('table-info');
      expect(tableInfoElement.textContent).toBe('Table: table-1');
    });
  });
});