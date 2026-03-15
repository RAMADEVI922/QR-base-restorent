# Design Document: QR-Based Restaurant Ordering System

## Overview

The QR-Based Restaurant Ordering System is a full-stack web application that enables customers to order food by scanning table-specific QR codes, while providing restaurant staff with real-time order management capabilities. The system consists of customer-facing ordering interfaces, kitchen order queue management, and administrative dashboards for restaurant managers.

The architecture separates concerns into distinct layers:
- **Presentation Layer**: Multi-page UI for customers, kitchen staff, and managers
- **Business Logic Layer**: Order processing, status management, and data validation
- **Data Persistence Layer**: Permanent storage of orders, tables, menu items, and system state

Key design principles:
- Real-time updates for order status visibility
- Table-based order association through QR codes
- Role-based access control (customer, kitchen staff, waiter, manager)
- Data integrity across concurrent operations
- Scalability for multiple simultaneous orders

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Menu Page  │  Dashboard  │  Tables Page  │  Order Queue    │
│  (Customer) │  (Manager)  │  (Manager)    │  (Kitchen/Wait) │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Business Logic Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Order Service  │  Menu Service  │  Table Service           │
│  Status Manager │  QR Generator  │  Persistence Manager     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                Data Persistence Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Orders Store  │  Tables Store  │  Menu Items Store         │
│  (JSON/Local)  │  (JSON/Local)  │  (JSON/Local)             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Customer Order Flow**:
   - Customer scans QR code → System identifies table
   - Menu page loads with available items
   - Customer selects items → Order object builds in memory
   - Customer submits → Order persisted, status set to "pending"
   - Order appears on kitchen queue in real-time

2. **Kitchen/Waiter Flow**:
   - Kitchen staff views order queue page
   - Updates order status: pending → preparing → ready
   - Waiter marks order as served
   - Manager marks order as completed

3. **Manager Flow**:
   - Access dashboard for metrics
   - Manage tables and QR codes
   - Manage menu items and availability
   - View order history

## Components and Interfaces

### Page Components

#### Menu Page (Customer-Facing)
- **Purpose**: Display menu items and allow customers to build orders
- **Inputs**: Table ID (from QR code), Menu items list
- **Outputs**: Order submission with selected items
- **Key Features**:
  - Display all available menu items with name, description, price
  - Show availability status for each item
  - Add/remove items from current order
  - Display order summary with total price
  - Submit order button

#### Order Queue Page (Kitchen/Waiter)
- **Purpose**: Display active orders for kitchen preparation and waiter service
- **Inputs**: All orders with status "pending" or "preparing"
- **Outputs**: Status updates, order completion
- **Key Features**:
  - Display orders sorted by submission time (oldest first)
  - Show table identifier for each order
  - Highlight "ready" orders for waiter visibility
  - Status update buttons (preparing, ready, served, completed)
  - Real-time updates when new orders arrive

#### Dashboard Page (Manager)
- **Purpose**: Provide system overview and key metrics
- **Inputs**: All orders, tables, menu items
- **Outputs**: None (read-only)
- **Key Features**:
  - Total active tables count
  - Order count by status (pending, preparing, ready, served)
  - Total revenue from completed orders
  - Real-time metric updates

#### Tables Page (Manager)
- **Purpose**: Manage table configurations and QR codes
- **Inputs**: Table list, QR code data
- **Outputs**: Create/delete tables, print QR codes
- **Key Features**:
  - Display all tables with identifiers
  - Create new table (auto-generates QR code)
  - Delete table (marks as inactive)
  - Print/download QR codes
  - View table order history

#### Menu Management Page (Manager)
- **Purpose**: Manage menu items and availability
- **Inputs**: Menu items list
- **Outputs**: Create/update/delete menu items, toggle availability
- **Key Features**:
  - Display all menu items
  - Add new menu item (name, description, price)
  - Update menu item details
  - Toggle availability status
  - Real-time reflection on customer menu pages

### Navigation System

The system provides a multi-page navigation structure:

```
┌─────────────────────────────────────────┐
│         Navigation Hub                  │
├─────────────────────────────────────────┤
│  Customer Path:                         │
│  QR Scan → Menu Page                    │
│                                         │
│  Manager Path:                          │
│  Dashboard ↔ Tables Page ↔ Menu Page    │
│           ↔ Order Queue Page            │
│                                         │
│  Kitchen/Waiter Path:                   │
│  Order Queue Page                       │
└─────────────────────────────────────────┘
```

- **Context Preservation**: User role and table context maintained during navigation
- **Role-Based Access**: Different pages available based on user role
- **Direct Access**: QR code scanning bypasses navigation for customers

## Data Models

### Table Entity
```
Table {
  id: string (unique identifier)
  qrCode: string (encoded QR data)
  status: "active" | "inactive"
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Menu Item Entity
```
MenuItem {
  id: string (unique identifier)
  name: string
  description: string
  price: number (in cents)
  available: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Order Entity
```
Order {
  id: string (unique identifier)
  tableId: string (foreign key to Table)
  items: OrderItem[] (array of selected items)
  status: "pending" | "preparing" | "ready" | "served" | "completed"
  totalPrice: number (in cents)
  createdAt: timestamp
  updatedAt: timestamp
  completedAt: timestamp (optional)
}
```

### Order Item Entity
```
OrderItem {
  menuItemId: string (foreign key to MenuItem)
  quantity: number
  price: number (price at time of order)
  name: string (snapshot of menu item name)
}
```

### System State Entity
```
SystemState {
  tables: Table[]
  menuItems: MenuItem[]
  orders: Order[]
  lastUpdated: timestamp
}
```

### QR Code Data Structure
```
QRCodeData {
  tableId: string
  restaurantId: string (optional, for multi-location support)
  version: string (for future compatibility)
}
```

## Data Persistence Strategy

### Storage Format
- **Primary Storage**: JSON files in local storage or file system
- **Structure**: Separate JSON files for tables, menu items, and orders
- **Backup**: Periodic snapshots of system state

### Persistence Operations
1. **Create**: Write new entity to storage, assign unique ID
2. **Read**: Load entity from storage by ID
3. **Update**: Modify entity in storage, update timestamp
4. **Delete**: Mark entity as inactive (soft delete) or remove (hard delete)

### Concurrency Handling
- **Locking Strategy**: File-level locking for write operations
- **Conflict Resolution**: Last-write-wins for concurrent updates
- **Transaction Support**: Atomic writes for multi-entity operations

### Data Integrity
- **Validation**: All data validated before persistence
- **Referential Integrity**: Foreign key constraints enforced
- **Consistency Checks**: Periodic validation of data relationships

## Technical Approach

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (vanilla or lightweight framework)
- **Backend**: Node.js with Express (or similar lightweight framework)
- **Data Storage**: JSON files with file system operations
- **QR Code Generation**: QR code library (e.g., qrcode.js)
- **Real-Time Updates**: WebSockets or polling mechanism

### QR Code Implementation
- **Generation**: Create QR code containing table ID and restaurant identifier
- **Format**: Encode as data URL for display and printing
- **Scanning**: Use device camera or QR code scanner library
- **Validation**: Verify QR code corresponds to active table

### Order Status Workflow
```
pending → preparing → ready → served → completed
```

- **Pending**: Order submitted, awaiting kitchen acknowledgment
- **Preparing**: Kitchen staff has started preparation
- **Ready**: Order complete, awaiting waiter pickup
- **Served**: Order delivered to customer
- **Completed**: Order fully processed, moved to history

### Real-Time Update Mechanism
- **WebSocket Connection**: Establish persistent connection for live updates
- **Event Broadcasting**: Broadcast order status changes to relevant clients
- **Fallback Polling**: Implement polling for browsers without WebSocket support
- **Update Frequency**: Real-time for critical updates (order status), periodic for metrics

### Error Handling Strategy
- **Validation Errors**: Prevent invalid data from being persisted
- **Concurrency Errors**: Detect and resolve conflicting updates
- **Network Errors**: Implement retry logic with exponential backoff
- **Data Corruption**: Validate data integrity on load, recover from backups

### Security Considerations
- **QR Code Validation**: Verify QR code authenticity before processing
- **Role-Based Access**: Enforce access control based on user role
- **Data Validation**: Sanitize all user inputs
- **Session Management**: Maintain secure session state for authenticated users



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: QR Code Uniqueness

*For any* two tables created in the system, their QR codes must be unique and distinct.

**Validates: Requirements 1.1**

### Property 2: QR Code to Table Mapping

*For any* table with a valid QR code, scanning that QR code must return the correct table identifier and associate subsequent orders with that table.

**Validates: Requirements 1.2**

### Property 3: QR Code Validation for Active Tables

*For any* QR code, if the corresponding table is marked as inactive, the system must reject the QR code and prevent order placement.

**Validates: Requirements 1.4**

### Property 4: Menu Display Completeness

*For any* set of menu items marked as available, the menu page must display all available items with their name, description, price, and availability status.

**Validates: Requirements 2.1, 2.2**

### Property 5: Item Selection Adds to Order

*For any* menu item selected by a customer, that item must be added to the current order and appear in the order summary.

**Validates: Requirements 2.3**

### Property 6: Item Removal from Order

*For any* item in the current order, removing it must result in the item no longer appearing in the order.

**Validates: Requirements 2.4**

### Property 7: Unavailable Items Cannot Be Selected

*For any* menu item marked as unavailable, the system must prevent customers from selecting that item on the menu page.

**Validates: Requirements 2.5, 9.4**

### Property 8: Order Summary Accuracy

*For any* order with selected items, the order summary must display all selected items and calculate the total price correctly as the sum of individual item prices.

**Validates: Requirements 3.1**

### Property 9: Order Creation Links to Table

*For any* order submitted from a table, the order must be created with a reference to that table and remain associated with that table.

**Validates: Requirements 3.2**

### Property 10: Order ID Uniqueness

*For any* two orders created in the system, their order IDs must be unique and distinct.

**Validates: Requirements 3.3**

### Property 11: New Orders Start as Pending

*For any* order submitted by a customer, the order status must be initialized to "pending".

**Validates: Requirements 3.4**

### Property 12: Submitted Orders Appear on Queue

*For any* order submitted, that order must immediately appear on the order queue page with status "pending" or "preparing".

**Validates: Requirements 3.5, 4.2**

### Property 13: Queue Shows Only Active Orders

*For any* order queue page, only orders with status "pending" or "preparing" must be displayed; orders with status "ready", "served", or "completed" must not appear.

**Validates: Requirements 4.1**

### Property 14: Status Transition to Preparing

*For any* order with status "pending", when marked as "preparing" by kitchen staff, the order status must update to "preparing" and persist.

**Validates: Requirements 4.3**

### Property 15: Status Transition to Ready

*For any* order with status "preparing", when marked as "ready" by kitchen staff, the order status must update to "ready" and persist.

**Validates: Requirements 4.4**

### Property 16: Queue Sorted by Submission Time

*For any* set of orders on the queue page, orders must be sorted by submission time with the oldest order appearing first.

**Validates: Requirements 4.5**

### Property 17: Status Transition to Served

*For any* order with status "ready", when marked as "served" by a waiter, the order status must update to "served" and persist.

**Validates: Requirements 5.2**

### Property 18: Served Orders Removed from Queue

*For any* order marked as "served", that order must be removed from the active order queue page.

**Validates: Requirements 5.3**

### Property 19: Queue Displays Table Identifier

*For any* order on the queue page, the table identifier must be displayed so waiters can locate the correct table.

**Validates: Requirements 5.4**

### Property 20: Repeat Order Links to Same Table

*For any* customer who places a repeat order at a table with a previously served order, the new order must be linked to the same table.

**Validates: Requirements 6.1, 6.2**

### Property 21: Repeat Order Associates with Same Customer

*For any* repeat order placed at a table, the repeat order must be associated with the same customer as the previous order.

**Validates: Requirements 6.3**

### Property 22: Repeat Orders Appear on Queue

*For any* repeat order submitted, that order must appear on the order queue page as a new order.

**Validates: Requirements 6.4**

### Property 23: Order Relationship Maintained

*For any* repeat order, the system must maintain a reference to the original order for historical tracking and reporting.

**Validates: Requirements 6.5**

### Property 24: Dashboard Active Table Count

*For any* set of tables in the system, the dashboard must display a count equal to the number of tables with status "active".

**Validates: Requirements 7.1**

### Property 25: Dashboard Order Status Counts

*For any* set of orders in the system, the dashboard must display accurate counts for each order status (pending, preparing, ready, served, completed).

**Validates: Requirements 7.2**

### Property 26: Dashboard Revenue Calculation

*For any* set of completed orders, the dashboard must display total revenue equal to the sum of all completed order prices.

**Validates: Requirements 7.3**

### Property 27: Dashboard Real-Time Updates

*For any* change to order status, table configuration, or menu items, the dashboard metrics must update to reflect the current system state.

**Validates: Requirements 7.4**

### Property 28: Tables Page Displays All Tables

*For any* set of tables in the system, the tables page must display all tables with their identifiers.

**Validates: Requirements 8.1**

### Property 29: Table Creation Generates QR Code

*For any* new table created through the tables page, the system must generate a unique QR code for that table.

**Validates: Requirements 8.2**

### Property 30: Deleted Tables Marked Inactive

*For any* table deleted through the tables page, the table must be marked as inactive and the system must prevent new orders from being placed at that table.

**Validates: Requirements 8.3**

### Property 31: Table Order History Display

*For any* table accessed on the tables page, the system must display all orders associated with that table.

**Validates: Requirements 8.5**

### Property 32: Menu Item Creation

*For any* menu item created through the menu management page with name, description, and price, the system must persist the menu item and make it available for selection.

**Validates: Requirements 9.1**

### Property 33: Menu Item Update Persistence

*For any* menu item updated through the menu management page, the changes must be persisted to storage.

**Validates: Requirements 9.2**

### Property 34: Menu Item Availability Toggle

*For any* menu item, toggling its availability status must persist the change and immediately affect whether customers can select it.

**Validates: Requirements 9.3**

### Property 35: Menu Item Changes Reflect Immediately

*For any* menu item updated, all active menu pages must immediately reflect the changes to that item's details or availability.

**Validates: Requirements 9.5**

### Property 36: Order Persistence Round Trip

*For any* order created and submitted, querying the persistent storage must return an order with the same items, table association, and status.

**Validates: Requirements 10.1**

### Property 37: Status Update Persistence

*For any* order status update, querying the persistent storage must return the order with the updated status.

**Validates: Requirements 10.2**

### Property 38: Table Persistence Round Trip

*For any* table created or modified, querying the persistent storage must return the table with the same configuration and QR code.

**Validates: Requirements 10.3**

### Property 39: Menu Item Persistence Round Trip

*For any* menu item created or modified, querying the persistent storage must return the menu item with the same details and availability status.

**Validates: Requirements 10.4**

### Property 40: QR Code Navigation to Menu

*For any* valid table QR code scanned by a customer, the system must navigate to the menu page for that table.

**Validates: Requirements 11.2**

### Property 41: User Context Preserved During Navigation

*For any* navigation between pages, the current user context (role, table association, session state) must be maintained.

**Validates: Requirements 11.4**

### Property 42: Status Transition to Completed

*For any* order with status "served", when marked as "completed", the order status must update to "completed" and persist.

**Validates: Requirements 12.1, 12.2**

### Property 43: Completed Orders Removed from Queue

*For any* order marked as "completed", that order must be removed from the active order queue page.

**Validates: Requirements 12.3**

### Property 44: Completed Orders Maintained in History

*For any* order marked as "completed", the system must maintain the order in historical records for reporting and analytics.

**Validates: Requirements 12.4**



## Error Handling

### Input Validation Errors

**Invalid QR Code**
- Error: QR code does not correspond to any table
- Response: Display error message, prevent order placement
- Recovery: Prompt user to scan valid QR code

**Invalid Menu Item Selection**
- Error: Attempting to select unavailable menu item
- Response: Disable selection button, show unavailability message
- Recovery: Allow selection of available items only

**Invalid Order Submission**
- Error: Order contains no items or invalid items
- Response: Display validation error, prevent submission
- Recovery: Require user to select at least one valid item

**Invalid Status Transition**
- Error: Attempting invalid order status transition (e.g., ready → pending)
- Response: Reject transition, log error
- Recovery: Only allow valid transitions per workflow

### Data Persistence Errors

**Storage Write Failure**
- Error: Unable to write data to persistent storage
- Response: Log error, display user-friendly message
- Recovery: Retry operation with exponential backoff, alert administrator

**Storage Read Failure**
- Error: Unable to read data from persistent storage
- Response: Log error, display error message
- Recovery: Attempt to load from backup, use cached data if available

**Data Corruption**
- Error: Loaded data fails validation checks
- Response: Log error, alert administrator
- Recovery: Restore from backup, mark corrupted data for investigation

### Concurrency Errors

**Conflicting Updates**
- Error: Two operations attempt to modify the same entity simultaneously
- Response: Detect conflict, apply last-write-wins strategy
- Recovery: Log conflict, notify affected users if necessary

**Race Condition in Order Status**
- Error: Order status updated by multiple sources simultaneously
- Response: Use atomic operations, lock entity during update
- Recovery: Ensure only one status update succeeds, others fail gracefully

### Network/Real-Time Errors

**WebSocket Connection Lost**
- Error: Real-time connection to server drops
- Response: Attempt to reconnect with exponential backoff
- Recovery: Fall back to polling mechanism, notify user of connection status

**Stale Data**
- Error: Client receives outdated information due to network delay
- Response: Implement data versioning, detect stale updates
- Recovery: Refresh data from server, discard stale updates

### User Experience Errors

**Invalid User Role Access**
- Error: User attempts to access page/feature not permitted for their role
- Response: Deny access, redirect to appropriate page
- Recovery: Display permission error, guide user to correct page

**Session Timeout**
- Error: User session expires during operation
- Response: Redirect to login, preserve unsaved data if possible
- Recovery: Allow user to re-authenticate and resume

## Testing Strategy

### Unit Testing Approach

Unit tests verify specific examples, edge cases, and error conditions. Focus on:

**Order Management**
- Creating orders with valid items
- Preventing order creation with empty items
- Calculating order totals correctly
- Handling invalid status transitions
- Persisting orders to storage

**Menu Management**
- Adding menu items with valid data
- Preventing invalid menu item creation
- Toggling item availability
- Updating item details
- Preventing selection of unavailable items

**Table Management**
- Creating tables with unique QR codes
- Marking tables as inactive
- Preventing orders at inactive tables
- Retrieving table order history

**Data Persistence**
- Round-trip persistence (create → read → verify)
- Updating persisted data
- Handling storage errors gracefully
- Recovering from corrupted data

**Navigation and Context**
- Navigating between pages
- Maintaining user context during navigation
- Handling invalid navigation attempts

### Property-Based Testing Approach

Property-based tests verify universal properties across all inputs using randomization. Each property test:

- Generates random valid inputs (tables, menu items, orders)
- Executes the operation being tested
- Verifies the property holds for all generated inputs
- Runs minimum 100 iterations per test
- Tags each test with reference to design property

**Property Test Configuration**

Each property-based test must include a comment tag referencing the design document property:

```
// Feature: qr-restaurant-ordering, Property X: [Property Title]
```

**Property Test Examples**

**Property 1: QR Code Uniqueness**
```
// Feature: qr-restaurant-ordering, Property 1: QR Code Uniqueness
// For any two tables created, their QR codes must be unique
test('QR codes are unique for all created tables', () => {
  // Generate 100 random tables
  // Verify all QR codes are unique
  // Assert: Set of QR codes has same length as number of tables
})
```

**Property 8: Order Summary Accuracy**
```
// Feature: qr-restaurant-ordering, Property 8: Order Summary Accuracy
// For any order with selected items, total price must equal sum of item prices
test('order summary total equals sum of item prices', () => {
  // Generate random menu items with prices
  // Generate random selection of items
  // Calculate expected total
  // Create order with selected items
  // Assert: order.totalPrice === expectedTotal
})
```

**Property 16: Queue Sorted by Submission Time**
```
// Feature: qr-restaurant-ordering, Property 16: Queue Sorted by Submission Time
// Orders must be sorted by submission time, oldest first
test('queue orders sorted by submission time oldest first', () => {
  // Generate random orders with different submission times
  // Add to queue
  // Retrieve queue
  // Assert: queue is sorted by createdAt ascending
})
```

### Test Coverage Goals

- **Unit Tests**: Cover all edge cases, error conditions, and specific examples
- **Property Tests**: Cover all universal properties from correctness properties section
- **Integration Tests**: Verify page navigation, real-time updates, and multi-component interactions
- **End-to-End Tests**: Verify complete workflows (customer order → kitchen preparation → waiter service)

### Testing Tools and Libraries

**Property-Based Testing Library**: 
- JavaScript: fast-check
- Configuration: 100+ iterations per test, seed for reproducibility

**Unit Testing Framework**:
- JavaScript: Jest or Vitest
- Configuration: Standard test runner with coverage reporting

**Real-Time Testing**:
- Mock WebSocket connections for testing real-time updates
- Simulate network delays and failures
- Verify fallback to polling mechanism

### Test Execution Strategy

1. **Local Development**: Run unit tests on every file change
2. **Pre-Commit**: Run full test suite before committing
3. **CI/CD Pipeline**: Run all tests on every push
4. **Nightly Builds**: Run extended property tests with higher iteration counts
5. **Performance Testing**: Monitor test execution time, alert on regressions

### Data Validation Testing

- Verify all inputs are validated before processing
- Test boundary conditions (empty strings, null values, extreme numbers)
- Verify error messages are user-friendly and actionable
- Test concurrent operations don't corrupt data

