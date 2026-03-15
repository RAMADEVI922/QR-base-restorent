import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { 
  createTable, 
  getAllTables, 
  getTableById, 
  updateTableStatus, 
  deleteTable,
  getTableOrderHistory
} from './tableService.js';
import { generateQRCode } from './qrCodeGenerator.js';
import {
  createMenuItem,
  getAllMenuItems,
  getMenuItemById,
  updateMenuItemDetails,
  updateMenuItemAvailability,
  deleteMenuItem
} from './menuItemService.js';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getOrderQueue
} from './orderService.js';
import {
  calculateActiveTableCount,
  calculateOrderCountsByStatus,
  calculateTotalRevenue
} from './metricsService.js';
import { initializeWebSocketServer, broadcastEvent } from './websocketServer.js';
import { broadcastMetricsUpdate } from './metricsUpdateBroadcaster.js';
import dataValidator from './dataValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Validation error handler middleware
const handleValidationError = (validation, res) => {
  if (!validation.valid) {
    return res.status(400).json(dataValidator.createValidationErrorResponse(validation.errors));
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Table Management Endpoints

/**
 * POST /api/tables - Create a new table
 * Requirements: 8.2
 */
app.post('/api/tables', async (req, res) => {
  try {
    // Sanitize input
    const sanitizedBody = dataValidator.sanitizeObject(req.body);
    const { tableId } = sanitizedBody;
    
    // Validate table ID
    const idValidation = dataValidator.validateId(tableId, 'Table');
    if (!idValidation.valid) {
      return res.status(400).json(dataValidator.createValidationErrorResponse(idValidation.errors));
    }

    // Generate QR code for the table
    const qrCode = await generateQRCode(tableId);
    
    // Create the table
    const table = await createTable(qrCode);
    
    // Broadcast metrics update
    await broadcastMetricsUpdate();
    
    res.status(201).json(table);
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ 
      error: 'Failed to create table',
      message: error.message 
    });
  }
});

/**
 * GET /api/tables - List all tables
 * Requirements: 8.1
 */
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await getAllTables();
    res.json(tables);
  } catch (error) {
    console.error('Error retrieving tables:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve tables',
      message: error.message 
    });
  }
});

/**
 * GET /api/tables/:id - Get table by ID
 * Requirements: 8.1
 */
app.get('/api/tables/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const table = await getTableById(id);
    
    if (!table) {
      return res.status(404).json({ 
        error: 'Table not found' 
      });
    }
    
    res.json(table);
  } catch (error) {
    console.error('Error retrieving table:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve table',
      message: error.message 
    });
  }
});

/**
 * GET /api/tables/:id/validate - Validate QR code for table
 * Requirements: 1.2, 1.4, 11.2
 */
app.get('/api/tables/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const table = await getTableById(id);
    
    if (!table) {
      return res.json({ valid: false, error: 'Table not found' });
    }
    
    if (table.status !== 'active') {
      return res.json({ valid: false, error: 'Table is not active' });
    }
    
    res.json({ valid: true, tableId: table.id });
  } catch (error) {
    console.error('Error validating table:', error);
    res.status(500).json({ 
      valid: false,
      error: 'Failed to validate table',
      message: error.message 
    });
  }
});

/**
 * PUT /api/tables/:id - Update table
 * Requirements: 8.1
 */
app.put('/api/tables/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ 
        error: 'Status is required and must be a string' 
      });
    }
    
    // Check if table exists
    const existingTable = await getTableById(id);
    if (!existingTable) {
      return res.status(404).json({ 
        error: 'Table not found' 
      });
    }
    
    // Update table status
    const updatedTable = await updateTableStatus(id, status);
    
    // Broadcast metrics update
    await broadcastMetricsUpdate();
    
    res.json(updatedTable);
  } catch (error) {
    console.error('Error updating table:', error);
    res.status(500).json({ 
      error: 'Failed to update table',
      message: error.message 
    });
  }
});

/**
 * GET /api/tables/:id/orders - Get order history for a table
 * Requirements: 8.5
 */
app.get('/api/tables/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if table exists
    const existingTable = await getTableById(id);
    if (!existingTable) {
      return res.status(404).json({ 
        error: 'Table not found' 
      });
    }
    
    // Get order history for the table
    const orders = await getTableOrderHistory(id);
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching table order history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch table order history',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/tables/:id - Delete table (soft delete)
 * Requirements: 8.3
 */
app.delete('/api/tables/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if table exists
    const existingTable = await getTableById(id);
    if (!existingTable) {
      return res.status(404).json({ 
        error: 'Table not found' 
      });
    }
    
    // Soft delete the table
    const deletedTable = await deleteTable(id);
    
    res.json(deletedTable);
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ 
      error: 'Failed to delete table',
      message: error.message 
    });
  }
});

// Menu Management Endpoints

/**
 * POST /api/menu-items - Create a new menu item
 * Requirements: 9.1, 10.3, 10.4
 */
app.post('/api/menu-items', async (req, res) => {
  try {
    // Sanitize input
    const sanitizedBody = dataValidator.sanitizeObject(req.body);
    
    // Validate menu item data
    const validation = dataValidator.validateMenuItem(sanitizedBody);
    if (!validation.valid) {
      return res.status(400).json(dataValidator.createValidationErrorResponse(validation.errors));
    }
    
    const { name, description, price } = sanitizedBody;
    const menuItem = await createMenuItem(name, description, price);
    
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ 
      error: 'Failed to create menu item',
      message: error.message 
    });
  }
});

/**
 * GET /api/menu-items - List all menu items
 * Requirements: 9.1
 */
app.get('/api/menu-items', async (req, res) => {
  try {
    const menuItems = await getAllMenuItems();
    res.json(menuItems);
  } catch (error) {
    console.error('Error retrieving menu items:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve menu items',
      message: error.message 
    });
  }
});

/**
 * GET /api/menu-items/:id - Get menu item by ID
 * Requirements: 9.1
 */
app.get('/api/menu-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const menuItem = await getMenuItemById(id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        error: 'Menu item not found' 
      });
    }
    
    res.json(menuItem);
  } catch (error) {
    console.error('Error retrieving menu item:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve menu item',
      message: error.message 
    });
  }
});

/**
 * PUT /api/menu-items/:id - Update menu item
 * Requirements: 9.2, 9.3
 */
app.put('/api/menu-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, available } = req.body;
    
    // Check if menu item exists
    const existingMenuItem = await getMenuItemById(id);
    if (!existingMenuItem) {
      return res.status(404).json({ 
        error: 'Menu item not found' 
      });
    }
    
    let updatedMenuItem;
    
    // If availability is being updated
    if (available !== undefined) {
      if (typeof available !== 'boolean') {
        return res.status(400).json({ 
          error: 'Available must be a boolean' 
        });
      }
      updatedMenuItem = await updateMenuItemAvailability(id, available);
    }
    
    // If other details are being updated
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    
    if (Object.keys(updates).length > 0) {
      updatedMenuItem = await updateMenuItemDetails(id, updates);
    }
    
    // If both availability and details were updated, get the final state
    if (available !== undefined && Object.keys(updates).length > 0) {
      updatedMenuItem = await getMenuItemById(id);
    }
    
    // Broadcast menu item changes to all connected clients
    broadcastEvent('menuItemUpdate', updatedMenuItem);
    
    res.json(updatedMenuItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ 
      error: 'Failed to update menu item',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/menu-items/:id - Delete menu item
 * Requirements: 9.1
 */
app.delete('/api/menu-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if menu item exists
    const existingMenuItem = await getMenuItemById(id);
    if (!existingMenuItem) {
      return res.status(404).json({ 
        error: 'Menu item not found' 
      });
    }
    
    const deletedMenuItem = await deleteMenuItem(id);
    
    res.json(deletedMenuItem);
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ 
      error: 'Failed to delete menu item',
      message: error.message 
    });
  }
});

// Dashboard Metrics Endpoint

/**
 * GET /api/metrics - Get dashboard metrics
 * Requirements: 7.1, 7.2, 7.3
 */
app.get('/api/metrics', async (req, res) => {
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
    
    res.json(metrics);
  } catch (error) {
    console.error('Error retrieving metrics:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve metrics',
      message: error.message 
    });
  }
});

// Order Management Endpoints

/**
 * POST /api/orders - Create a new order
 * Requirements: 3.1, 3.2, 3.3, 3.4, 10.1, 10.2
 */
app.post('/api/orders', async (req, res) => {
  try {
    // Sanitize input
    const sanitizedBody = dataValidator.sanitizeObject(req.body);
    
    // Validate order data
    const validation = dataValidator.validateOrder(sanitizedBody);
    if (!validation.valid) {
      return res.status(400).json(dataValidator.createValidationErrorResponse(validation.errors));
    }
    
    const { tableId, items, previousOrderId } = sanitizedBody;
    const order = await createOrder(tableId, items, previousOrderId);
    
    // Broadcast new order creation to kitchen queue
    broadcastEvent('orderCreated', order);
    
    // Broadcast metrics update
    await broadcastMetricsUpdate();
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message 
    });
  }
});

/**
 * GET /api/orders/queue - Get active orders sorted by time
 * Requirements: 4.1, 4.2, 4.5, 5.4
 * NOTE: This route must be defined BEFORE /api/orders/:id to avoid route conflicts
 */
app.get('/api/orders/queue', async (req, res) => {
  try {
    const queue = await getOrderQueue();
    res.json(queue);
  } catch (error) {
    console.error('Error retrieving order queue:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve order queue',
      message: error.message 
    });
  }
});

/**
 * GET /api/orders - List all orders
 * Requirements: 4.3, 4.4
 */
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json(orders);
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve orders',
      message: error.message 
    });
  }
});

/**
 * GET /api/orders/:id - Get order by ID
 * Requirements: 5.2
 */
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await getOrderById(id);
    
    if (!order) {
      return res.status(404).json({ 
        error: 'Order not found' 
      });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve order',
      message: error.message 
    });
  }
});

/**
 * PUT /api/orders/:id - Update order
 * Requirements: 3.1, 3.2
 */
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    
    // Check if order exists
    const existingOrder = await getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ 
        error: 'Order not found' 
      });
    }
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ 
        error: 'Items are required and must be an array' 
      });
    }
    
    // Validate each item has required fields
    for (const item of items) {
      if (!item.menuItemId || !item.name || typeof item.quantity !== 'number' || typeof item.price !== 'number') {
        return res.status(400).json({ 
          error: 'Each item must have menuItemId, name, quantity, and price' 
        });
      }
      
      if (item.quantity <= 0) {
        return res.status(400).json({ 
          error: 'Item quantity must be greater than 0' 
        });
      }
      
      if (item.price < 0) {
        return res.status(400).json({ 
          error: 'Item price must be non-negative' 
        });
      }
    }
    
    // Calculate new total price
    const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Update order items and total
    const orders = await getAllOrders();
    const orderIndex = orders.findIndex(o => o.id === id);
    orders[orderIndex].items = items;
    orders[orderIndex].totalPrice = totalPrice;
    orders[orderIndex].updatedAt = Date.now();
    
    // Persist changes
    const { writeOrders } = await import('./persistenceManager.js');
    await writeOrders(orders);
    
    res.json(orders[orderIndex]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ 
      error: 'Failed to update order',
      message: error.message 
    });
  }
});

/**
 * PUT /api/orders/:id/status - Update order status
 * Requirements: 4.3, 4.4, 5.2, 10.1, 10.2
 */
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sanitize input
    const sanitizedBody = dataValidator.sanitizeObject(req.body);
    const { status } = sanitizedBody;
    
    // Validate status
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ 
        error: 'Status is required and must be a string' 
      });
    }
    
    // Check if order exists
    const existingOrder = await getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ 
        error: 'Order not found' 
      });
    }
    
    // Validate status transition
    const transitionValidation = dataValidator.validateStatusTransition(existingOrder.status, status);
    if (!transitionValidation.valid) {
      return res.status(400).json(dataValidator.createValidationErrorResponse(transitionValidation.errors));
    }
    
    // Update order status
    const updatedOrder = await updateOrderStatus(id, status);
    
    // Broadcast order status change to all connected clients
    broadcastEvent('orderStatusUpdate', updatedOrder);
    
    // Broadcast metrics update
    await broadcastMetricsUpdate();
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      error: 'Failed to update order status',
      message: error.message 
    });
  }
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Initialize WebSocket server
initializeWebSocketServer(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`QR Restaurant Ordering System server running on http://localhost:${PORT}`);
});

export default app;
export { httpServer };
