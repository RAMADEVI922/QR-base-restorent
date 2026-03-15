/**
 * Unit tests for Metrics Service
 * Tests active table count, order counts by status, and revenue calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateActiveTableCount, 
  calculateOrderCountsByStatus, 
  calculateTotalRevenue 
} from './metricsService.js';
import { writeTables, writeOrders } from './persistenceManager.js';
import { TableStatus, OrderStatus } from '../shared/types.js';

describe('Metrics Service', () => {
  beforeEach(async () => {
    // Clear data before each test
    await writeTables([]);
    await writeOrders([]);
  });

  describe('calculateActiveTableCount', () => {
    it('should return 0 when no tables exist', async () => {
      const count = await calculateActiveTableCount();
      expect(count).toBe(0);
    });

    it('should count only active tables', async () => {
      const tables = [
        { id: 't1', status: TableStatus.ACTIVE, qrCode: 'qr1', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 't2', status: TableStatus.ACTIVE, qrCode: 'qr2', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 't3', status: TableStatus.INACTIVE, qrCode: 'qr3', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      await writeTables(tables);

      const count = await calculateActiveTableCount();
      expect(count).toBe(2);
    });

    it('should return 0 when all tables are inactive', async () => {
      const tables = [
        { id: 't1', status: TableStatus.INACTIVE, qrCode: 'qr1', createdAt: Date.now(), updatedAt: Date.now() },
        { id: 't2', status: TableStatus.INACTIVE, qrCode: 'qr2', createdAt: Date.now(), updatedAt: Date.now() }
      ];
      await writeTables(tables);

      const count = await calculateActiveTableCount();
      expect(count).toBe(0);
    });
  });

  describe('calculateOrderCountsByStatus', () => {
    it('should return zero counts when no orders exist', async () => {
      const counts = await calculateOrderCountsByStatus();
      
      expect(counts).toEqual({
        pending: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        completed: 0
      });
    });

    it('should count orders by status correctly', async () => {
      const orders = [
        { id: 'o1', tableId: 't1', items: [], status: OrderStatus.PENDING, totalPrice: 1000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o2', tableId: 't1', items: [], status: OrderStatus.PENDING, totalPrice: 2000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o3', tableId: 't2', items: [], status: OrderStatus.PREPARING, totalPrice: 1500, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o4', tableId: 't2', items: [], status: OrderStatus.READY, totalPrice: 3000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o5', tableId: 't3', items: [], status: OrderStatus.SERVED, totalPrice: 2500, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o6', tableId: 't3', items: [], status: OrderStatus.COMPLETED, totalPrice: 4000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null }
      ];
      await writeOrders(orders);

      const counts = await calculateOrderCountsByStatus();
      
      expect(counts).toEqual({
        pending: 2,
        preparing: 1,
        ready: 1,
        served: 1,
        completed: 1
      });
    });

    it('should handle multiple orders with same status', async () => {
      const orders = [
        { id: 'o1', tableId: 't1', items: [], status: OrderStatus.COMPLETED, totalPrice: 1000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null },
        { id: 'o2', tableId: 't2', items: [], status: OrderStatus.COMPLETED, totalPrice: 2000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null },
        { id: 'o3', tableId: 't3', items: [], status: OrderStatus.COMPLETED, totalPrice: 3000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null }
      ];
      await writeOrders(orders);

      const counts = await calculateOrderCountsByStatus();
      
      expect(counts.completed).toBe(3);
      expect(counts.pending).toBe(0);
    });
  });

  describe('calculateTotalRevenue', () => {
    it('should return 0 when no orders exist', async () => {
      const revenue = await calculateTotalRevenue();
      expect(revenue).toBe(0);
    });

    it('should return 0 when no completed orders exist', async () => {
      const orders = [
        { id: 'o1', tableId: 't1', items: [], status: OrderStatus.PENDING, totalPrice: 1000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o2', tableId: 't2', items: [], status: OrderStatus.PREPARING, totalPrice: 2000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null }
      ];
      await writeOrders(orders);

      const revenue = await calculateTotalRevenue();
      expect(revenue).toBe(0);
    });

    it('should calculate total revenue from completed orders only', async () => {
      const orders = [
        { id: 'o1', tableId: 't1', items: [], status: OrderStatus.COMPLETED, totalPrice: 1000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null },
        { id: 'o2', tableId: 't2', items: [], status: OrderStatus.COMPLETED, totalPrice: 2500, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null },
        { id: 'o3', tableId: 't3', items: [], status: OrderStatus.PENDING, totalPrice: 3000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, previousOrderId: null },
        { id: 'o4', tableId: 't4', items: [], status: OrderStatus.COMPLETED, totalPrice: 1500, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null }
      ];
      await writeOrders(orders);

      const revenue = await calculateTotalRevenue();
      expect(revenue).toBe(5000); // 1000 + 2500 + 1500
    });

    it('should handle single completed order', async () => {
      const orders = [
        { id: 'o1', tableId: 't1', items: [], status: OrderStatus.COMPLETED, totalPrice: 4250, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null }
      ];
      await writeOrders(orders);

      const revenue = await calculateTotalRevenue();
      expect(revenue).toBe(4250);
    });

    it('should handle orders with zero price', async () => {
      const orders = [
        { id: 'o1', tableId: 't1', items: [], status: OrderStatus.COMPLETED, totalPrice: 0, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null },
        { id: 'o2', tableId: 't2', items: [], status: OrderStatus.COMPLETED, totalPrice: 1000, createdAt: Date.now(), updatedAt: Date.now(), completedAt: Date.now(), previousOrderId: null }
      ];
      await writeOrders(orders);

      const revenue = await calculateTotalRevenue();
      expect(revenue).toBe(1000);
    });
  });
});
