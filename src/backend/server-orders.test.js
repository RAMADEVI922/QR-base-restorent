/**
 * Unit tests for order management API endpoints
 * Tests Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { 
  createOrder, 
  getAllOrders, 
  getOrderById, 
  updateOrderStatus,
  getOrderQueue
} from './orderService.js';
import { writeOrders } from './persistenceManager.js';

// Mock the dependencies
vi.mock('./orderService.js');
vi.mock('./persistenceManager.js');

// Create a test app instance
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Order Management Endpoints
  app.post('/api/orders', async (req, res) => {
    try {
      const { tableId, items } = req.body;
      
      if (!tableId || typeof tableId !== 'string') {
        return res.status(400).json({ 
          error: 'Table ID is required and must be a string' 
        });
      }
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ 
          error: 'Items are required and must be an array' 
        });
      }
      
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
      
      const order = await createOrder(tableId, items);
      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to create order',
        message: error.message 
      });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to retrieve orders',
        message: error.message 
      });
    }
  });

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
      res.status(500).json({ 
        error: 'Failed to retrieve order',
        message: error.message 
      });
    }
  });

  app.put('/api/orders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { items } = req.body;
      
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
      
      const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const orders = await getAllOrders();
      const orderIndex = orders.findIndex(o => o.id === id);
      orders[orderIndex].items = items;
      orders[orderIndex].totalPrice = totalPrice;
      orders[orderIndex].updatedAt = Date.now();
      
      await writeOrders(orders);
      
      res.json(orders[orderIndex]);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to update order',
        message: error.message 
      });
    }
  });

  app.put('/api/orders/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ 
          error: 'Status is required and must be a string' 
        });
      }
      
      const existingOrder = await getOrderById(id);
      if (!existingOrder) {
        return res.status(404).json({ 
          error: 'Order not found' 
        });
      }
      
      const updatedOrder = await updateOrderStatus(id, status);
      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to update order status',
        message: error.message 
      });
    }
  });

  app.get('/api/orders/queue', async (req, res) => {
    try {
      const queue = await getOrderQueue();
      res.json(queue);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to retrieve order queue',
        message: error.message 
      });
    }
  });

  return app;
}

describe('Order Management API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('POST /api/orders', () => {
    it('should create a new order with valid data', async () => {
      const mockOrder = {
        id: 'order-uuid',
        tableId: 'table-1',
        items: [
          { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 }
        ],
        status: 'pending',
        totalPrice: 2000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      createOrder.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/api/orders')
        .send({
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 }
          ]
        })
        .expect(201);

      expect(response.body).toEqual(mockOrder);
      expect(createOrder).toHaveBeenCalledWith('table-1', [
        { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 }
      ]);
    });

    it('should return 400 if tableId is missing', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ items: [] })
        .expect(400);

      expect(response.body.error).toBe('Table ID is required and must be a string');
    });

    it('should return 400 if items is not an array', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ tableId: 'table-1', items: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toBe('Items are required and must be an array');
    });

    it('should return 400 if item is missing required fields', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          tableId: 'table-1',
          items: [{ menuItemId: 'item-1' }]
        })
        .expect(400);

      expect(response.body.error).toBe('Each item must have menuItemId, name, quantity, and price');
    });

    it('should return 400 if item quantity is invalid', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 0, price: 1000 }
          ]
        })
        .expect(400);

      expect(response.body.error).toBe('Item quantity must be greater than 0');
    });

    it('should return 400 if item price is negative', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: -100 }
          ]
        })
        .expect(400);

      expect(response.body.error).toBe('Item price must be non-negative');
    });

    it('should return 500 if order creation fails', async () => {
      createOrder.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/orders')
        .send({
          tableId: 'table-1',
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }
          ]
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to create order');
    });
  });

  describe('GET /api/orders', () => {
    it('should return all orders', async () => {
      const mockOrders = [
        { id: 'order-1', tableId: 'table-1', status: 'pending' },
        { id: 'order-2', tableId: 'table-2', status: 'preparing' }
      ];

      getAllOrders.mockResolvedValue(mockOrders);

      const response = await request(app)
        .get('/api/orders')
        .expect(200);

      expect(response.body).toEqual(mockOrders);
      expect(getAllOrders).toHaveBeenCalled();
    });

    it('should return empty array if no orders exist', async () => {
      getAllOrders.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/orders')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 500 if retrieval fails', async () => {
      getAllOrders.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/orders')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve orders');
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order by ID', async () => {
      const mockOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [{ menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }],
        status: 'pending',
        totalPrice: 1000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      getOrderById.mockResolvedValue(mockOrder);

      const response = await request(app)
        .get('/api/orders/order-1')
        .expect(200);

      expect(response.body).toEqual(mockOrder);
      expect(getOrderById).toHaveBeenCalledWith('order-1');
    });

    it('should return 404 if order not found', async () => {
      getOrderById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/orders/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Order not found');
    });

    it('should return 500 if retrieval fails', async () => {
      getOrderById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/orders/order-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve order');
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('should update order items', async () => {
      const mockOrder = {
        id: 'order-1',
        tableId: 'table-1',
        items: [{ menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }],
        status: 'pending',
        totalPrice: 1000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const updatedItems = [
        { menuItemId: 'item-1', name: 'Burger', quantity: 2, price: 1000 },
        { menuItemId: 'item-2', name: 'Fries', quantity: 1, price: 500 }
      ];

      getOrderById.mockResolvedValue(mockOrder);
      getAllOrders.mockResolvedValue([mockOrder]);
      writeOrders.mockResolvedValue();

      const response = await request(app)
        .put('/api/orders/order-1')
        .send({ items: updatedItems })
        .expect(200);

      expect(response.body.items).toEqual(updatedItems);
      expect(response.body.totalPrice).toBe(2500);
      expect(writeOrders).toHaveBeenCalled();
    });

    it('should return 404 if order not found', async () => {
      getOrderById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/orders/nonexistent')
        .send({ items: [] })
        .expect(404);

      expect(response.body.error).toBe('Order not found');
    });

    it('should return 400 if items is not an array', async () => {
      const mockOrder = { id: 'order-1', status: 'pending' };
      getOrderById.mockResolvedValue(mockOrder);

      const response = await request(app)
        .put('/api/orders/order-1')
        .send({ items: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toBe('Items are required and must be an array');
    });

    it('should return 500 if update fails', async () => {
      const mockOrder = { id: 'order-1', status: 'pending' };
      getOrderById.mockResolvedValue(mockOrder);
      getAllOrders.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/orders/order-1')
        .send({
          items: [
            { menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }
          ]
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to update order');
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('should update order status', async () => {
      const mockOrder = {
        id: 'order-1',
        tableId: 'table-1',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const updatedOrder = { ...mockOrder, status: 'preparing' };

      getOrderById.mockResolvedValue(mockOrder);
      updateOrderStatus.mockResolvedValue(updatedOrder);

      const response = await request(app)
        .put('/api/orders/order-1/status')
        .send({ status: 'preparing' })
        .expect(200);

      expect(response.body).toEqual(updatedOrder);
      expect(updateOrderStatus).toHaveBeenCalledWith('order-1', 'preparing');
    });

    it('should return 400 if status is missing', async () => {
      const response = await request(app)
        .put('/api/orders/order-1/status')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Status is required and must be a string');
    });

    it('should return 404 if order not found', async () => {
      getOrderById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/orders/nonexistent/status')
        .send({ status: 'preparing' })
        .expect(404);

      expect(response.body.error).toBe('Order not found');
    });

    it('should return 500 if status update fails', async () => {
      const mockOrder = { id: 'order-1', status: 'pending' };
      getOrderById.mockResolvedValue(mockOrder);
      updateOrderStatus.mockRejectedValue(new Error('Invalid status transition'));

      const response = await request(app)
        .put('/api/orders/order-1/status')
        .send({ status: 'completed' })
        .expect(500);

      expect(response.body.error).toBe('Failed to update order status');
    });
  });

  describe('GET /api/orders/queue', () => {
    it('should return active orders sorted by time', async () => {
      const mockQueue = [
        {
          id: 'order-1',
          tableId: 'table-1',
          status: 'pending',
          items: [{ menuItemId: 'item-1', name: 'Burger', quantity: 1, price: 1000 }],
          totalPrice: 1000,
          createdAt: 1000,
          updatedAt: 1000
        },
        {
          id: 'order-2',
          tableId: 'table-2',
          status: 'preparing',
          items: [{ menuItemId: 'item-2', name: 'Pizza', quantity: 1, price: 1500 }],
          totalPrice: 1500,
          createdAt: 2000,
          updatedAt: 2000
        }
      ];

      getOrderQueue.mockResolvedValue(mockQueue);

      const response = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(response.body).toEqual(mockQueue);
      expect(getOrderQueue).toHaveBeenCalled();
    });

    it('should return empty array if no active orders exist', async () => {
      getOrderQueue.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 500 if queue retrieval fails', async () => {
      getOrderQueue.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/orders/queue')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve order queue');
    });

    it('should include table identifiers in queue orders', async () => {
      const mockQueue = [
        {
          id: 'order-1',
          tableId: 'table-5',
          status: 'pending',
          items: [],
          totalPrice: 0,
          createdAt: 1000,
          updatedAt: 1000
        }
      ];

      getOrderQueue.mockResolvedValue(mockQueue);

      const response = await request(app)
        .get('/api/orders/queue')
        .expect(200);

      expect(response.body[0]).toHaveProperty('tableId');
      expect(response.body[0].tableId).toBe('table-5');
    });
  });
});
