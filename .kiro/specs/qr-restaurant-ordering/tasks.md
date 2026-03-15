# Implementation Plan: QR-Based Restaurant Ordering System

## Overview

This implementation plan breaks down the QR-based restaurant ordering system into discrete, manageable tasks. The system will be built using JavaScript with a Node.js/Express backend and vanilla JavaScript frontend. Tasks are organized by functional area with clear dependencies, progressing from core data models through services, persistence, UI components, real-time updates, and comprehensive testing.

## Tasks

- [x] 1. Set up project structure and core infrastructure
  - Create directory structure: `/src/backend`, `/src/frontend`, `/src/shared`
  - Initialize Node.js project with Express, set up basic server
  - Create shared data models and types (Table, MenuItem, Order, OrderItem, SystemState)
  - Set up JSON file storage directory structure
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 2. Implement data persistence layer
  - [x] 2.1 Create persistence manager for JSON file operations
    - Implement file read/write operations with error handling
    - Add file locking mechanism for concurrent write safety
    - Implement data validation on load
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x] 2.2 Write property tests for persistence layer
    - **Property 36: Order Persistence Round Trip**
    - **Property 37: Status Update Persistence**
    - **Property 38: Table Persistence Round Trip**
    - **Property 39: Menu Item Persistence Round Trip**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [x] 3. Implement table management service
  - [x] 3.1 Create Table service with CRUD operations
    - Implement table creation with unique ID generation
    - Implement table retrieval by ID
    - Implement table update (status changes)
    - Implement soft delete (mark as inactive)
    - _Requirements: 1.1, 8.1, 8.2, 8.3_
  
  - [x] 3.2 Write property tests for table service
    - **Property 1: QR Code Uniqueness**
    - **Property 3: QR Code Validation for Active Tables**
    - **Property 28: Tables Page Displays All Tables**
    - **Property 29: Table Creation Generates QR Code**
    - **Property 30: Deleted Tables Marked Inactive**
    - **Validates: Requirements 1.1, 1.4, 8.1, 8.2, 8.3**

- [x] 4. Implement QR code generation and validation
  - [x] 4.1 Create QR code generator
    - Generate QR codes containing table ID and restaurant identifier
    - Encode QR data as data URL for display
    - Store QR code with table entity
    - _Requirements: 1.1, 1.3_
  
  - [x] 4.2 Create QR code validator
    - Parse QR code data and extract table ID
    - Validate QR code corresponds to active table
    - Return table ID on successful validation
    - _Requirements: 1.2, 1.4_
  
  - [x] 4.3 Write property tests for QR code operations
    - **Property 2: QR Code to Table Mapping**
    - **Property 40: QR Code Navigation to Menu**
    - **Validates: Requirements 1.2, 1.4, 11.2**

- [x] 5. Implement menu management service
  - [x] 5.1 Create MenuItem service with CRUD operations
    - Implement menu item creation with unique ID
    - Implement menu item retrieval (all items, by ID)
    - Implement menu item update (details and availability)
    - Implement menu item deletion (soft delete)
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 5.2 Write property tests for menu service
    - **Property 4: Menu Display Completeness**
    - **Property 7: Unavailable Items Cannot Be Selected**
    - **Property 32: Menu Item Creation**
    - **Property 33: Menu Item Update Persistence**
    - **Property 34: Menu Item Availability Toggle**
    - **Validates: Requirements 2.1, 2.2, 2.5, 9.1, 9.2, 9.3, 9.4**

- [x] 6. Implement order management service
  - [x] 6.1 Create Order service with core operations
    - Implement order creation with unique ID and table association
    - Implement order item addition and removal
    - Implement order total price calculation
    - Implement order retrieval (by ID, by table, all orders)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 6.2 Create order status management
    - Implement status transitions (pending → preparing → ready → served → completed)
    - Validate status transitions (prevent invalid transitions)
    - Update order timestamps on status change
    - _Requirements: 4.3, 4.4, 5.2, 12.1, 12.2_
  
  - [x] 6.3 Write property tests for order service
    - **Property 5: Item Selection Adds to Order**
    - **Property 6: Item Removal from Order**
    - **Property 8: Order Summary Accuracy**
    - **Property 9: Order Creation Links to Table**
    - **Property 10: Order ID Uniqueness**
    - **Property 11: New Orders Start as Pending**
    - **Property 14: Status Transition to Preparing**
    - **Property 15: Status Transition to Ready**
    - **Property 17: Status Transition to Served**
    - **Property 42: Status Transition to Completed**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 5.2, 12.1, 12.2**

- [x] 7. Implement order queue service
  - [x] 7.1 Create order queue retrieval and filtering
    - Retrieve all orders with status "pending" or "preparing"
    - Sort orders by submission time (oldest first)
    - Include table identifier with each order
    - _Requirements: 4.1, 4.5, 5.4_
  
  - [x] 7.2 Write property tests for order queue
    - **Property 12: Submitted Orders Appear on Queue**
    - **Property 13: Queue Shows Only Active Orders**
    - **Property 16: Queue Sorted by Submission Time**
    - **Property 18: Served Orders Removed from Queue**
    - **Property 19: Queue Displays Table Identifier**
    - **Property 43: Completed Orders Removed from Queue**
    - **Validates: Requirements 4.1, 4.2, 4.5, 5.3, 5.4, 12.3**

- [x] 8. Implement repeat order functionality
  - [x] 8.1 Create repeat order service
    - Detect when customer returns to same table
    - Create new order linked to same table
    - Maintain reference to original order
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [x] 8.2 Write property tests for repeat orders
    - **Property 20: Repeat Order Links to Same Table**
    - **Property 21: Repeat Order Associates with Same Customer**
    - **Property 22: Repeat Orders Appear on Queue**
    - **Property 23: Order Relationship Maintained**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

- [x] 9. Implement dashboard metrics service
  - [x] 9.1 Create metrics calculation functions
    - Calculate active table count
    - Calculate order counts by status
    - Calculate total revenue from completed orders
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 9.2 Write property tests for dashboard metrics
    - **Property 24: Dashboard Active Table Count**
    - **Property 25: Dashboard Order Status Counts**
    - **Property 26: Dashboard Revenue Calculation**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 10. Implement table order history service
  - [x] 10.1 Create table history retrieval
    - Retrieve all orders associated with a table
    - Include both active and completed orders
    - _Requirements: 8.5_
  
  - [x] 10.2 Write property tests for table history
    - **Property 31: Table Order History Display**
    - **Validates: Requirements 8.5**

- [x] 11. Checkpoint - Backend services complete
  - Ensure all backend services are implemented and tested
  - Verify all property tests pass
  - Ask the user if questions arise

- [x] 12. Create Express API endpoints
  - [x] 12.1 Create table management endpoints
    - POST /api/tables (create table)
    - GET /api/tables (list all tables)
    - GET /api/tables/:id (get table by ID)
    - PUT /api/tables/:id (update table)
    - DELETE /api/tables/:id (delete table)
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 12.2 Create menu management endpoints
    - POST /api/menu-items (create menu item)
    - GET /api/menu-items (list all menu items)
    - GET /api/menu-items/:id (get menu item by ID)
    - PUT /api/menu-items/:id (update menu item)
    - DELETE /api/menu-items/:id (delete menu item)
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 12.3 Create order management endpoints
    - POST /api/orders (create order)
    - GET /api/orders (list all orders)
    - GET /api/orders/:id (get order by ID)
    - PUT /api/orders/:id (update order)
    - PUT /api/orders/:id/status (update order status)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 5.2_
  
  - [x] 12.4 Create order queue endpoint
    - GET /api/orders/queue (get active orders sorted by time)
    - _Requirements: 4.1, 4.2, 4.5, 5.4_
  
  - [x] 12.5 Create dashboard metrics endpoint
    - GET /api/metrics (get dashboard metrics)
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 12.6 Create QR code validation endpoint
    - QR validation handled via GET /api/tables/:id endpoint
    - _Requirements: 1.2, 1.4_

- [x] 13. Implement real-time updates mechanism
  - [x] 13.1 Set up WebSocket server
    - Initialize WebSocket server on Express
    - Implement connection management
    - Implement event broadcasting
    - _Requirements: 4.2, 7.4, 9.5_
  
  - [x] 13.2 Implement order status update broadcasting
    - Broadcast order status changes to all connected clients
    - Broadcast new order creation to kitchen queue
    - _Requirements: 4.2, 12.3_
  
  - [x] 13.3 Implement menu update broadcasting
    - Broadcast menu item changes to all connected clients
    - _Requirements: 9.5_
  
  - [x] 13.4 Implement dashboard metrics broadcasting
    - Broadcast metric updates to dashboard clients
    - _Requirements: 7.4_
  
  - [x] 13.5 Write property tests for real-time updates
    - **Property 27: Dashboard Real-Time Updates**
    - **Property 35: Menu Item Changes Reflect Immediately**
    - **Validates: Requirements 7.4, 9.5**

- [x] 14. Create frontend HTML structure
  - [x] 14.1 Create main HTML file with navigation hub
    - Create index.html with navigation structure
    - Set up page containers for each view
    - Implement role-based page visibility
    - _Requirements: 11.1, 11.4_
  
  - [x] 14.2 Create menu page HTML
    - Create menu item display structure
    - Create order summary section
    - Create submit order button
    - _Requirements: 2.1, 2.2, 3.1_
  
  - [x] 14.3 Create order queue page HTML
    - Create order list structure
    - Create status update buttons
    - Create table identifier display
    - _Requirements: 4.1, 5.4_
  
  - [x] 14.4 Create dashboard page HTML
    - Create metrics display sections
    - Create real-time update placeholders
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 14.5 Create tables management page HTML
    - Create table list structure
    - Create table creation form
    - Create QR code display area
    - _Requirements: 8.1, 8.2, 8.4_
  
  - [x] 14.6 Create menu management page HTML
    - Create menu item list structure
    - Create menu item creation form
    - Create availability toggle controls
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 15. Implement frontend navigation system
  - [x] 15.1 Create navigation controller
    - Implement page switching logic
    - Maintain user context during navigation
    - Implement role-based access control
    - _Requirements: 11.1, 11.3, 11.4_
  
  - [x] 15.2 Implement QR code scanning integration
    - Integrate QR code scanner library
    - Validate QR code and navigate to menu page
    - Pass table context to menu page
    - _Requirements: 1.2, 11.2_
  
  - [x] 15.3 Write property tests for navigation
    - **Property 41: User Context Preserved During Navigation**
    - **Validates: Requirements 11.4**

- [x] 16. Implement menu page functionality
  - [x] 16.1 Create menu display controller
    - Fetch menu items from API
    - Display items with name, description, price, availability
    - Handle unavailable item display (disabled state)
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 16.2 Create order builder controller
    - Handle item selection and addition to order
    - Handle item removal from order
    - Calculate and display order total
    - _Requirements: 2.3, 2.4, 3.1_
  
  - [x] 16.3 Create order submission handler
    - Validate order has at least one item
    - Submit order to API
    - Display confirmation message
    - Navigate to confirmation page
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
   
  - [x] 16.4 Write unit tests for menu page
    - Test menu item display
    - Test item selection and removal
    - Test order total calculation
    - Test order submission validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

- [x] 17. Implement order queue page functionality
  - [x] 17.1 Create queue display controller
    - Fetch active orders from API
    - Display orders sorted by submission time
    - Display table identifier for each order
    - Highlight "ready" orders
    - _Requirements: 4.1, 4.5, 5.1, 5.4_
  
  - [x] 17.2 Create status update controller
    - Implement status update buttons (preparing, ready, served, completed)
    - Send status updates to API
    - Update UI on successful status change
    - _Requirements: 4.3, 4.4, 5.2, 12.1, 12.2_
  
  - [x] 17.3 Create real-time queue updates handler
    - Connect to WebSocket for real-time updates
    - Update queue when new orders arrive
    - Update queue when order status changes
    - Remove served/completed orders from queue
    - _Requirements: 4.2, 5.3, 12.3_
  
  - [x] 17.4 Write unit tests for order queue page
    - Test queue display and sorting
    - Test status update functionality
    - Test real-time update handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 5.4_

- [x] 18. Implement dashboard page functionality
  - [x] 18.1 Create metrics display controller
    - Fetch metrics from API
    - Display active table count
    - Display order counts by status
    - Display total revenue
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 18.2 Create real-time metrics updates handler
    - Connect to WebSocket for real-time updates
    - Update metrics when orders change
    - Update metrics when tables change
    - _Requirements: 7.4_
  
  - [x] 18.3 Write unit tests for dashboard page
    - Test metrics display
    - Test real-time metric updates
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 19. Implement tables management page functionality
  - [x] 19.1 Create table list display controller
    - Fetch all tables from API
    - Display table identifiers
    - Display table status
    - _Requirements: 8.1_
  
  - [x] 19.2 Create table creation handler
    - Display table creation form
    - Submit new table to API
    - Display generated QR code
    - _Requirements: 8.2_
  
  - [x] 19.3 Create table deletion handler
    - Implement delete button for each table
    - Send delete request to API
    - Update table list on successful deletion
    - _Requirements: 8.3_
  
  - [x] 19.4 Create QR code display and print handler
    - Display QR code for each table
    - Implement print functionality
    - Implement download functionality
    - _Requirements: 8.4_
  
  - [x] 19.5 Create table order history display
    - Fetch order history for selected table
    - Display all orders associated with table
    - _Requirements: 8.5_
  
  - [x] 19.6 Write unit tests for tables page
    - Test table list display
    - Test table creation
    - Test table deletion
    - Test QR code display
    - Test order history display
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 20. Implement menu management page functionality
  - [x] 20.1 Create menu item list display controller
    - Fetch all menu items from API
    - Display items with name, description, price, availability
    - _Requirements: 9.1_
  
  - [x] 20.2 Create menu item creation handler
    - Display menu item creation form
    - Validate form inputs
    - Submit new menu item to API
    - Update menu list on successful creation
    - _Requirements: 9.1_
  
  - [x] 20.3 Create menu item update handler
    - Display menu item edit form
    - Submit updates to API
    - Update menu list on successful update
    - _Requirements: 9.2_
  
  - [x] 20.4 Create availability toggle handler
    - Implement toggle button for each item
    - Send availability update to API
    - Update UI on successful toggle
    - _Requirements: 9.3_
  
  - [x] 20.5 Create real-time menu updates handler
    - Connect to WebSocket for menu updates
    - Update menu display when items change
    - _Requirements: 9.5_
  
  - [x] 20.6 Write unit tests for menu management page
    - Test menu item display
    - Test menu item creation
    - Test menu item update
    - Test availability toggle
    - Test real-time updates
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 21. Implement frontend API client
  - [x] 21.1 Create HTTP client for API calls
    - Implement GET, POST, PUT, DELETE methods
    - Handle error responses
    - Implement retry logic with exponential backoff
    - _Requirements: 10.1, 10.2_
  
  - [x] 21.2 Create WebSocket client for real-time updates
    - Implement WebSocket connection management
    - Implement reconnection logic
    - Implement event listeners for updates
    - _Requirements: 4.2, 7.4, 9.5_

- [x] 22. Implement frontend styling and UI polish
  - [x] 22.1 Create CSS for all pages
    - Style menu page for customer usability
    - Style order queue page for kitchen/waiter efficiency
    - Style dashboard for manager overview
    - Style tables and menu management pages
    - _Requirements: 2.1, 4.1, 7.1, 8.1, 9.1_
  
  - [x] 22.2 Implement responsive design
    - Ensure pages work on mobile devices
    - Ensure pages work on tablets
    - Ensure pages work on desktop
    - _Requirements: 2.1, 4.1, 7.1_

- [x] 23. Checkpoint - Frontend pages complete
  - Ensure all frontend pages are functional
  - Verify all real-time updates work
  - Ask the user if questions arise

- [x] 24. Implement error handling and validation
  - [x] 24.1 Create input validation layer
    - Validate all user inputs before submission
    - Display user-friendly error messages
    - Prevent invalid data from reaching API
    - _Requirements: 2.5, 3.1_
  
  - [x] 24.2 Create API error handling
    - Handle HTTP errors gracefully
    - Display error messages to users
    - Implement retry logic for transient failures
    - _Requirements: 10.1, 10.2_
  
  - [x] 24.3 Create data validation on backend
    - Validate all incoming API requests
    - Validate data before persistence
    - Return appropriate error responses
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x] 24.4 Write unit tests for error handling
    - Test input validation
    - Test API error handling
    - Test data validation
    - _Requirements: 2.5, 3.1, 10.1, 10.2_

- [x] 25. Implement data integrity and concurrency handling
  - [x] 25.1 Create concurrency control mechanisms
    - Implement file locking for write operations
    - Implement last-write-wins conflict resolution
    - Implement atomic writes for multi-entity operations
    - _Requirements: 10.5_
  
  - [x] 25.2 Create data validation and recovery
    - Implement data validation on load
    - Implement data corruption detection
    - Implement recovery from backups
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 26. Implement comprehensive property-based tests
  - [x] 26.1 Create property test suite for all correctness properties
    - Implement all 44 property tests from design document
    - Configure fast-check with 100+ iterations per test
    - Add seed for reproducibility
    - Tag each test with property reference
    - _Requirements: All_
  
  - [x] 26.2 Run full property test suite
    - Execute all property tests
    - Verify all tests pass
    - Document any failures
    - _Requirements: All_

- [ ] 27. Implement integration tests
  - [ ] 27.1 Create end-to-end workflow tests
    - Test complete customer order flow (QR scan → menu → order → queue)
    - Test kitchen workflow (queue → preparing → ready → served → completed)
    - Test manager workflows (dashboard, table management, menu management)
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 7.1, 8.1, 9.1_
  
  - [ ] 27.2 Create repeat order workflow tests
    - Test repeat order flow from same table
    - Verify order history is maintained
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 27.3 Create real-time update integration tests
    - Test WebSocket updates across multiple clients
    - Test fallback to polling
    - Test connection recovery
    - _Requirements: 4.2, 7.4, 9.5_

- [x] 28. Checkpoint - All tests passing
  - Ensure all unit tests pass
  - Ensure all property tests pass
  - Ensure all integration tests pass
  - Ask the user if questions arise

- [-] 29. Create system documentation
  - [ ] 29.1 Create API documentation
    - Document all endpoints
    - Document request/response formats
    - Document error codes
    - _Requirements: All_
  
  - [ ] 29.2 Create deployment guide
    - Document system requirements
    - Document installation steps
    - Document configuration options
    - _Requirements: All_
  
  - [ ] 29.3 Create user guide
    - Document customer workflow
    - Document kitchen staff workflow
    - Document manager workflow
    - _Requirements: All_

- [ ] 30. Final checkpoint - System complete
  - Ensure all features are implemented
  - Ensure all tests pass
  - Ensure documentation is complete
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Integration tests verify complete workflows
- Checkpoints ensure incremental validation and provide opportunities for feedback
- All 44 correctness properties from the design document are covered by property-based tests
- Real-time updates use WebSocket with polling fallback for browser compatibility
- Data persistence uses JSON files with file locking for concurrent access safety
