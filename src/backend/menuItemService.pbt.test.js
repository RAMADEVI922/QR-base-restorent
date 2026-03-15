/**
 * Property-Based Tests for Menu Item Service
 * Validates correctness properties across all inputs using fast-check
 * 
 * Feature: qr-restaurant-ordering
 * Validates: Requirements 2.1, 2.2, 2.5, 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
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

// Arbitraries for generating test data
const menuItemNameArbitrary = fc.stringMatching(/^[A-Z][a-zA-Z\s]{2,30}$/);
const menuItemDescriptionArbitrary = fc.stringMatching(/^[A-Z][a-zA-Z\s,\.]{5,100}$/);
const priceArbitrary = fc.integer({ min: 0, max: 100000 });

const menuItemDataArbitrary = fc.record({
  name: menuItemNameArbitrary,
  description: menuItemDescriptionArbitrary,
  price: priceArbitrary
});

describe('Menu Item Service - Property-Based Tests', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  describe('Property 4: Menu Display Completeness', () => {
    it('should display all available menu items with complete details', async () => {
      // Feature: qr-restaurant-ordering, Property 4: Menu Display Completeness
      // **Validates: Requirements 2.1, 2.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 1, maxLength: 50 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            const createdItems = [];
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              createdItems.push(item);
            }
            
            // Get available menu items
            const availableItems = await getAvailableMenuItems();
            
            // Verify all items are displayed
            expect(availableItems).toHaveLength(createdItems.length);
            
            // Verify each item has complete details
            for (const item of availableItems) {
              expect(item).toHaveProperty('id');
              expect(item).toHaveProperty('name');
              expect(item).toHaveProperty('description');
              expect(item).toHaveProperty('price');
              expect(item).toHaveProperty('available');
              
              // Verify name, description, price are present
              expect(typeof item.name).toBe('string');
              expect(item.name.length).toBeGreaterThan(0);
              expect(typeof item.description).toBe('string');
              expect(typeof item.price).toBe('number');
              expect(item.price).toBeGreaterThanOrEqual(0);
              expect(item.available).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display only available items when some are unavailable', async () => {
      // Feature: qr-restaurant-ordering, Property 4: Menu Display Completeness
      // **Validates: Requirements 2.1, 2.2**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 2, maxLength: 20 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            const createdItems = [];
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              createdItems.push(item);
            }
            
            // Mark some items as unavailable
            const itemsToMarkUnavailable = createdItems.slice(0, Math.ceil(createdItems.length / 2));
            for (const item of itemsToMarkUnavailable) {
              await updateMenuItemAvailability(item.id, false);
            }
            
            // Get available menu items
            const availableItems = await getAvailableMenuItems();
            
            // Verify only available items are displayed
            const expectedAvailableCount = createdItems.length - itemsToMarkUnavailable.length;
            expect(availableItems).toHaveLength(expectedAvailableCount);
            
            // Verify unavailable items are not in the list
            const availableIds = availableItems.map(i => i.id);
            for (const unavailableItem of itemsToMarkUnavailable) {
              expect(availableIds).not.toContain(unavailableItem.id);
            }
            
            // Verify all returned items are marked as available
            for (const item of availableItems) {
              expect(item.available).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Unavailable Items Cannot Be Selected', () => {
    it('should prevent unavailable items from being in available list', async () => {
      // Feature: qr-restaurant-ordering, Property 7: Unavailable Items Cannot Be Selected
      // **Validates: Requirements 2.5, 9.4**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 1, maxLength: 30 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            const createdItems = [];
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              createdItems.push(item);
            }
            
            // Mark all items as unavailable
            for (const item of createdItems) {
              await updateMenuItemAvailability(item.id, false);
            }
            
            // Get available menu items
            const availableItems = await getAvailableMenuItems();
            
            // Verify no unavailable items are in the available list
            expect(availableItems).toHaveLength(0);
            
            // Verify all items still exist but are unavailable
            const allItems = await getAllMenuItems();
            expect(allItems).toHaveLength(createdItems.length);
            for (const item of allItems) {
              expect(item.available).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should immediately reflect availability changes', async () => {
      // Feature: qr-restaurant-ordering, Property 7: Unavailable Items Cannot Be Selected
      // **Validates: Requirements 2.5, 9.4**
      
      await fc.assert(
        fc.asyncProperty(
          menuItemDataArbitrary,
          async (itemData) => {
            await clearAllData();
            
            // Create menu item (available by default)
            const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
            
            // Verify item is available
            let availableItems = await getAvailableMenuItems();
            expect(availableItems.map(i => i.id)).toContain(item.id);
            
            // Mark as unavailable
            await updateMenuItemAvailability(item.id, false);
            
            // Verify item is no longer available
            availableItems = await getAvailableMenuItems();
            expect(availableItems.map(i => i.id)).not.toContain(item.id);
            
            // Mark as available again
            await updateMenuItemAvailability(item.id, true);
            
            // Verify item is available again
            availableItems = await getAvailableMenuItems();
            expect(availableItems.map(i => i.id)).toContain(item.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 32: Menu Item Creation', () => {
    it('should create menu items with all required fields', async () => {
      // Feature: qr-restaurant-ordering, Property 32: Menu Item Creation
      // **Validates: Requirements 9.1**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 1, maxLength: 50 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              
              // Verify item was created with correct data
              expect(item.id).toBeDefined();
              expect(typeof item.id).toBe('string');
              expect(item.id.length).toBeGreaterThan(0);
              
              expect(item.name).toBe(itemData.name.trim());
              expect(item.description).toBe(itemData.description.trim());
              expect(item.price).toBe(itemData.price);
              expect(item.available).toBe(true);
              
              expect(item.createdAt).toBeDefined();
              expect(typeof item.createdAt).toBe('number');
              expect(item.updatedAt).toBeDefined();
              expect(typeof item.updatedAt).toBe('number');
            }
            
            // Verify all items are persisted
            const allItems = await getAllMenuItems();
            expect(allItems).toHaveLength(menuItemsData.length);
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should generate unique IDs for all created items', async () => {
      // Feature: qr-restaurant-ordering, Property 32: Menu Item Creation
      // **Validates: Requirements 9.1**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 2, maxLength: 50 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            const createdItems = [];
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              createdItems.push(item);
            }
            
            // Extract all IDs
            const ids = createdItems.map(i => i.id);
            
            // Verify all IDs are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should make created items available for selection by default', async () => {
      // Feature: qr-restaurant-ordering, Property 32: Menu Item Creation
      // **Validates: Requirements 9.1**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 1, maxLength: 30 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            const createdItems = [];
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              createdItems.push(item);
            }
            
            // Verify all items are available
            const availableItems = await getAvailableMenuItems();
            expect(availableItems).toHaveLength(createdItems.length);
            
            // Verify each created item is in available list
            const availableIds = availableItems.map(i => i.id);
            for (const item of createdItems) {
              expect(availableIds).toContain(item.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Property 33: Menu Item Update Persistence', () => {
    it('should persist all menu item updates to storage', async () => {
      // Feature: qr-restaurant-ordering, Property 33: Menu Item Update Persistence
      // **Validates: Requirements 9.2**
      
      await fc.assert(
        fc.asyncProperty(
          menuItemDataArbitrary,
          menuItemDataArbitrary,
          async (originalData, updateData) => {
            await clearAllData();
            
            // Create menu item
            const item = await createMenuItem(originalData.name, originalData.description, originalData.price);
            
            // Update menu item
            const updated = await updateMenuItemDetails(item.id, {
              name: updateData.name,
              description: updateData.description,
              price: updateData.price
            });
            
            // Verify updates are applied
            expect(updated.name).toBe(updateData.name.trim());
            expect(updated.description).toBe(updateData.description.trim());
            expect(updated.price).toBe(updateData.price);
            
            // Retrieve from storage and verify persistence
            const retrieved = await getMenuItemById(item.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved.name).toBe(updateData.name.trim());
            expect(retrieved.description).toBe(updateData.description.trim());
            expect(retrieved.price).toBe(updateData.price);
            expect(retrieved.id).toBe(item.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist partial updates correctly', async () => {
      // Feature: qr-restaurant-ordering, Property 33: Menu Item Update Persistence
      // **Validates: Requirements 9.2**
      
      await fc.assert(
        fc.asyncProperty(
          menuItemDataArbitrary,
          fc.oneof(
            fc.record({ name: menuItemNameArbitrary }),
            fc.record({ description: menuItemDescriptionArbitrary }),
            fc.record({ price: priceArbitrary })
          ),
          async (originalData, partialUpdate) => {
            await clearAllData();
            
            // Create menu item
            const item = await createMenuItem(originalData.name, originalData.description, originalData.price);
            
            // Update with partial data
            const updated = await updateMenuItemDetails(item.id, partialUpdate);
            
            // Retrieve from storage
            const retrieved = await getMenuItemById(item.id);
            
            // Verify updated fields are persisted
            if (partialUpdate.name !== undefined) {
              expect(retrieved.name).toBe(partialUpdate.name.trim());
            } else {
              expect(retrieved.name).toBe(originalData.name.trim());
            }
            
            if (partialUpdate.description !== undefined) {
              expect(retrieved.description).toBe(partialUpdate.description.trim());
            } else {
              expect(retrieved.description).toBe(originalData.description.trim());
            }
            
            if (partialUpdate.price !== undefined) {
              expect(retrieved.price).toBe(partialUpdate.price);
            } else {
              expect(retrieved.price).toBe(originalData.price);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update timestamps when persisting changes', async () => {
      // Feature: qr-restaurant-ordering, Property 33: Menu Item Update Persistence
      // **Validates: Requirements 9.2**
      
      await fc.assert(
        fc.asyncProperty(
          menuItemDataArbitrary,
          menuItemNameArbitrary,
          async (originalData, newName) => {
            await clearAllData();
            
            // Create menu item
            const item = await createMenuItem(originalData.name, originalData.description, originalData.price);
            const originalUpdatedAt = item.updatedAt;
            
            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Update menu item
            const updated = await updateMenuItemDetails(item.id, { name: newName });
            
            // Verify updatedAt changed
            expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
            
            // Verify createdAt unchanged
            expect(updated.createdAt).toBe(item.createdAt);
            
            // Verify persistence
            const retrieved = await getMenuItemById(item.id);
            expect(retrieved.updatedAt).toBe(updated.updatedAt);
            expect(retrieved.createdAt).toBe(item.createdAt);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 34: Menu Item Availability Toggle', () => {
    it('should persist availability changes immediately', async () => {
      // Feature: qr-restaurant-ordering, Property 34: Menu Item Availability Toggle
      // **Validates: Requirements 9.3**
      
      await fc.assert(
        fc.asyncProperty(
          menuItemDataArbitrary,
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          async (itemData, availabilitySequence) => {
            await clearAllData();
            
            // Create menu item
            const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
            
            // Toggle availability multiple times
            for (const available of availabilitySequence) {
              await updateMenuItemAvailability(item.id, available);
              
              // Verify persistence after each toggle
              const retrieved = await getMenuItemById(item.id);
              expect(retrieved.available).toBe(available);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should affect customer selection immediately after toggle', async () => {
      // Feature: qr-restaurant-ordering, Property 34: Menu Item Availability Toggle
      // **Validates: Requirements 9.3**
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(menuItemDataArbitrary, { minLength: 1, maxLength: 20 }),
          async (menuItemsData) => {
            await clearAllData();
            
            // Create menu items
            const createdItems = [];
            for (const itemData of menuItemsData) {
              const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
              createdItems.push(item);
            }
            
            // Verify all items are available initially
            let availableItems = await getAvailableMenuItems();
            expect(availableItems).toHaveLength(createdItems.length);
            
            // Toggle first item to unavailable
            await updateMenuItemAvailability(createdItems[0].id, false);
            
            // Verify immediate effect on available items
            availableItems = await getAvailableMenuItems();
            expect(availableItems).toHaveLength(createdItems.length - 1);
            expect(availableItems.map(i => i.id)).not.toContain(createdItems[0].id);
            
            // Toggle back to available
            await updateMenuItemAvailability(createdItems[0].id, true);
            
            // Verify immediate effect
            availableItems = await getAvailableMenuItems();
            expect(availableItems).toHaveLength(createdItems.length);
            expect(availableItems.map(i => i.id)).toContain(createdItems[0].id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update timestamps when toggling availability', async () => {
      // Feature: qr-restaurant-ordering, Property 34: Menu Item Availability Toggle
      // **Validates: Requirements 9.3**
      
      await fc.assert(
        fc.asyncProperty(
          menuItemDataArbitrary,
          async (itemData) => {
            await clearAllData();
            
            // Create menu item
            const item = await createMenuItem(itemData.name, itemData.description, itemData.price);
            const originalUpdatedAt = item.updatedAt;
            
            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Toggle availability
            const updated = await updateMenuItemAvailability(item.id, false);
            
            // Verify updatedAt changed
            expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
            
            // Verify createdAt unchanged
            expect(updated.createdAt).toBe(item.createdAt);
            
            // Verify persistence
            const retrieved = await getMenuItemById(item.id);
            expect(retrieved.updatedAt).toBe(updated.updatedAt);
            expect(retrieved.available).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
