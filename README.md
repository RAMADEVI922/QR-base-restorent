# QR-Based Restaurant Ordering System

A digital ordering platform that enables customers to scan table-specific QR codes to view menus, place orders, and track their status.

## Project Structure

```
qr-restaurant-ordering/
├── src/
│   ├── backend/
│   │   ├── server.js              # Express server entry point
│   │   ├── services/              # Business logic services
│   │   ├── routes/                # API endpoints
│   │   └── middleware/            # Express middleware
│   ├── frontend/
│   │   ├── index.html             # Main HTML file
│   │   ├── app.js                 # Frontend application controller
│   │   └── styles.css             # Frontend styling
│   └── shared/
│       └── types.js               # Shared data types and models
├── data/
│   ├── tables.json                # Tables storage
│   ├── menu-items.json            # Menu items storage
│   └── orders.json                # Orders storage
├── package.json                   # Node.js dependencies
└── README.md                      # This file
```

## Data Models

### Table
- `id`: Unique table identifier
- `qrCode`: Encoded QR code data (data URL)
- `status`: "active" or "inactive"
- `createdAt`: Timestamp of creation
- `updatedAt`: Timestamp of last update

### MenuItem
- `id`: Unique menu item identifier
- `name`: Item name
- `description`: Item description
- `price`: Price in cents
- `available`: Availability status
- `createdAt`: Timestamp of creation
- `updatedAt`: Timestamp of last update

### Order
- `id`: Unique order identifier
- `tableId`: Foreign key to Table
- `items`: Array of OrderItem objects
- `status`: "pending", "preparing", "ready", "served", or "completed"
- `totalPrice`: Total price in cents
- `createdAt`: Timestamp of creation
- `updatedAt`: Timestamp of last update
- `completedAt`: Timestamp of completion (optional)
- `previousOrderId`: Reference to original order for repeat orders (optional)

### OrderItem
- `menuItemId`: Foreign key to MenuItem
- `quantity`: Quantity ordered
- `price`: Price at time of order (in cents)
- `name`: Snapshot of menu item name

## Getting Started

### Installation

```bash
npm install
```

### Running the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### Development

```bash
npm run dev
```

This runs the server with file watching enabled.

### Testing

```bash
npm test
```

Run tests in watch mode.

```bash
npm run test:run
```

Run tests once.

## API Endpoints

### Tables
- `GET /api/tables` - List all tables
- `POST /api/tables` - Create new table
- `GET /api/tables/:id` - Get table by ID
- `PUT /api/tables/:id` - Update table
- `DELETE /api/tables/:id` - Delete table

### Menu Items
- `GET /api/menu-items` - List all menu items
- `POST /api/menu-items` - Create new menu item
- `GET /api/menu-items/:id` - Get menu item by ID
- `PUT /api/menu-items/:id` - Update menu item
- `DELETE /api/menu-items/:id` - Delete menu item

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id` - Update order
- `PUT /api/orders/:id/status` - Update order status
- `GET /api/orders/queue` - Get active orders (pending/preparing)

### Metrics
- `GET /api/metrics` - Get dashboard metrics

### QR Code
- `POST /api/qr-validate` - Validate QR code and return table ID

## Features

- QR code generation and validation for each table
- Real-time menu display with item availability
- Order placement and tracking
- Kitchen order queue management
- Waiter order delivery tracking
- Dashboard with system metrics
- Table and menu management
- Repeat order support
- Real-time updates via WebSocket
- Data persistence with JSON file storage

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Data Storage**: JSON files
- **QR Code**: qrcode library
- **Real-Time**: WebSocket
- **Testing**: Vitest, fast-check (property-based testing)

## Requirements

- Node.js 16+
- npm 7+

## License

ISC
