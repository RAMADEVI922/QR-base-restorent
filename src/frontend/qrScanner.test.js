/**
 * Unit tests for QRScanner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QRScanner, QRCodeValidator } from './qrScanner.js';

describe('QRScanner', () => {
  let scanner;
  let mockNavigationController;
  let mockQRValidator;

  beforeEach(() => {
    mockNavigationController = {
      navigateFromQRCode: vi.fn()
    };

    mockQRValidator = {
      validate: vi.fn()
    };

    scanner = new QRScanner(mockNavigationController, mockQRValidator);
  });

  describe('QR Code Extraction', () => {
    it('should extract table ID from JSON QR code', () => {
      const qrData = JSON.stringify({ tableId: 'table-1' });
      const tableId = scanner.extractTableId(qrData);
      
      expect(tableId).toBe('table-1');
    });

    it('should extract table ID from plain string QR code', () => {
      const qrData = 'table-5';
      const tableId = scanner.extractTableId(qrData);
      
      expect(tableId).toBe('table-5');
    });

    it('should return null for empty QR code', () => {
      const tableId = scanner.extractTableId('');
      
      expect(tableId).toBeNull();
    });

    it('should return null for JSON without tableId', () => {
      const qrData = JSON.stringify({ restaurantId: 'rest-1' });
      const tableId = scanner.extractTableId(qrData);
      
      expect(tableId).toBeNull();
    });
  });

  describe('QR Code Validation', () => {
    it('should validate valid QR code', async () => {
      mockQRValidator.validate.mockResolvedValue(true);
      
      const result = await scanner.validateQRCode('table-1');
      
      expect(result.valid).toBe(true);
      expect(mockQRValidator.validate).toHaveBeenCalledWith('table-1');
    });

    it('should reject invalid QR code', async () => {
      mockQRValidator.validate.mockResolvedValue(false);
      
      const result = await scanner.validateQRCode('invalid-code');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle validation errors', async () => {
      mockQRValidator.validate.mockRejectedValue(new Error('Network error'));
      
      const result = await scanner.validateQRCode('table-1');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Scan and Navigate', () => {
    it('should successfully scan valid QR code and navigate', async () => {
      mockQRValidator.validate.mockResolvedValue(true);
      mockNavigationController.navigateFromQRCode.mockReturnValue(true);
      
      const qrData = JSON.stringify({ tableId: 'table-3' });
      const result = await scanner.scanAndNavigate(qrData);
      
      expect(result.success).toBe(true);
      expect(result.tableId).toBe('table-3');
      expect(mockNavigationController.navigateFromQRCode).toHaveBeenCalledWith('table-3');
    });

    it('should fail for invalid QR code', async () => {
      mockQRValidator.validate.mockResolvedValue(false);
      
      const result = await scanner.scanAndNavigate('invalid-code');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid');
      expect(mockNavigationController.navigateFromQRCode).not.toHaveBeenCalled();
    });

    it('should fail if table ID cannot be extracted', async () => {
      mockQRValidator.validate.mockResolvedValue(true);
      
      const qrData = JSON.stringify({ restaurantId: 'rest-1' });
      const result = await scanner.scanAndNavigate(qrData);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Could not extract table ID');
    });

    it('should fail if navigation fails', async () => {
      mockQRValidator.validate.mockResolvedValue(true);
      mockNavigationController.navigateFromQRCode.mockReturnValue(false);
      
      const result = await scanner.scanAndNavigate('table-1');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to navigate');
    });

    it('should handle scan errors', async () => {
      mockQRValidator.validate.mockRejectedValue(new Error('Scan error'));
      
      const result = await scanner.scanAndNavigate('table-1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Scan error');
    });
  });

  describe('Manual Input Processing', () => {
    it('should process valid manual input', async () => {
      mockQRValidator.validate.mockResolvedValue(true);
      mockNavigationController.navigateFromQRCode.mockReturnValue(true);
      
      const result = await scanner.processManualInput('table-2');
      
      expect(result.success).toBe(true);
      expect(result.tableId).toBe('table-2');
    });

    it('should reject empty manual input', async () => {
      const result = await scanner.processManualInput('');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Please enter a QR code');
    });

    it('should trim whitespace from manual input', async () => {
      mockQRValidator.validate.mockResolvedValue(true);
      mockNavigationController.navigateFromQRCode.mockReturnValue(true);
      
      const result = await scanner.processManualInput('  table-4  ');
      
      expect(result.success).toBe(true);
      expect(mockQRValidator.validate).toHaveBeenCalledWith('table-4');
    });
  });

  describe('Camera Scanning', () => {
    it('should not start scanning if already scanning', async () => {
      scanner.isScanning = true;
      const mockVideo = {};
      
      await scanner.startCameraScanning(mockVideo, null);
      
      // Should return early without doing anything
      expect(scanner.isScanning).toBe(true);
    });

    it('should stop camera scanning', () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = { getTracks: () => [mockTrack] };
      const mockVideo = { srcObject: mockStream };
      
      scanner.isScanning = true;
      scanner.stopCameraScanning(mockVideo);
      
      expect(scanner.isScanning).toBe(false);
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockVideo.srcObject).toBeNull();
    });

    it('should not stop if not scanning', () => {
      const mockVideo = { srcObject: null };
      
      scanner.isScanning = false;
      scanner.stopCameraScanning(mockVideo);
      
      expect(scanner.isScanning).toBe(false);
    });
  });
});

describe('QRCodeValidator', () => {
  let validator;
  let mockFetch;

  beforeEach(() => {
    validator = new QRCodeValidator('/api');
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('Validation', () => {
    it('should validate QR code with backend', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true })
      });
      
      const result = await validator.validate('table-1');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tables/table-1/validate',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should reject invalid QR code from backend', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ valid: false })
      });
      
      const result = await validator.validate('invalid-table');
      
      expect(result).toBe(false);
    });

    it('should handle backend errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      });
      
      const result = await validator.validate('table-1');
      
      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const result = await validator.validate('table-1');
      
      expect(result).toBe(false);
    });

    it('should extract table ID from JSON QR code', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true })
      });
      
      const qrData = JSON.stringify({ tableId: 'table-5' });
      await validator.validate(qrData);
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tables/table-5/validate',
        expect.any(Object)
      );
    });
  });
});
