/**
 * Tests for MenuItem Service
 * Tests CRUD operations for menu items
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMenuItem,
  getAllMenuItems,
  getMenuItemById,
  updateMenuItemDetails,
  updateMenuItemAvailability,
  deleteMenuItem,
  getAvailableMenuItems
} from './menuItemService.js';
import { clearAllData } from './persistenceManager.js';

describe('MenuItem Service', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  describe('createMenuItem', () => {
    it('should create a menu item with valid inputs', async () => {
      const item = await createMenuItem('Burger', 'Delicious burger', 1500);

      expect(item).toBeDefined();
      expect(item.id).toBeDefined();
      expect(item.name).toBe('Burger');
      expect(item.description).toBe('Delicious burger');
      expect(item.price).toBe(1500);
      expect(item.available).toBe(true);
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });

    it('should trim whitespace from name and description', async () => {
      const item = await createMenuItem('  Pizza  ', '  Cheesy pizza  ', 2000);

      expect(item.name).toBe('Pizza');
      expect(item.description).toBe('Cheesy pizza');
    });

    it('should throw error for empty name', async () => {
      await expect(createMenuItem('', 'Description', 1000)).rejects.toThrow(
        'Menu item name must be a non-empty string'
      );
    });

    it('should throw error for non-string name', async () => {
      await expect(createMenuItem(123, 'Description', 1000)).rejects.toThrow(
        'Menu item name must be a non-empty string'
      );
    });

    it('should throw error for non-string description', async () => {
      await expect(createMenuItem('Item', 123, 1000)).rejects.toThrow(
        'Menu item description must be a string'
      );
    });

    it('should throw error for negative price', async () => {
      await expect(createMenuItem('Item', 'Description', -100)).rejects.toThrow(
        'Menu item price must be a non-negative number'
      );
    });

    it('should throw error for non-number price', async () => {
      await expect(createMenuItem('Item', 'Description', 'expensive')).rejects.toThrow(
        'Menu item price must be a non-negative number'
      );
    });

    it('should persist created item to storage', async () => {
      await createMenuItem('Burger', 'Delicious burger', 1500);

      const items = await getAllMenuItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Burger');
    });

    it('should generate unique IDs for multiple items', async () => {
      const item1 = await createMenuItem('Burger', 'Description', 1500);
      const item2 = await createMenuItem('Pizza', 'Description', 2000);

      expect(item1.id).not.toBe(item2.id);
    });
  });

  describe('getAllMenuItems', () => {
    it('should return empty array when no items exist', async () => {
      const items = await getAllMenuItems();
      expect(items).toEqual([]);
    });

    it('should return all created items', async () => {
      await createMenuItem('Burger', 'Description', 1500);
      await createMenuItem('Pizza', 'Description', 2000);
      await createMenuItem('Salad', 'Description', 1000);

      const items = await getAllMenuItems();
      expect(items).toHaveLength(3);
    });

    it('should return items with all properties', async () => {
      await createMenuItem('Burger', 'Delicious burger', 1500);

      const items = await getAllMenuItems();
      const item = items[0];

      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('available');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('updatedAt');
    });
  });

  describe('getMenuItemById', () => {
    it('should return null for non-existent item', async () => {
      const item = await getMenuItemById('non-existent-id');
      expect(item).toBeNull();
    });

    it('should return item by ID', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const item = await getMenuItemById(created.id);
      expect(item).toBeDefined();
      expect(item.id).toBe(created.id);
      expect(item.name).toBe('Burger');
    });

    it('should throw error for invalid ID', async () => {
      await expect(getMenuItemById('')).rejects.toThrow(
        'Menu item ID must be a non-empty string'
      );
    });

    it('should throw error for non-string ID', async () => {
      await expect(getMenuItemById(123)).rejects.toThrow(
        'Menu item ID must be a non-empty string'
      );
    });
  });

  describe('updateMenuItemDetails', () => {
    it('should update menu item name', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const updated = await updateMenuItemDetails(created.id, { name: 'Cheeseburger' });

      expect(updated.name).toBe('Cheeseburger');
      expect(updated.description).toBe('Description');
      expect(updated.price).toBe(1500);
    });

    it('should update menu item description', async () => {
      const created = await createMenuItem('Burger', 'Old description', 1500);

      const updated = await updateMenuItemDetails(created.id, {
        description: 'New description'
      });

      expect(updated.description).toBe('New description');
      expect(updated.name).toBe('Burger');
    });

    it('should update menu item price', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const updated = await updateMenuItemDetails(created.id, { price: 1800 });

      expect(updated.price).toBe(1800);
    });

    it('should update multiple fields at once', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const updated = await updateMenuItemDetails(created.id, {
        name: 'Premium Burger',
        description: 'Premium description',
        price: 2500
      });

      expect(updated.name).toBe('Premium Burger');
      expect(updated.description).toBe('Premium description');
      expect(updated.price).toBe(2500);
    });

    it('should update updatedAt timestamp', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);
      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await updateMenuItemDetails(created.id, { name: 'New Name' });

      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should persist updates to storage', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      await updateMenuItemDetails(created.id, { name: 'Updated Burger' });

      const retrieved = await getMenuItemById(created.id);
      expect(retrieved.name).toBe('Updated Burger');
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        updateMenuItemDetails('non-existent-id', { name: 'New Name' })
      ).rejects.toThrow('Menu item with ID non-existent-id not found');
    });

    it('should throw error for invalid name', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      await expect(
        updateMenuItemDetails(created.id, { name: '' })
      ).rejects.toThrow('Menu item name must be a non-empty string');
    });

    it('should throw error for invalid price', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      await expect(
        updateMenuItemDetails(created.id, { price: -100 })
      ).rejects.toThrow('Menu item price must be a non-negative number');
    });

    it('should trim whitespace from updated name', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const updated = await updateMenuItemDetails(created.id, { name: '  New Name  ' });

      expect(updated.name).toBe('New Name');
    });
  });

  describe('updateMenuItemAvailability', () => {
    it('should mark item as unavailable', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const updated = await updateMenuItemAvailability(created.id, false);

      expect(updated.available).toBe(false);
    });

    it('should mark item as available', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);
      await updateMenuItemAvailability(created.id, false);

      const updated = await updateMenuItemAvailability(created.id, true);

      expect(updated.available).toBe(true);
    });

    it('should update updatedAt timestamp', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);
      const originalUpdatedAt = created.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await updateMenuItemAvailability(created.id, false);

      expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should persist availability change to storage', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      await updateMenuItemAvailability(created.id, false);

      const retrieved = await getMenuItemById(created.id);
      expect(retrieved.available).toBe(false);
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        updateMenuItemAvailability('non-existent-id', false)
      ).rejects.toThrow('Menu item with ID non-existent-id not found');
    });

    it('should throw error for non-boolean availability', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      await expect(
        updateMenuItemAvailability(created.id, 'false')
      ).rejects.toThrow('Availability must be a boolean');
    });

    it('should throw error for invalid ID', async () => {
      await expect(updateMenuItemAvailability('', true)).rejects.toThrow(
        'Menu item ID must be a non-empty string'
      );
    });
  });

  describe('deleteMenuItem', () => {
    it('should delete a menu item', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      const deleted = await deleteMenuItem(created.id);

      expect(deleted.id).toBe(created.id);
      expect(deleted.name).toBe('Burger');
    });

    it('should remove item from storage', async () => {
      const created = await createMenuItem('Burger', 'Description', 1500);

      await deleteMenuItem(created.id);

      const items = await getAllMenuItems();
      expect(items).toHaveLength(0);
    });

    it('should not affect other items', async () => {
      const item1 = await createMenuItem('Burger', 'Description', 1500);
      const item2 = await createMenuItem('Pizza', 'Description', 2000);

      await deleteMenuItem(item1.id);

      const items = await getAllMenuItems();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(item2.id);
    });

    it('should throw error for non-existent item', async () => {
      await expect(deleteMenuItem('non-existent-id')).rejects.toThrow(
        'Menu item with ID non-existent-id not found'
      );
    });

    it('should throw error for invalid ID', async () => {
      await expect(deleteMenuItem('')).rejects.toThrow(
        'Menu item ID must be a non-empty string'
      );
    });
  });

  describe('getAvailableMenuItems', () => {
    it('should return empty array when no items exist', async () => {
      const items = await getAvailableMenuItems();
      expect(items).toEqual([]);
    });

    it('should return only available items', async () => {
      const item1 = await createMenuItem('Burger', 'Description', 1500);
      const item2 = await createMenuItem('Pizza', 'Description', 2000);
      const item3 = await createMenuItem('Salad', 'Description', 1000);

      await updateMenuItemAvailability(item2.id, false);

      const available = await getAvailableMenuItems();

      expect(available).toHaveLength(2);
      expect(available.map(i => i.id)).toContain(item1.id);
      expect(available.map(i => i.id)).toContain(item3.id);
      expect(available.map(i => i.id)).not.toContain(item2.id);
    });

    it('should return all items when all are available', async () => {
      await createMenuItem('Burger', 'Description', 1500);
      await createMenuItem('Pizza', 'Description', 2000);
      await createMenuItem('Salad', 'Description', 1000);

      const available = await getAvailableMenuItems();

      expect(available).toHaveLength(3);
    });
  });
});
