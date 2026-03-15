/**
 * Metrics Update Broadcaster
 * Broadcasts dashboard metrics updates when data changes
 * 
 * Requirements: 7.4
 */

import { broadcastEvent } from './websocketServer.js';
import {
  calculateActiveTableCount,
  calculateOrderCountsByStatus,
  calculateTotalRevenue
} from './metricsService.js';

/**
 * Broadcasts updated metrics to all connected clients
 */
export async function broadcastMetricsUpdate() {
  try {
    const activeTableCount = await calculateActiveTableCount();
    const orderCountsByStatus = await calculateOrderCountsByStatus();
    const totalRevenue = await calculateTotalRevenue();
    
    const metrics = {
      activeTableCount,
      orderCountsByStatus,
      totalRevenue,
      timestamp: Date.now()
    };
    
    broadcastEvent('metricsUpdate', metrics);
  } catch (error) {
    console.error('Error broadcasting metrics update:', error);
  }
}
