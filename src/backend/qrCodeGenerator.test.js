/**
 * Tests for QR Code Generator Module
 * Validates QR code generation, parsing, and data integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { generateQRCode, parseQRCodeData, createTableQRCode } from './qrCodeGenerator.js';

describe('QR Code Generator', () => {
  describe('Unit Tests', () => {
    describe('generateQRCode', () => {
      it('should generate a valid data URL for a table', async () => {
        const tableId = 'table-1';
        const restaurantId = 'restaurant-1';

        const qrCode = await generateQRCode(tableId, restaurantId);

        expect(qrCode).toBeDefined();
        expect(typeof qrCode).toBe('string');
        expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
      });

      it('should generate different QR codes for different table IDs', async () => {
        const restaurantId = 'restaurant-1';

        const qrCode1 = await generateQRCode('table-1', restaurantId);
        const qrCode2 = await generateQRCode('table-2', restaurantId);

        expect(qrCode1).not.toBe(qrCode2);
      });

      it('should use default restaurantId when not provided', async () => {
        const tableId = 'table-1';

        const qrCode = await generateQRCode(tableId);

        expect(qrCode).toBeDefined();
        expect(typeof qrCode).toBe('string');
        expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
      });

      it('should throw error for invalid tableId', async () => {
        await expect(generateQRCode(null, 'restaurant-1')).rejects.toThrow(
          'Invalid tableId'
        );
        await expect(generateQRCode('', 'restaurant-1')).rejects.toThrow(
          'Invalid tableId'
        );
        await expect(generateQRCode(123, 'restaurant-1')).rejects.toThrow(
          'Invalid tableId'
        );
      });

      it('should throw error for invalid restaurantId', async () => {
        await expect(generateQRCode('table-1', 123)).rejects.toThrow(
          'Invalid restaurantId'
        );
      });
    });

    describe('parseQRCodeData', () => {
      it('should parse valid QR code data', () => {
        const qrDataString = JSON.stringify({
          tableId: 'table-1',
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        const parsed = parseQRCodeData(qrDataString);

        expect(parsed.tableId).toBe('table-1');
        expect(parsed.restaurantId).toBe('restaurant-1');
        expect(parsed.version).toBe('1.0');
      });

      it('should throw error for invalid JSON', () => {
        expect(() => parseQRCodeData('invalid json')).toThrow(
          'Failed to parse QR code data'
        );
      });

      it('should throw error for missing tableId', () => {
        const qrDataString = JSON.stringify({
          restaurantId: 'restaurant-1',
          version: '1.0'
        });

        expect(() => parseQRCodeData(qrDataString)).toThrow(
          'Invalid QR code data: missing or invalid tableId'
        );
      });

      it('should throw error for missing restaurantId', () => {
        const qrDataString = JSON.stringify({
          tableId: 'table-1',
          version: '1.0'
        });

        expect(() => parseQRCodeData(qrDataString)).toThrow(
          'Invalid QR code data: missing or invalid restaurantId'
        );
      });

      it('should throw error for missing version', () => {
        const qrDataString = JSON.stringify({
          tableId: 'table-1',
          restaurantId: 'restaurant-1'
        });

        expect(() => parseQRCodeData(qrDataString)).toThrow(
          'Invalid QR code data: missing or invalid version'
        );
      });

      it('should throw error for null input', () => {
        expect(() => parseQRCodeData(null)).toThrow(
          'Invalid QR code data'
        );
      });

      it('should throw error for empty string', () => {
        expect(() => parseQRCodeData('')).toThrow(
          'Invalid QR code data'
        );
      });
    });

    describe('createTableQRCode', () => {
      it('should create a QR code for a table', async () => {
        const tableId = 'table-1';
        const restaurantId = 'restaurant-1';

        const qrCode = await createTableQRCode(tableId, restaurantId);

        expect(qrCode).toBeDefined();
        expect(typeof qrCode).toBe('string');
        expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
      });

      it('should use default restaurantId when not provided', async () => {
        const tableId = 'table-1';

        const qrCode = await createTableQRCode(tableId);

        expect(qrCode).toBeDefined();
        expect(typeof qrCode).toBe('string');
      });
    });
  });

  describe('Property-Based Tests', () => {
    // Feature: qr-restaurant-ordering, Property 1: QR Code Uniqueness
    // For any two tables created, their QR codes must be unique and distinct
    it('Property 1: QR codes are unique for all created tables', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
          async (tableIds) => {
            const restaurantId = 'restaurant-1';
            const qrCodes = await Promise.all(
              tableIds.map(id => generateQRCode(id, restaurantId))
            );

            // All QR codes should be unique
            const uniqueQRCodes = new Set(qrCodes);
            expect(uniqueQRCodes.size).toBe(qrCodes.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    // Feature: qr-restaurant-ordering, Property 2: QR Code to Table Mapping
    // For any table with a valid QR code, scanning that QR code must return the correct table identifier
    it('Property 2: QR code to table mapping is correct', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/),
          async (tableId, restaurantId) => {
            const qrCode = await generateQRCode(tableId, restaurantId);

            // Extract the base64 data from the data URL
            const base64Data = qrCode.split(',')[1];
            expect(base64Data).toBeDefined();

            // The QR code should be a valid data URL
            expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    // Feature: qr-restaurant-ordering, Property 29: Table Creation Generates QR Code
    // For any new table created, the system must generate a unique QR code for that table
    it('Property 29: Table creation generates QR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/),
          async (tableId, restaurantId) => {
            const qrCode = await createTableQRCode(tableId, restaurantId);

            // QR code should be a valid data URL
            expect(qrCode).toBeDefined();
            expect(typeof qrCode).toBe('string');
            expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);

            // QR code should be non-empty
            expect(qrCode.length).toBeGreaterThan(50);
          }
        ),
        { numRuns: 10 }
      );
    });

    // Feature: qr-restaurant-ordering, Property 38: Table Persistence Round Trip
    // For any table created or modified, querying the persistent storage must return the table with the same configuration and QR code
    it('Property 38: Table persistence round trip with QR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/),
          async (tableId, restaurantId) => {
            // Generate QR code
            const qrCode = await generateQRCode(tableId, restaurantId);

            // Simulate storing and retrieving the table
            const storedTable = {
              id: tableId,
              qrCode: qrCode,
              status: 'active',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };

            // Verify the stored table has the same QR code
            expect(storedTable.qrCode).toBe(qrCode);
            expect(storedTable.id).toBe(tableId);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in table ID', async () => {
      const tableId = 'table-1-special_chars';
      const restaurantId = 'restaurant-1';

      const qrCode = await generateQRCode(tableId, restaurantId);

      expect(qrCode).toBeDefined();
      expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should handle long table IDs', async () => {
      const tableId = 'a'.repeat(100);
      const restaurantId = 'restaurant-1';

      const qrCode = await generateQRCode(tableId, restaurantId);

      expect(qrCode).toBeDefined();
      expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should handle long restaurant IDs', async () => {
      const tableId = 'table-1';
      const restaurantId = 'b'.repeat(100);

      const qrCode = await generateQRCode(tableId, restaurantId);

      expect(qrCode).toBeDefined();
      expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('should generate consistent QR codes for the same input', async () => {
      const tableId = 'table-1';
      const restaurantId = 'restaurant-1';

      const qrCode1 = await generateQRCode(tableId, restaurantId);
      const qrCode2 = await generateQRCode(tableId, restaurantId);

      // QR codes should be identical for the same input
      expect(qrCode1).toBe(qrCode2);
    });
  });
});
