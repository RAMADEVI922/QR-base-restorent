/**
 * Shared data types and models for the QR-Based Restaurant Ordering System
 */

/**
 * Table entity representing a physical dining location
 * @typedef {Object} Table
 * @property {string} id - Unique table identifier
 * @property {string} qrCode - Encoded QR code data (data URL)
 * @property {string} status - Table status: "active" or "inactive"
 * @property {number} createdAt - Timestamp of table creation
 * @property {number} updatedAt - Timestamp of last update
 */

/**
 * MenuItem entity representing a food or beverage offering
 * @typedef {Object} MenuItem
 * @property {string} id - Unique menu item identifier
 * @property {string} name - Item name
 * @property {string} description - Item description
 * @property {number} price - Item price in cents
 * @property {boolean} available - Availability status
 * @property {number} createdAt - Timestamp of item creation
 * @property {number} updatedAt - Timestamp of last update
 */

/**
 * OrderItem entity representing a selected menu item in an order
 * @typedef {Object} OrderItem
 * @property {string} menuItemId - Foreign key to MenuItem
 * @property {number} quantity - Quantity ordered
 * @property {number} price - Price at time of order (in cents)
 * @property {string} name - Snapshot of menu item name
 */

/**
 * Order entity representing a customer's order
 * @typedef {Object} Order
 * @property {string} id - Unique order identifier
 * @property {string} tableId - Foreign key to Table
 * @property {OrderItem[]} items - Array of ordered items
 * @property {string} status - Order status: "pending", "preparing", "ready", "served", or "completed"
 * @property {number} totalPrice - Total order price in cents
 * @property {number} createdAt - Timestamp of order creation
 * @property {number} updatedAt - Timestamp of last update
 * @property {number|null} completedAt - Timestamp of order completion (optional)
 * @property {string|null} previousOrderId - Reference to original order for repeat orders (optional)
 */

/**
 * SystemState entity representing the complete system state
 * @typedef {Object} SystemState
 * @property {Table[]} tables - Array of all tables
 * @property {MenuItem[]} menuItems - Array of all menu items
 * @property {Order[]} orders - Array of all orders
 * @property {number} lastUpdated - Timestamp of last system update
 */

/**
 * QRCodeData structure for QR code encoding
 * @typedef {Object} QRCodeData
 * @property {string} tableId - Table identifier
 * @property {string} restaurantId - Restaurant identifier (optional)
 * @property {string} version - Version for future compatibility
 */

// Export type definitions for documentation
export const TypeDefinitions = {
  Table: 'Table',
  MenuItem: 'MenuItem',
  OrderItem: 'OrderItem',
  Order: 'Order',
  SystemState: 'SystemState',
  QRCodeData: 'QRCodeData'
};

// Valid order statuses
export const OrderStatus = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  COMPLETED: 'completed'
};

// Valid table statuses
export const TableStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

// Order status transitions
export const ValidStatusTransitions = {
  [OrderStatus.PENDING]: [OrderStatus.PREPARING],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.SERVED],
  [OrderStatus.SERVED]: [OrderStatus.COMPLETED]
};
