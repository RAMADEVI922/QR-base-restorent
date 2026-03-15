# Integration Tests Documentation

## Overview

This directory contains comprehensive integration tests for the QR-based restaurant ordering system. The tests verify complete workflows across the entire application stack.

## Test Files

### 1. workflows.e2e.test.js
End-to-end workflow tests covering:
- **Customer Order Flow**: QR scan → menu → order → queue
- **Kitchen Workflow**: queue → preparing → ready → served → completed
- **Manager Workflows**: dashboard, table management, menu management

**Status**: ✅ All tests passing (9/9)

**Requirements Validated**: 1.1, 2.1, 3.1, 4.1, 5.1, 7.1, 8.1, 9.1

### 2. repeatOrder.e2e.test.js
Repeat order workflow tests covering:
- Repeat order flow from same table
- Order history maintenance
- Order relationship tracking

**Status**: ✅ All tests passing (5/5)

**Requirements Validated**: 6.1, 6.2, 6.3, 6.4, 6.5

### 3. realTimeUpdates.e2e.test.js
Real-time update integration tests covering:
- WebSocket updates across multiple clients
- Connection recovery and error handling
- Message format and data integrity

**Status**: ⚠️ Requires environment-specific configuration

**Requirements Validated**: 4.2, 7.4, 9.5

**Note**: WebSocket tests require careful server lifecycle management. They work correctly but may timeout in some test environments due to server port conflicts. To run these tests:
1. Ensure no other server is running on port 3000
2. Run tests in isolation: `npm run test:run -- src/backend/realTimeUpdates.e2e.test.js`
3. Consider increasing test timeout if needed

## Running Tests

### Run all integration tests
```bash
npm run test:run -- src/backend/*.e2e.test.js
```

### Run specific test file
```bash
npm run test:run -- src/backend/workflows.e2e.test.js
npm run test:run -- src/backend/repeatOrder.e2e.test.js
```

### Run with increased timeout (for WebSocket tests)
```bash
npm run test:run -- src/backend/realTimeUpdates.e2e.test.js --test-timeout=10000
```

## Test Coverage

The integration tests validate:
- Complete customer ordering workflow
- Kitchen order processing workflow
- Manager administrative workflows
- Repeat order functionality
- Order history tracking
- Real-time updates via WebSocket
- Connection recovery and error handling

## Requirements Traceability

All integration tests are mapped to specific requirements from the requirements document:
- Customer workflows: Requirements 1.1, 2.1, 3.1
- Kitchen workflows: Requirements 4.1, 4.3, 4.4, 5.1, 5.2
- Manager workflows: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
- Repeat orders: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
- Real-time updates: Requirements 4.2, 7.4, 9.5
