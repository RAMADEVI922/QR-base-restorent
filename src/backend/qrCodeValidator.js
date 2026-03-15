/**
 * QR Code Validator Module
 * Validates QR codes and ensures they correspond to active tables
 * 
 * Requirements: 1.2, 1.4
 */

import { parseQRCodeData } from './qrCodeGenerator.js';
import { isTableActive } from './tableService.js';

/**
 * Validate a QR code and extract table ID
 * @param {string} qrDataString - The QR code data string (JSON)
 * @returns {Promise<Object>} Object containing tableId and restaurantId
 * @throws {Error} If QR code is invalid or table is not active
 */
export async function validateQRCode(qrDataString) {
  // Parse QR code data
  const qrData = parseQRCodeData(qrDataString);

  // Extract table ID
  const { tableId, restaurantId } = qrData;

  // Validate that table is active
  const isActive = await isTableActive(tableId);

  if (!isActive) {
    throw new Error(`Table ${tableId} is not active or does not exist`);
  }

  // Return table ID on successful validation
  return {
    tableId,
    restaurantId
  };
}

/**
 * Extract table ID from QR code without validation
 * @param {string} qrDataString - The QR code data string (JSON)
 * @returns {string} The table ID
 * @throws {Error} If QR code data is invalid
 */
export function extractTableId(qrDataString) {
  const qrData = parseQRCodeData(qrDataString);
  return qrData.tableId;
}
