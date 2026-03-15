/**
 * QR Code Generator Module
 * Generates QR codes for tables containing table ID and restaurant identifier
 * Encodes QR data as data URLs for display and printing
 */

import QRCode from 'qrcode';

/**
 * Generate a QR code for a table
 * @param {string} tableId - The unique table identifier
 * @param {string} restaurantId - The restaurant identifier (optional, defaults to 'default')
 * @returns {Promise<string>} QR code encoded as data URL
 * @throws {Error} If QR code generation fails
 */
export async function generateQRCode(tableId, restaurantId = 'default') {
  if (!tableId || typeof tableId !== 'string') {
    throw new Error('Invalid tableId: must be a non-empty string');
  }

  if (typeof restaurantId !== 'string') {
    throw new Error('Invalid restaurantId: must be a string');
  }

  // Create QR code data structure
  const qrData = {
    tableId,
    restaurantId,
    version: '1.0'
  };

  // Encode as JSON string for QR code
  const qrDataString = JSON.stringify(qrData);

  try {
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return dataUrl;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Parse and validate QR code data
 * @param {string} qrDataString - The QR code data string (JSON)
 * @returns {Object} Parsed QR code data with tableId, restaurantId, and version
 * @throws {Error} If QR code data is invalid
 */
export function parseQRCodeData(qrDataString) {
  if (!qrDataString || typeof qrDataString !== 'string') {
    throw new Error('Invalid QR code data: must be a non-empty string');
  }

  try {
    const qrData = JSON.parse(qrDataString);

    if (!qrData.tableId || typeof qrData.tableId !== 'string') {
      throw new Error('Invalid QR code data: missing or invalid tableId');
    }

    if (!qrData.restaurantId || typeof qrData.restaurantId !== 'string') {
      throw new Error('Invalid QR code data: missing or invalid restaurantId');
    }

    if (!qrData.version || typeof qrData.version !== 'string') {
      throw new Error('Invalid QR code data: missing or invalid version');
    }

    return qrData;
  } catch (error) {
    if (error.message.startsWith('Invalid QR code data')) {
      throw error;
    }
    throw new Error(`Failed to parse QR code data: ${error.message}`);
  }
}

/**
 * Generate QR code and return as data URL
 * This is the main export function for generating QR codes for tables
 * @param {string} tableId - The unique table identifier
 * @param {string} restaurantId - The restaurant identifier
 * @returns {Promise<string>} QR code as data URL
 */
export async function createTableQRCode(tableId, restaurantId = 'default') {
  return generateQRCode(tableId, restaurantId);
}
