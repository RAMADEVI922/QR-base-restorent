/**
 * WebSocket Server for real-time updates
 * Handles connection management and event broadcasting
 * 
 * Requirements: 4.2, 7.4, 9.5, 12.3
 */

import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Set();

/**
 * Initializes the WebSocket server
 * @param {Object} server - HTTP server instance
 */
export function initializeWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connection established' }));
  });

  return wss;
}

/**
 * Broadcasts an event to all connected clients
 * @param {string} eventType - Type of event (e.g., 'orderStatusUpdate', 'menuUpdate')
 * @param {Object} data - Event data to broadcast
 */
export function broadcastEvent(eventType, data) {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify({
    type: eventType,
    data,
    timestamp: Date.now()
  });

  clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    }
  });
}

/**
 * Gets the count of connected clients
 * @returns {number} - Number of connected clients
 */
export function getConnectedClientCount() {
  return clients.size;
}

/**
 * Closes the WebSocket server
 */
export function closeWebSocketServer() {
  if (wss) {
    clients.forEach((client) => {
      client.close();
    });
    clients.clear();
    wss.close();
    wss = null;
  }
}
