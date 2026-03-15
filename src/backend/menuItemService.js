/**
 * MenuItem Service for menu item CRUD operations
 * Handles creation, retrieval, update, and deletion of menu items
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { readMenuItems, writeMenuItems } from './persistenceManager.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new menu item
 * @param {string} name - Item name
 * @param {string} description - Item description
 * @param {number} price - Item price in cents
 * @returns {Promise<Object>} - Created menu item object
 * @throws {Error} - If validation fails
 */
export async function createMenuItem(name, description, price) {
  // Validate inputs
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Menu item name must be a non-empty string');
  }
  if (typeof description !== 'string') {
    throw new Error('Menu item description must be a string');
  }
  if (typeof price !== 'number' || price < 0) {
    throw new Error('Menu item price must be a non-negative number');
  }

  const now = Date.now();
  const menuItem = {
    id: uuidv4(),
    name: name.trim(),
    description: description.trim(),
    price,
    available: true,
    createdAt: now,
    updatedAt: now
  };

  // Read existing items
  const menuItems = await readMenuItems();

  // Add new item
  menuItems.push(menuItem);

  // Write back to storage
  await writeMenuItems(menuItems);

  return menuItem;
}

/**
 * Retrieves all menu items
 * @returns {Promise<Array>} - Array of all menu items
 */
export async function getAllMenuItems() {
  return readMenuItems();
}

/**
 * Retrieves a menu item by ID
 * @param {string} id - Menu item ID
 * @returns {Promise<Object|null>} - Menu item object or null if not found
 */
export async function getMenuItemById(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Menu item ID must be a non-empty string');
  }

  const menuItems = await readMenuItems();
  return menuItems.find(item => item.id === id) || null;
}

/**
 * Updates a menu item's details (name, description, price)
 * @param {string} id - Menu item ID
 * @param {Object} updates - Object containing fields to update (name, description, price)
 * @returns {Promise<Object>} - Updated menu item object
 * @throws {Error} - If menu item not found or validation fails
 */
export async function updateMenuItemDetails(id, updates) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Menu item ID must be a non-empty string');
  }
  if (!updates || typeof updates !== 'object') {
    throw new Error('Updates must be an object');
  }

  // Validate update fields
  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || !updates.name.trim()) {
      throw new Error('Menu item name must be a non-empty string');
    }
  }
  if (updates.description !== undefined) {
    if (typeof updates.description !== 'string') {
      throw new Error('Menu item description must be a string');
    }
  }
  if (updates.price !== undefined) {
    if (typeof updates.price !== 'number' || updates.price < 0) {
      throw new Error('Menu item price must be a non-negative number');
    }
  }

  const menuItems = await readMenuItems();
  const itemIndex = menuItems.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    throw new Error(`Menu item with ID ${id} not found`);
  }

  const menuItem = menuItems[itemIndex];

  // Apply updates
  if (updates.name !== undefined) {
    menuItem.name = updates.name.trim();
  }
  if (updates.description !== undefined) {
    menuItem.description = updates.description.trim();
  }
  if (updates.price !== undefined) {
    menuItem.price = updates.price;
  }

  menuItem.updatedAt = Date.now();

  // Write back to storage
  await writeMenuItems(menuItems);

  return menuItem;
}

/**
 * Updates a menu item's availability status
 * @param {string} id - Menu item ID
 * @param {boolean} available - Availability status
 * @returns {Promise<Object>} - Updated menu item object
 * @throws {Error} - If menu item not found or validation fails
 */
export async function updateMenuItemAvailability(id, available) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Menu item ID must be a non-empty string');
  }
  if (typeof available !== 'boolean') {
    throw new Error('Availability must be a boolean');
  }

  const menuItems = await readMenuItems();
  const itemIndex = menuItems.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    throw new Error(`Menu item with ID ${id} not found`);
  }

  const menuItem = menuItems[itemIndex];
  menuItem.available = available;
  menuItem.updatedAt = Date.now();

  // Write back to storage
  await writeMenuItems(menuItems);

  return menuItem;
}

/**
 * Deletes a menu item (soft delete - marks as unavailable)
 * @param {string} id - Menu item ID
 * @returns {Promise<Object>} - Deleted menu item object
 * @throws {Error} - If menu item not found
 */
export async function deleteMenuItem(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Menu item ID must be a non-empty string');
  }

  const menuItems = await readMenuItems();
  const itemIndex = menuItems.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    throw new Error(`Menu item with ID ${id} not found`);
  }

  // Soft delete: mark as unavailable and remove from array
  const deletedItem = menuItems.splice(itemIndex, 1)[0];

  // Write back to storage
  await writeMenuItems(menuItems);

  return deletedItem;
}

/**
 * Retrieves all available menu items
 * @returns {Promise<Array>} - Array of available menu items
 */
export async function getAvailableMenuItems() {
  const menuItems = await readMenuItems();
  return menuItems.filter(item => item.available);
}
