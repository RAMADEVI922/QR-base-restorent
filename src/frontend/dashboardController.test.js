/**
 * Dashboard Controller Unit Tests
 * Tests metrics display and real-time updates
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DashboardController from './dashboardController.js';

describe('DashboardController', () => {
  let controller;
  let mockElements;

  beforeEach(() => {
    // Setup DOM elements
    document.body.innerHTML = `
      <div id="dashboard-page">
        <div class="page-header"></div>
        <div class="metrics-grid">
          <p id="active-tables-count">0</p>
          <p id="pending-orders-count">0</p>
          <p id="preparing-orders-count">0</p>
          <p id="ready-orders-count">0</p>
          <p id="served-orders-count">0</p>
          <p id="total-revenue">$0.00</p>
        </div>
      </div>
    `;

    mockElements = {
      activeTablesCount: document.getElementById('active-tables-count'),
      pendingOrdersCount: document.getElementById('pending-orders-count'),
      preparingOrdersCount: document.getElementById('preparing-orders-count'),
      readyOrdersCount: document.getElementById('ready-orders-count'),
      servedOrdersCount: document.getElementById('served-orders-count'),
      totalRevenue: document.getElementById('total-revenue')
    };

    controller = new DashboardController();

    // Mock fetch
    global.fetch = vi.fn();

    // Mock WebSocket
    global.WebSocket = vi.fn(() => ({
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      close: vi.fn(),
      send: vi.fn()
    }));
  });

  afterEach(() => {
    if (controller) {
      controller.destroy();
    }
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should cache DOM element references on init', () => {
      controller.init();

      expect(controller.activeTablesElement).toBe(mockElements.activeTablesCount);
      expect(controller.pendingOrdersElement).toBe(mockElements.pendingOrdersCount);
      expect(controller.preparingOrdersElement).toBe(mockElements.preparingOrdersCount);
      expect(controller.readyOrdersElement).toBe(mockElements.readyOrdersCount);
      expect(controller.servedOrdersElement).toBe(mockElements.servedOrdersCount);
      expect(controller.totalRevenueElement).toBe(mockElements.totalRevenue);
    });

    it('should validate that all required elements exist', () => {
      controller.cacheElementReferences();
      expect(controller.validateElements()).toBe(true);
    });

    it('should return false when elements are missing', () => {
      document.getElementById('active-tables-count').remove();
      controller.cacheElementReferences();
      expect(controller.validateElements()).toBe(false);
    });
  });

  describe('Fetch Metrics - Requirement 7.1, 7.2, 7.3', () => {
    it('should fetch metrics from API endpoint', async () => {
      const mockMetrics = {
        activeTableCount: 5,
        orderCountsByStatus: {
          pending: 2,
          preparing: 3,
          ready: 1,
          served: 4,
          completed: 10
        },
        totalRevenue: 15000,
        timestamp: Date.now()
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      });

      const metrics = await controller.fetchMetrics();

      expect(global.fetch).toHaveBeenCalledWith('/api/metrics');
      expect(metrics).toEqual(mockMetrics);
    });

    it('should throw error when API request fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(controller.fetchMetrics()).rejects.toThrow('Failed to fetch metrics: 500 Internal Server Error');
    });
  });

  describe('Display Metrics - Requirement 7.1, 7.2, 7.3', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should display active table count (Requirement 7.1)', () => {
      controller.metrics = {
        activeTableCount: 8,
        orderCountsByStatus: {
          pending: 0,
          preparing: 0,
          ready: 0,
          served: 0,
          completed: 0
        },
        totalRevenue: 0
      };

      controller.displayMetrics();

      expect(mockElements.activeTablesCount.textContent).toBe('8');
    });

    it('should display order counts by status (Requirement 7.2)', () => {
      controller.metrics = {
        activeTableCount: 0,
        orderCountsByStatus: {
          pending: 3,
          preparing: 5,
          ready: 2,
          served: 7,
          completed: 15
        },
        totalRevenue: 0
      };

      controller.displayMetrics();

      expect(mockElements.pendingOrdersCount.textContent).toBe('3');
      expect(mockElements.preparingOrdersCount.textContent).toBe('5');
      expect(mockElements.readyOrdersCount.textContent).toBe('2');
      expect(mockElements.servedOrdersCount.textContent).toBe('7');
    });

    it('should display total revenue (Requirement 7.3)', () => {
      controller.metrics = {
        activeTableCount: 0,
        orderCountsByStatus: {
          pending: 0,
          preparing: 0,
          ready: 0,
          served: 0,
          completed: 0
        },
        totalRevenue: 25050 // $250.50 in cents
      };

      controller.displayMetrics();

      expect(mockElements.totalRevenue.textContent).toBe('$250.50');
    });

    it('should display all metrics together', () => {
      controller.metrics = {
        activeTableCount: 12,
        orderCountsByStatus: {
          pending: 4,
          preparing: 6,
          ready: 3,
          served: 8,
          completed: 20
        },
        totalRevenue: 50000 // $500.00 in cents
      };

      controller.displayMetrics();

      expect(mockElements.activeTablesCount.textContent).toBe('12');
      expect(mockElements.pendingOrdersCount.textContent).toBe('4');
      expect(mockElements.preparingOrdersCount.textContent).toBe('6');
      expect(mockElements.readyOrdersCount.textContent).toBe('3');
      expect(mockElements.servedOrdersCount.textContent).toBe('8');
      expect(mockElements.totalRevenue.textContent).toBe('$500.00');
    });

    it('should format revenue with two decimal places', () => {
      controller.metrics = {
        activeTableCount: 0,
        orderCountsByStatus: {
          pending: 0,
          preparing: 0,
          ready: 0,
          served: 0,
          completed: 0
        },
        totalRevenue: 12345 // $123.45 in cents
      };

      controller.displayMetrics();

      expect(mockElements.totalRevenue.textContent).toBe('$123.45');
    });
  });

  describe('Real-Time Updates - Requirement 7.4', () => {
    let mockWebSocket;

    beforeEach(() => {
      controller.init();
      mockWebSocket = global.WebSocket.mock.results[0].value;
    });

    it('should setup WebSocket connection on init', () => {
      expect(global.WebSocket).toHaveBeenCalled();
      expect(mockWebSocket.onopen).toBeDefined();
      expect(mockWebSocket.onmessage).toBeDefined();
      expect(mockWebSocket.onclose).toBeDefined();
      expect(mockWebSocket.onerror).toBeDefined();
    });

    it('should handle metrics update via WebSocket (Requirement 7.4)', () => {
      const updatedMetrics = {
        activeTableCount: 15,
        orderCountsByStatus: {
          pending: 5,
          preparing: 8,
          ready: 4,
          served: 10,
          completed: 25
        },
        totalRevenue: 75000,
        timestamp: Date.now()
      };

      const event = {
        data: JSON.stringify({
          type: 'metricsUpdate',
          data: updatedMetrics
        })
      };

      mockWebSocket.onmessage(event);

      expect(mockElements.activeTablesCount.textContent).toBe('15');
      expect(mockElements.pendingOrdersCount.textContent).toBe('5');
      expect(mockElements.preparingOrdersCount.textContent).toBe('8');
      expect(mockElements.readyOrdersCount.textContent).toBe('4');
      expect(mockElements.servedOrdersCount.textContent).toBe('10');
      expect(mockElements.totalRevenue.textContent).toBe('$750.00');
    });

    it('should update metrics when orders change (Requirement 7.4)', () => {
      const initialMetrics = {
        activeTableCount: 10,
        orderCountsByStatus: {
          pending: 2,
          preparing: 3,
          ready: 1,
          served: 5,
          completed: 10
        },
        totalRevenue: 50000
      };

      controller.metrics = initialMetrics;
      controller.displayMetrics();

      expect(mockElements.pendingOrdersCount.textContent).toBe('2');

      // Simulate order status change via WebSocket
      const updatedMetrics = {
        ...initialMetrics,
        orderCountsByStatus: {
          pending: 1,
          preparing: 4,
          ready: 1,
          served: 5,
          completed: 10
        }
      };

      const event = {
        data: JSON.stringify({
          type: 'metricsUpdate',
          data: updatedMetrics
        })
      };

      mockWebSocket.onmessage(event);

      expect(mockElements.pendingOrdersCount.textContent).toBe('1');
      expect(mockElements.preparingOrdersCount.textContent).toBe('4');
    });

    it('should update metrics when tables change (Requirement 7.4)', () => {
      controller.metrics = {
        activeTableCount: 8,
        orderCountsByStatus: {
          pending: 0,
          preparing: 0,
          ready: 0,
          served: 0,
          completed: 0
        },
        totalRevenue: 0
      };

      controller.displayMetrics();

      expect(mockElements.activeTablesCount.textContent).toBe('8');

      // Simulate table creation via WebSocket
      const updatedMetrics = {
        activeTableCount: 9,
        orderCountsByStatus: {
          pending: 0,
          preparing: 0,
          ready: 0,
          served: 0,
          completed: 0
        },
        totalRevenue: 0
      };

      const event = {
        data: JSON.stringify({
          type: 'metricsUpdate',
          data: updatedMetrics
        })
      };

      mockWebSocket.onmessage(event);

      expect(mockElements.activeTablesCount.textContent).toBe('9');
    });

    it('should handle WebSocket connection errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('WebSocket connection failed');
      mockWebSocket.onerror(error);

      expect(consoleSpy).toHaveBeenCalledWith('Dashboard WebSocket error:', error);

      consoleSpy.mockRestore();
    });

    it('should handle invalid WebSocket messages gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = {
        data: 'invalid json'
      };

      mockWebSocket.onmessage(event);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should close WebSocket on destroy', () => {
      controller.destroy();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(controller.websocket).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should display error message when fetch fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await controller.fetchAndDisplayMetrics();

      const errorElement = document.getElementById('dashboard-error');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Failed to load dashboard metrics');
    });

    it('should handle missing DOM elements gracefully', () => {
      document.body.innerHTML = '<div id="dashboard-page"></div>';
      
      const newController = new DashboardController();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      newController.init();

      expect(consoleSpy).toHaveBeenCalledWith('Dashboard elements not found');

      consoleSpy.mockRestore();
    });
  });

  describe('Manual Refresh', () => {
    beforeEach(() => {
      controller.init();
    });

    it('should refresh metrics on manual refresh', async () => {
      const mockMetrics = {
        activeTableCount: 20,
        orderCountsByStatus: {
          pending: 10,
          preparing: 15,
          ready: 5,
          served: 12,
          completed: 30
        },
        totalRevenue: 100000
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      });

      await controller.refresh();

      expect(mockElements.activeTablesCount.textContent).toBe('20');
      expect(mockElements.pendingOrdersCount.textContent).toBe('10');
      expect(mockElements.totalRevenue.textContent).toBe('$1000.00');
    });
  });
});