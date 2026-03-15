/**
 * Property-Based Tests for QR Code Operations
 * Validates QR code generation, validation, and table mapping across all inputs
 * 
 * Feature: qr-restaurant-ordering
 * Validates: Requirements 1.2, 1.4, 11.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { generateQRCode, parseQRCodeData } from './qrCodeGenerator.js';
import { validateQRCode, extractTableId } from './qrCodeValidator.js';
import { createTable, deleteTable, getAllTables } from './tableService.js';
import { clearAllData, writeTables } from './persistenceManager.js';

// Arbitraries for generating test data
const tableIdArbitrary = fc.uuid();
const restaurantIdArbitrary = fc.stringMatching(/^[a-zA-Z0-9-]+$/);

describe.sequential('QR Code Operations - Property-Based Tests', () => {
  let initialTables = [];

  beforeEach(async () => {
    // Save initial state
    initialTables = await getAllTables();
    await clearAllData();
    // Small delay to ensure file system operations complete
    await new Promise(resolve => setTimeout(resolve, 50));
  }, 10000);

  afterEach(async () => {
    // Restore initial state
    await writeTables(initialTables);
    await new Promise(resolve => setTimeout(resolve, 50));
  }, 10000);

  describe('Property 2: QR Code to Table Mapping', () => {
    /**
     * **Validates: Requirements 1.2**
     * 
     * For any table with a valid QR code, scanning that QR code must return 
     * the correct table identifier and associate subsequent orders with that table.
     */
    it('should correctly map QR code to table identifier', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Generate QR code for the table
            const qrCode = await generateQRCode(tableId, restaurantId);
            
            // Create table with the QR code
            const table = await createTable(qrCode);
            
            // Create QR data string (simulating scanning)
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });
            
            // Validate QR code and extract table information
            const result = await validateQRCode(qrDataString);
            
            // Verify correct table identifier is returned
            expect(result.tableId).toBe(table.id);
            expect(result.restaurantId).toBe(restaurantId);
            
            // Clean up
            await deleteTable(table.id);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should maintain table mapping consistency across multiple scans', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          fc.integer({ min: 2, max: 5 }),
          async (tableId, restaurantId, scanCount) => {
            // Generate QR code and create table
            const qrCode = await generateQRCode(tableId, restaurantId);
            const table = await createTable(qrCode);
            
            // Create QR data string
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });
            
            // Scan multiple times
            const results = [];
            for (let i = 0; i < scanCount; i++) {
              results.push(await validateQRCode(qrDataString));
            }
            
            // Verify all scans return the same table ID
            results.forEach(result => {
              expect(result.tableId).toBe(table.id);
              expect(result.restaurantId).toBe(restaurantId);
            });
            
            // Clean up
            await deleteTable(table.id);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should correctly extract table ID without full validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Create QR data string (no need to create actual table)
            const qrDataString = JSON.stringify({
              tableId,
              restaurantId,
              version: '1.0'
            });
            
            // Extract table ID
            const extractedTableId = extractTableId(qrDataString);
            
            // Verify correct table ID is extracted
            expect(extractedTableId).toBe(tableId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse QR code data correctly for all valid inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Create QR data string
            const qrDataString = JSON.stringify({
              tableId,
              restaurantId,
              version: '1.0'
            });
            
            // Parse QR code data
            const parsed = parseQRCodeData(qrDataString);
            
            // Verify all fields are correctly parsed
            expect(parsed.tableId).toBe(tableId);
            expect(parsed.restaurantId).toBe(restaurantId);
            expect(parsed.version).toBe('1.0');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 40: QR Code Navigation to Menu', () => {
    /**
     * **Validates: Requirements 11.2**
     * 
     * For any valid table QR code scanned by a customer, the system must 
     * navigate to the menu page for that table.
     */
    it('should provide table ID for menu navigation from valid QR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Generate QR code and create table
            const qrCode = await generateQRCode(tableId, restaurantId);
            const table = await createTable(qrCode);
            
            // Create QR data string (simulating QR code scan)
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });
            
            // Validate QR code (this would trigger navigation in the UI)
            const result = await validateQRCode(qrDataString);
            
            // Verify table ID is provided for navigation
            expect(result.tableId).toBeDefined();
            expect(typeof result.tableId).toBe('string');
            expect(result.tableId.length).toBeGreaterThan(0);
            expect(result.tableId).toBe(table.id);
            
            // Verify restaurant ID is also provided
            expect(result.restaurantId).toBeDefined();
            expect(result.restaurantId).toBe(restaurantId);
            
            // Clean up
            await deleteTable(table.id);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should reject navigation for inactive tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
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
            
            // Validation should fail (preventing navigation)
            await expect(validateQRCode(qrDataString)).rejects.toThrow(
              `Table ${table.id} is not active or does not exist`
            );
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should handle navigation requests for non-existent tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Create QR data string for non-existent table
            const qrDataString = JSON.stringify({
              tableId: `non-existent-${tableId}`,
              restaurantId,
              version: '1.0'
            });
            
            // Validation should fail (preventing navigation)
            await expect(validateQRCode(qrDataString)).rejects.toThrow(
              /Table .* is not active or does not exist/
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract table ID for navigation without full validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Create QR data string
            const qrDataString = JSON.stringify({
              tableId,
              restaurantId,
              version: '1.0'
            });
            
            // Extract table ID (for quick navigation without validation)
            const extractedTableId = extractTableId(qrDataString);
            
            // Verify table ID can be extracted for navigation
            expect(extractedTableId).toBeDefined();
            expect(typeof extractedTableId).toBe('string');
            expect(extractedTableId).toBe(tableId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('QR Code Operations Integration', () => {
    it('should maintain end-to-end QR code workflow integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Step 1: Generate QR code
            const qrCode = await generateQRCode(tableId, restaurantId);
            expect(qrCode).toBeDefined();
            expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
            
            // Step 2: Create table with QR code
            const table = await createTable(qrCode);
            expect(table.id).toBeDefined();
            expect(table.qrCode).toBe(qrCode);
            
            // Step 3: Simulate QR code scan
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });
            
            // Step 4: Validate and extract navigation data
            const result = await validateQRCode(qrDataString);
            expect(result.tableId).toBe(table.id);
            expect(result.restaurantId).toBe(restaurantId);
            
            // Step 5: Extract table ID for navigation
            const extractedTableId = extractTableId(qrDataString);
            expect(extractedTableId).toBe(table.id);
            
            // Clean up
            await deleteTable(table.id);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should handle QR code lifecycle from creation to deletion', async () => {
      await fc.assert(
        fc.asyncProperty(
          tableIdArbitrary,
          restaurantIdArbitrary,
          async (tableId, restaurantId) => {
            // Create QR code and table
            const qrCode = await generateQRCode(tableId, restaurantId);
            const table = await createTable(qrCode);
            
            const qrDataString = JSON.stringify({
              tableId: table.id,
              restaurantId,
              version: '1.0'
            });
            
            // Verify QR code works when table is active
            const result1 = await validateQRCode(qrDataString);
            expect(result1.tableId).toBe(table.id);
            
            // Delete table
            await deleteTable(table.id);
            
            // Verify QR code is rejected when table is inactive
            await expect(validateQRCode(qrDataString)).rejects.toThrow(
              `Table ${table.id} is not active or does not exist`
            );
            
            // Verify table ID can still be extracted (but validation fails)
            const extractedTableId = extractTableId(qrDataString);
            expect(extractedTableId).toBe(table.id);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });
});
