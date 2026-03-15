/**
 * Unit Tests for WebSocket Server
 * Tests connection management and event broadcasting
 * 
 * Requirements: 4.2, 7.4, 9.5, 12.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { WebSocket } from 'ws';
import express from 'express';
import { 
  initializeWebSocketServer, 
  broadcastEvent, 
  getConnectedClientCount,
  closeWebSocketServer 
} from './websocketServer.js';

describe('WebSocket Server Unit Tests', () => {
  let httpServer;
  let wsUrl;
  const PORT = 3002;

  beforeEach(async () => {
    const app = express();
    httpServer = createServer(app);
    initializeWebSocketServer(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(PORT, () => {
        wsUrl = `ws://localhost:${PORT}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    closeWebSocketServer();
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections', async () => {
      const client = new WebSocket(wsUrl);
      
      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(client.readyState).toBe(WebSocket.OPEN);
      expect(getConnectedClientCount()).toBe(1);

      client.close();
    });

    it('should send connection confirmation on connect', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Wait for connection message
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toEqual({
        type: 'connected',
        message: 'WebSocket connection established'
      });

      client.close();
    });

    it('should track multiple connected clients', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);
      const client3 = new WebSocket(wsUrl);

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve)),
        new Promise((resolve) => client3.on('open', resolve))
      ]);

      expect(getConnectedClientCount()).toBe(3);

      client1.close();
      client2.close();
      client3.close();
    });

    it('should remove client from tracking on disconnect', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(getConnectedClientCount()).toBe(1);

      client.close();

      // Wait for close event to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getConnectedClientCount()).toBe(0);
    });

    it('should handle multiple clients connecting and disconnecting', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve))
      ]);

      expect(getConnectedClientCount()).toBe(2);

      client1.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getConnectedClientCount()).toBe(1);

      const client3 = new WebSocket(wsUrl);
      await new Promise((resolve) => client3.on('open', resolve));

      expect(getConnectedClientCount()).toBe(2);

      client2.close();
      client3.close();
    });

    it('should handle client errors gracefully', async () => {
      const client = new WebSocket(wsUrl);

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      expect(getConnectedClientCount()).toBe(1);

      // Simulate error by closing the underlying socket
      client.terminate();

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Client should be removed from tracking
      expect(getConnectedClientCount()).toBe(0);
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast events to connected clients', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      const eventData = { orderId: '123', status: 'preparing' };
      broadcastEvent('orderStatusUpdate', eventData);

      // Wait for message to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      const statusUpdates = messages.filter(msg => msg.type === 'orderStatusUpdate');
      expect(statusUpdates.length).toBe(1);
      expect(statusUpdates[0].data).toEqual(eventData);
      expect(statusUpdates[0]).toHaveProperty('timestamp');

      client.close();
    });

    it('should broadcast to all connected clients', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);
      const client3 = new WebSocket(wsUrl);
      const messages1 = [];
      const messages2 = [];
      const messages3 = [];

      client1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      client2.on('message', (data) => messages2.push(JSON.parse(data.toString())));
      client3.on('message', (data) => messages3.push(JSON.parse(data.toString())));

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve)),
        new Promise((resolve) => client3.on('open', resolve))
      ]);

      const eventData = { menuItemId: '456', available: false };
      broadcastEvent('menuItemUpdate', eventData);

      // Wait for messages to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All clients should receive the broadcast
      const updates1 = messages1.filter(msg => msg.type === 'menuItemUpdate');
      const updates2 = messages2.filter(msg => msg.type === 'menuItemUpdate');
      const updates3 = messages3.filter(msg => msg.type === 'menuItemUpdate');

      expect(updates1.length).toBe(1);
      expect(updates2.length).toBe(1);
      expect(updates3.length).toBe(1);

      expect(updates1[0].data).toEqual(eventData);
      expect(updates2[0].data).toEqual(eventData);
      expect(updates3[0].data).toEqual(eventData);

      client1.close();
      client2.close();
      client3.close();
    });

    it('should broadcast different event types', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Broadcast different event types
      broadcastEvent('orderCreated', { orderId: '1', tableId: 'T1' });
      broadcastEvent('orderStatusUpdate', { orderId: '1', status: 'preparing' });
      broadcastEvent('menuItemUpdate', { menuItemId: 'M1', available: true });
      broadcastEvent('metricsUpdate', { activeTableCount: 5 });

      // Wait for messages to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      const eventTypes = messages
        .filter(msg => msg.type !== 'connected')
        .map(msg => msg.type);

      expect(eventTypes).toContain('orderCreated');
      expect(eventTypes).toContain('orderStatusUpdate');
      expect(eventTypes).toContain('menuItemUpdate');
      expect(eventTypes).toContain('metricsUpdate');

      client.close();
    });

    it('should not broadcast to disconnected clients', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);
      const messages1 = [];
      const messages2 = [];

      client1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      client2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve))
      ]);

      // Close client1
      client1.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Broadcast event
      const eventData = { orderId: '789', status: 'ready' };
      broadcastEvent('orderStatusUpdate', eventData);

      // Wait for messages to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Only client2 should receive the message
      const updates1 = messages1.filter(msg => msg.type === 'orderStatusUpdate');
      const updates2 = messages2.filter(msg => msg.type === 'orderStatusUpdate');

      expect(updates1.length).toBe(0);
      expect(updates2.length).toBe(1);

      client2.close();
    });

    it('should handle broadcasting with no connected clients', () => {
      // Should not throw error when no clients are connected
      expect(() => {
        broadcastEvent('orderStatusUpdate', { orderId: '999', status: 'completed' });
      }).not.toThrow();
    });

    it('should include timestamp in broadcast messages', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      const beforeTimestamp = Date.now();
      broadcastEvent('orderCreated', { orderId: '111' });
      const afterTimestamp = Date.now();

      // Wait for message to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      const orderCreated = messages.filter(msg => msg.type === 'orderCreated');
      expect(orderCreated.length).toBe(1);
      expect(orderCreated[0]).toHaveProperty('timestamp');
      expect(orderCreated[0].timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(orderCreated[0].timestamp).toBeLessThanOrEqual(afterTimestamp);

      client.close();
    });
  });

  describe('Server Lifecycle', () => {
    it('should close all client connections when server closes', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);

      await Promise.all([
        new Promise((resolve) => client1.on('open', resolve)),
        new Promise((resolve) => client2.on('open', resolve))
      ]);

      expect(getConnectedClientCount()).toBe(2);

      closeWebSocketServer();

      // Wait for close events
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getConnectedClientCount()).toBe(0);
    });

    it('should handle broadcasting after server is closed', () => {
      closeWebSocketServer();

      // Should not throw error when server is closed
      expect(() => {
        broadcastEvent('orderStatusUpdate', { orderId: '999' });
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty event data', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      broadcastEvent('testEvent', {});

      // Wait for message to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      const testEvents = messages.filter(msg => msg.type === 'testEvent');
      expect(testEvents.length).toBe(1);
      expect(testEvents[0].data).toEqual({});

      client.close();
    });

    it('should handle complex nested event data', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      const complexData = {
        order: {
          id: '123',
          items: [
            { menuItemId: 'M1', quantity: 2, price: 1000 },
            { menuItemId: 'M2', quantity: 1, price: 1500 }
          ],
          metadata: {
            tableId: 'T1',
            timestamp: Date.now()
          }
        }
      };

      broadcastEvent('orderCreated', complexData);

      // Wait for message to arrive
      await new Promise((resolve) => setTimeout(resolve, 50));

      const orderCreated = messages.filter(msg => msg.type === 'orderCreated');
      expect(orderCreated.length).toBe(1);
      expect(orderCreated[0].data).toEqual(complexData);

      client.close();
    });

    it('should handle rapid successive broadcasts', async () => {
      const client = new WebSocket(wsUrl);
      const messages = [];

      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => {
        client.on('open', resolve);
      });

      // Send 10 rapid broadcasts
      for (let i = 0; i < 10; i++) {
        broadcastEvent('testEvent', { index: i });
      }

      // Wait for all messages to arrive
      await new Promise((resolve) => setTimeout(resolve, 100));

      const testEvents = messages.filter(msg => msg.type === 'testEvent');
      expect(testEvents.length).toBe(10);

      // Verify all messages were received in order
      for (let i = 0; i < 10; i++) {
        expect(testEvents[i].data.index).toBe(i);
      }

      client.close();
    });
  });
});
