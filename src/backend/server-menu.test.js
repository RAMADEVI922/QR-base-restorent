/**
 * Unit tests for menu management API endpoints
 * Tests Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  createMenuItem,
  getAllMenuItems,
  getMenuItemById,
  updateMenuItemDetails,
  updateMenuItemAvailability,
  deleteMenuItem
} from './menuItemService.js';

// Mock the dependencies
vi.mock('./menuItemService.js');

// Create a test app instance
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Menu Management Endpoints
  app.post('/api/menu-items', async (req, res) => {
    try {
      const { name, description, price } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ 
          error: 'Name is required and must be a string' 
        });
      }
      
      if (description === undefined || typeof description !== 'string') {
        return res.status(400).json({ 
          error: 'Description is required and must be a string' 
        });
      }
      
      if (price === undefined || typeof price !== 'number' || price < 0) {
        return res.status(400).json({ 
          error: 'Price is required and must be a non-negative number' 
        });
      }
      
      const menuItem = await createMenuItem(name, description, price);
      
      res.status(201).json(menuItem);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to create menu item',
        message: error.message 
      });
    }
  });

  app.get('/api/menu-items', async (req, res) => {
    try {
      const menuItems = await getAllMenuItems();
      res.json(menuItems);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to retrieve menu items',
        message: error.message 
      });
    }
  });

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
      res.status(500).json({ 
        error: 'Failed to retrieve menu item',
        message: error.message 
      });
    }
  });

  app.put('/api/menu-items/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, available } = req.body;
      
      const existingMenuItem = await getMenuItemById(id);
      if (!existingMenuItem) {
        return res.status(404).json({ 
          error: 'Menu item not found' 
        });
      }
      
      let updatedMenuItem;
      
      if (available !== undefined) {
        if (typeof available !== 'boolean') {
          return res.status(400).json({ 
            error: 'Available must be a boolean' 
          });
        }
        updatedMenuItem = await updateMenuItemAvailability(id, available);
      }
      
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) updates.price = price;
      
      if (Object.keys(updates).length > 0) {
        updatedMenuItem = await updateMenuItemDetails(id, updates);
      }
      
      if (available !== undefined && Object.keys(updates).length > 0) {
        updatedMenuItem = await getMenuItemById(id);
      }
      
      res.json(updatedMenuItem);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to update menu item',
        message: error.message 
      });
    }
  });

  app.delete('/api/menu-items/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingMenuItem = await getMenuItemById(id);
      if (!existingMenuItem) {
        return res.status(404).json({ 
          error: 'Menu item not found' 
        });
      }
      
      const deletedMenuItem = await deleteMenuItem(id);
      
      res.json(deletedMenuItem);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to delete menu item',
        message: error.message 
      });
    }
  });

  return app;
}

describe('Menu Management API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('POST /api/menu-items', () => {
    it('should create a new menu item with valid data', async () => {
      const mockMenuItem = {
        id: 'menu-item-uuid',
        name: 'Burger',
        description: 'Delicious beef burger',
        price: 1200,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      createMenuItem.mockResolvedValue(mockMenuItem);

      const response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Delicious beef burger', price: 1200 })
        .expect(201);

      expect(response.body).toEqual(mockMenuItem);
      expect(createMenuItem).toHaveBeenCalledWith('Burger', 'Delicious beef burger', 1200);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/menu-items')
        .send({ description: 'Test', price: 1000 })
        .expect(400);

      expect(response.body.error).toBe('Name is required and must be a string');
    });

    it('should return 400 if description is missing', async () => {
      const response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', price: 1000 })
        .expect(400);

      expect(response.body.error).toBe('Description is required and must be a string');
    });

    it('should return 400 if price is missing', async () => {
      const response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Test' })
        .expect(400);

      expect(response.body.error).toBe('Price is required and must be a non-negative number');
    });

    it('should return 400 if price is negative', async () => {
      const response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Test', price: -100 })
        .expect(400);

      expect(response.body.error).toBe('Price is required and must be a non-negative number');
    });

    it('should return 500 if menu item creation fails', async () => {
      createMenuItem.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/menu-items')
        .send({ name: 'Burger', description: 'Test', price: 1000 })
        .expect(500);

      expect(response.body.error).toBe('Failed to create menu item');
    });
  });

  describe('GET /api/menu-items', () => {
    it('should return all menu items', async () => {
      const mockMenuItems = [
        { id: 'item-1', name: 'Burger', price: 1200, available: true },
        { id: 'item-2', name: 'Pizza', price: 1500, available: false }
      ];

      getAllMenuItems.mockResolvedValue(mockMenuItems);

      const response = await request(app)
        .get('/api/menu-items')
        .expect(200);

      expect(response.body).toEqual(mockMenuItems);
      expect(getAllMenuItems).toHaveBeenCalled();
    });

    it('should return empty array if no menu items exist', async () => {
      getAllMenuItems.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/menu-items')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 500 if retrieval fails', async () => {
      getAllMenuItems.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/menu-items')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve menu items');
    });
  });

  describe('GET /api/menu-items/:id', () => {
    it('should return menu item by ID', async () => {
      const mockMenuItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious beef burger',
        price: 1200,
        available: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      getMenuItemById.mockResolvedValue(mockMenuItem);

      const response = await request(app)
        .get('/api/menu-items/item-1')
        .expect(200);

      expect(response.body).toEqual(mockMenuItem);
      expect(getMenuItemById).toHaveBeenCalledWith('item-1');
    });

    it('should return 404 if menu item not found', async () => {
      getMenuItemById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/menu-items/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Menu item not found');
    });

    it('should return 500 if retrieval fails', async () => {
      getMenuItemById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/menu-items/item-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve menu item');
    });
  });

  describe('PUT /api/menu-items/:id', () => {
    it('should update menu item details', async () => {
      const mockMenuItem = {
        id: 'item-1',
        name: 'Burger',
        description: 'Delicious beef burger',
        price: 1200,
        available: true
      };

      const updatedMenuItem = { ...mockMenuItem, name: 'Cheeseburger', price: 1300 };

      getMenuItemById.mockResolvedValue(mockMenuItem);
      updateMenuItemDetails.mockResolvedValue(updatedMenuItem);

      const response = await request(app)
        .put('/api/menu-items/item-1')
        .send({ name: 'Cheeseburger', price: 1300 })
        .expect(200);

      expect(response.body).toEqual(updatedMenuItem);
      expect(updateMenuItemDetails).toHaveBeenCalledWith('item-1', { name: 'Cheeseburger', price: 1300 });
    });

    it('should update menu item availability', async () => {
      const mockMenuItem = {
        id: 'item-1',
        name: 'Burger',
        price: 1200,
        available: true
      };

      const updatedMenuItem = { ...mockMenuItem, available: false };

      getMenuItemById.mockResolvedValue(mockMenuItem);
      updateMenuItemAvailability.mockResolvedValue(updatedMenuItem);

      const response = await request(app)
        .put('/api/menu-items/item-1')
        .send({ available: false })
        .expect(200);

      expect(response.body).toEqual(updatedMenuItem);
      expect(updateMenuItemAvailability).toHaveBeenCalledWith('item-1', false);
    });

    it('should return 400 if available is not a boolean', async () => {
      const mockMenuItem = { id: 'item-1', name: 'Burger', available: true };
      getMenuItemById.mockResolvedValue(mockMenuItem);

      const response = await request(app)
        .put('/api/menu-items/item-1')
        .send({ available: 'yes' })
        .expect(400);

      expect(response.body.error).toBe('Available must be a boolean');
    });

    it('should return 404 if menu item not found', async () => {
      getMenuItemById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/menu-items/nonexistent')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.error).toBe('Menu item not found');
    });

    it('should return 500 if update fails', async () => {
      const mockMenuItem = { id: 'item-1', name: 'Burger' };
      getMenuItemById.mockResolvedValue(mockMenuItem);
      updateMenuItemDetails.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/menu-items/item-1')
        .send({ name: 'Updated' })
        .expect(500);

      expect(response.body.error).toBe('Failed to update menu item');
    });
  });

  describe('DELETE /api/menu-items/:id', () => {
    it('should delete a menu item', async () => {
      const mockMenuItem = {
        id: 'item-1',
        name: 'Burger',
        price: 1200,
        available: true
      };

      getMenuItemById.mockResolvedValue(mockMenuItem);
      deleteMenuItem.mockResolvedValue(mockMenuItem);

      const response = await request(app)
        .delete('/api/menu-items/item-1')
        .expect(200);

      expect(response.body).toEqual(mockMenuItem);
      expect(deleteMenuItem).toHaveBeenCalledWith('item-1');
    });

    it('should return 404 if menu item not found', async () => {
      getMenuItemById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/menu-items/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Menu item not found');
    });

    it('should return 500 if deletion fails', async () => {
      const mockMenuItem = { id: 'item-1', name: 'Burger' };
      getMenuItemById.mockResolvedValue(mockMenuItem);
      deleteMenuItem.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/menu-items/item-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to delete menu item');
    });
  });
});
