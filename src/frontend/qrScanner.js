/**
 * QR Code Scanner Integration
 * Handles QR code scanning, validation, and navigation
 * Requirements: 1.2, 11.2
 */

export class QRScanner {
  constructor(navigationController, qrValidator) {
    this.navigationController = navigationController;
    this.qrValidator = qrValidator;
    this.isScanning = false;
  }

  /**
   * Scan QR code and navigate to menu page
   * @param {string} qrCodeData - QR code data string
   * @returns {Promise<Object>} - Result object with success status and message
   */
  async scanAndNavigate(qrCodeData) {
    try {
      // Validate QR code
      const validation = await this.validateQRCode(qrCodeData);
      
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'Invalid QR code'
        };
      }

      // Extract table ID from QR code
      const tableId = this.extractTableId(qrCodeData);
      
      if (!tableId) {
        return {
          success: false,
          message: 'Could not extract table ID from QR code'
        };
      }

      // Navigate to menu page with table context
      const navigated = this.navigationController.navigateFromQRCode(tableId);
      
      if (!navigated) {
        return {
          success: false,
          message: 'Failed to navigate to menu page'
        };
      }

      return {
        success: true,
        message: 'Successfully scanned QR code',
        tableId
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Error scanning QR code'
      };
    }
  }

  /**
   * Validate QR code with backend
   * @param {string} qrCodeData - QR code data string
   * @returns {Promise<Object>} - Validation result
   */
  async validateQRCode(qrCodeData) {
    try {
      // Use the QR validator to check if code is valid
      const isValid = await this.qrValidator.validate(qrCodeData);
      
      if (!isValid) {
        return {
          valid: false,
          error: 'QR code is invalid or table is inactive'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Validation failed'
      };
    }
  }

  /**
   * Extract table ID from QR code data
   * @param {string} qrCodeData - QR code data string
   * @returns {string|null} - Table ID or null if extraction fails
   */
  extractTableId(qrCodeData) {
    try {
      // Parse QR code data (expected format: JSON with tableId)
      const data = JSON.parse(qrCodeData);
      return data.tableId || null;
    } catch (error) {
      // If not JSON, assume the QR code data is the table ID itself
      return qrCodeData || null;
    }
  }

  /**
   * Start camera-based QR code scanning
   * @param {HTMLVideoElement} videoElement - Video element for camera feed
   * @param {Function} onScan - Callback function when QR code is detected
   * @returns {Promise<void>}
   */
  async startCameraScanning(videoElement, onScan) {
    if (this.isScanning) {
      return;
    }

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      videoElement.srcObject = stream;
      this.isScanning = true;

      // Note: In a real implementation, you would use a QR code detection library
      // like jsQR or html5-qrcode to process video frames
      // For this implementation, we provide the interface
      
      if (onScan) {
        onScan({ success: true, message: 'Camera started' });
      }
    } catch (error) {
      this.isScanning = false;
      if (onScan) {
        onScan({
          success: false,
          message: error.message || 'Failed to access camera'
        });
      }
    }
  }

  /**
   * Stop camera-based QR code scanning
   * @param {HTMLVideoElement} videoElement - Video element for camera feed
   */
  stopCameraScanning(videoElement) {
    if (!this.isScanning) {
      return;
    }

    const stream = videoElement.srcObject;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }

    this.isScanning = false;
  }

  /**
   * Process manual QR code input
   * @param {string} qrCodeInput - Manually entered QR code
   * @returns {Promise<Object>} - Result object
   */
  async processManualInput(qrCodeInput) {
    if (!qrCodeInput || qrCodeInput.trim() === '') {
      return {
        success: false,
        message: 'Please enter a QR code'
      };
    }

    return await this.scanAndNavigate(qrCodeInput.trim());
  }
}

/**
 * QR Code Validator
 * Validates QR codes against backend
 */
export class QRCodeValidator {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Validate QR code with backend
   * @param {string} qrCodeData - QR code data string
   * @returns {Promise<boolean>} - True if valid, false otherwise
   */
  async validate(qrCodeData) {
    try {
      // Extract table ID
      let tableId;
      try {
        const data = JSON.parse(qrCodeData);
        tableId = data.tableId;
      } catch {
        tableId = qrCodeData;
      }

      // Validate with backend
      const response = await fetch(`${this.apiBaseUrl}/tables/${tableId}/validate`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error('QR code validation error:', error);
      return false;
    }
  }
}
