/**
 * Tests for QR Code Validator Module
 * Validates QR code validation and table ID extraction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { validateQRCode, extractTableId } from './qrCodeValidator.js';
import { createTable, deleteTable, getAllTables } from './tableService.js';
import { generateQRCode } from './qrCodeGenerator.js';
import { writeTables } from './persistenceManager.js';

describe('QR Code Validator', () => {
  // Store initial tables state
  let initialTables = [];

  beforeEach(async () => {
    // Save initial state
    initialTables = await getAllTables();
  });

  afterEach(async () => {
    // Restore initial state
    await writeTables(initialTables);
  });

  describe('Unit Tests', () => {
    describe('validateQRCode', () => {
      it('should validate QR code for active table', async () => {
        // Create a table
        const qrCode = await generateQRCode('test-table-1', 'restaurant-1');
        const table = await createTable(qrCode);

        // Create QR data string
        const qrDataString = JSON.stringify({
          tableId: table.id,
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        // Validate QR code
        const result = await validateQRCode(qrDataString);

        expect(result.tableId).toBe(table.id);
        expect(result.restaurantId).toBe('restaurant-1');
      });

      it('should throw error for inactive table', async () => {
        // Create and then delete a table
        const qrCode = await generateQRCode('test-table-2', 'restaurant-1');
        const table = await createTable(qrCode);
        await deleteTable(table.id);

        // Create QR data string
        const qrDataString = JSON.stringify({
          tableId: table.id,
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        // Validate QR code should fail
        await expect(validateQRCode(qrDataString)).rejects.toThrow(
          `Table ${table.id} is not active or does not exist`
        );
      });

      it('should throw error for non-existent table', async () => {
        const qrDataString = JSON.stringify({
          tableId: 'non-existent-table',
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        await expect(validateQRCode(qrDataString)).rejects.toThrow(
          'Table non-existent-table is not active or does not exist'
        );
      });

      it('should throw error for invalid QR code data', async () => {
        await expect(validateQRCode('invalid json')).rejects.toThrow(
          'Failed to parse QR code data'
        );
      });

      it('should throw error for missing tableId in QR code', async () => {
        const qrDataString = JSON.stringify({
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        await expect(validateQRCode(qrDataString)).rejects.toThrow(
          'Invalid QR code data: missing or invalid tableId'
        );
      });

      it('should throw error for null input', async () => {
        await expect(validateQRCode(null)).rejects.toThrow(
          'Invalid QR code data'
        );
      });

      it('should throw error for empty string', async () => {
        await expect(validateQRCode('')).rejects.toThrow(
          'Invalid QR code data'
        );
      });
    });

    describe('extractTableId', () => {
      it('should extract table ID from valid QR code', () => {
        const qrDataString = JSON.stringify({
          tableId: 'table-123',
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        const tableId = extractTableId(qrDataString);

        expect(tableId).toBe('table-123');
      });

      it('should throw error for invalid QR code data', () => {
        expect(() => extractTableId('invalid json')).toThrow(
          'Failed to parse QR code data'
        );
      });

      it('should throw error for missing tableId', () => {
        const qrDataString = JSON.stringify({
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        expect(() => extractTableId(qrDataString)).toThrow(
          'Invalid QR code data: missing or invalid tableId'
        );
      });

      it('should throw error for null input', () => {
        expect(() => extractTableId(null)).toThrow(
          'Invalid QR code data'
        );
      });

      it('should throw error for empty string', () => {
        expect(() => extractTableId('')).toThrow(
          'Invalid QR code data'
        );
      });
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: qr-restaurant-ordering, Property 2: QR Code to Table Mapping
    // For any table with a valid QR code, scanning that QR code must return the correct table identifier
    it('Property 2: QR code to table mapping returns correct table ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/),
          async (tableId, restaurantId) => {
            // Generate QR code and create table
            const qrCode = await generateQRCode(tableId, restaurantId);
            const table = await createTable(qrCode);

            // Create QR data string
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });

            // Validate QR code
            const result = await validateQRCode(qrDataString);

            // Should return correct table ID
            expect(result.tableId).toBe(table.id);
            expect(result.restaurantId).toBe(restaurantId);

            // Clean up
            await deleteTable(table.id);
          }
        ),
        { numRuns: 10 }
      );
    });

    // Feature: qr-restaurant-ordering, Property 3: QR Code Validation for Active Tables
    // For any QR code, if the corresponding table is marked as inactive, the system must reject the QR code
    it('Property 3: QR code validation rejects inactive tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/),
          async (tableId, restaurantId) => {
            // Generate QR code and create table
            const qrCode = await generateQRCode(tableId, restaurantId);
            const table = await createTable(qrCode);

            // Mark table as inactive
            await deleteTable(table.id);

            // Create QR data string
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });

            // Validation should fail for inactive table
            await expect(validateQRCode(qrDataString)).rejects.toThrow(
              `Table ${table.id} is not active or does not exist`
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    // Feature: qr-restaurant-ordering, Property 40: QR Code Navigation to Menu
    // For any valid table QR code scanned by a customer, the system must navigate to the menu page for that table
    it('Property 40: Valid QR code provides table ID for navigation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/),
          async (tableId, restaurantId) => {
            // Generate QR code and create table
            const qrCode = await generateQRCode(tableId, restaurantId);
            const table = await createTable(qrCode);

            // Create QR data string
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });

            // Validate QR code
            const result = await validateQRCode(qrDataString);

            // Should provide table ID for navigation
            expect(result.tableId).toBeDefined();
            expect(typeof result.tableId).toBe('string');
            expect(result.tableId).toBe(table.id);

            // Clean up
            await deleteTable(table.id);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in table ID', async () => {
      const tableId = 'table-1-special_chars';
      const qrCode = await generateQRCode(tableId, 'restaurant-1');
      const table = await createTable(qrCode);

      const qrDataString = JSON.stringify({
        tableId: table.id,
        restaurantId: 'restaurant-1',
        version: '1.0'
      });

      const result = await validateQRCode(qrDataString);

      expect(result.tableId).toBe(table.id);

      // Clean up
      await deleteTable(table.id);
    });

    it('should handle long table IDs', async () => {
      const tableId = 'a'.repeat(50);
      const qrCode = await generateQRCode(tableId, 'restaurant-1');
      const table = await createTable(qrCode);

      const qrDataString = JSON.stringify({
        tableId: table.id,
        restaurantId: 'restaurant-1',
        version: '1.0'
      });

      const result = await validateQRCode(qrDataString);

      expect(result.tableId).toBe(table.id);

      // Clean up
      await deleteTable(table.id);
    });

    it('should validate multiple times for same table', async () => {
      const qrCode = await generateQRCode('test-table-multi', 'restaurant-1');
      const table = await createTable(qrCode);

      const qrDataString = JSON.stringify({
        tableId: table.id,
        restaurantId: 'restaurant-1',
        version: '1.0'
      });

      // Validate multiple times
      const result1 = await validateQRCode(qrDataString);
      const result2 = await validateQRCode(qrDataString);
      const result3 = await validateQRCode(qrDataString);

      expect(result1.tableId).toBe(table.id);
      expect(result2.tableId).toBe(table.id);
      expect(result3.tableId).toBe(table.id);

      // Clean up
      await deleteTable(table.id);
    });

    it('should extract table ID without validation', () => {
      const qrDataString = JSON.stringify({
        tableId: 'any-table-id',
        restaurantId: 'restaurant-1',
        version: '1.0'
      });

      const tableId = extractTableId(qrDataString);

      expect(tableId).toBe('any-table-id');
    });
  });
});
