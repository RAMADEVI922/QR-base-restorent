/**
 * Integration tests for table management API endpoints
 * Tests the actual endpoints with real services
 * Requirements: 8.1, 8.2, 8.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from './server.js';
import { readTables, writeTables } from './persistenceManager.js';

describe('Table Management API Integration Tests', () => {
  let originalTables;

  beforeEach(async () => {
    // Backup original tables
    originalTables = await readTables();
    // Clear tables for clean test state
    await writeTables([]);
  });

  afterEach(async () => {
    // Restore original tables
    await writeTables(originalTables);
  });

  it('should create, retrieve, update, and delete a table', async () => {
    // Create a table
    const createResponse = await request(app)
      .post('/api/tables')
      .send({ tableId: 'integration-test-table' })
      .expect(201);

    expect(createResponse.body).toHaveProperty('id');
    expect(createResponse.body).toHaveProperty('qrCode');
    expect(createResponse.body.status).toBe('active');

    const tableId = createResponse.body.id;

    // Retrieve all tables
    const getAllResponse = await request(app)
      .get('/api/tables')
      .expect(200);

    expect(getAllResponse.body).toHaveLength(1);
    expect(getAllResponse.body[0].id).toBe(tableId);

    // Retrieve specific table
    const getByIdResponse = await request(app)
      .get(`/api/tables/${tableId}`)
      .expect(200);

    expect(getByIdResponse.body.id).toBe(tableId);
    expect(getByIdResponse.body.status).toBe('active');

    // Update table status
    const updateResponse = await request(app)
      .put(`/api/tables/${tableId}`)
      .send({ status: 'inactive' })
      .expect(200);

    expect(updateResponse.body.status).toBe('inactive');

    // Verify update persisted
    const verifyUpdateResponse = await request(app)
      .get(`/api/tables/${tableId}`)
      .expect(200);

    expect(verifyUpdateResponse.body.status).toBe('inactive');

    // Delete table (soft delete)
    const deleteResponse = await request(app)
      .delete(`/api/tables/${tableId}`)
      .expect(200);

    expect(deleteResponse.body.status).toBe('inactive');

    // Verify table still exists but is inactive
    const verifyDeleteResponse = await request(app)
      .get(`/api/tables/${tableId}`)
      .expect(200);

    expect(verifyDeleteResponse.body.status).toBe('inactive');
  });

  it('should handle multiple tables', async () => {
    // Create multiple tables
    const table1Response = await request(app)
      .post('/api/tables')
      .send({ tableId: 'table-1' })
      .expect(201);

    const table2Response = await request(app)
      .post('/api/tables')
      .send({ tableId: 'table-2' })
      .expect(201);

    const table3Response = await request(app)
      .post('/api/tables')
      .send({ tableId: 'table-3' })
      .expect(201);

    // Retrieve all tables
    const getAllResponse = await request(app)
      .get('/api/tables')
      .expect(200);

    expect(getAllResponse.body).toHaveLength(3);

    // Verify each table has unique ID and QR code
    const ids = getAllResponse.body.map(t => t.id);
    const qrCodes = getAllResponse.body.map(t => t.qrCode);

    expect(new Set(ids).size).toBe(3); // All IDs unique
    expect(new Set(qrCodes).size).toBe(3); // All QR codes unique
  });

  it('should return 404 for non-existent table', async () => {
    await request(app)
      .get('/api/tables/non-existent-id')
      .expect(404);

    await request(app)
      .put('/api/tables/non-existent-id')
      .send({ status: 'inactive' })
      .expect(404);

    await request(app)
      .delete('/api/tables/non-existent-id')
      .expect(404);
  });

  it('should validate request body for POST', async () => {
    // Missing tableId
    await request(app)
      .post('/api/tables')
      .send({})
      .expect(400);

    // Invalid tableId type
    await request(app)
      .post('/api/tables')
      .send({ tableId: 123 })
      .expect(400);
  });

  it('should validate request body for PUT', async () => {
    // Create a table first
    const createResponse = await request(app)
      .post('/api/tables')
      .send({ tableId: 'test-table' })
      .expect(201);

    const tableId = createResponse.body.id;

    // Missing status
    await request(app)
      .put(`/api/tables/${tableId}`)
      .send({})
      .expect(400);

    // Invalid status type
    await request(app)
      .put(`/api/tables/${tableId}`)
      .send({ status: 123 })
      .expect(400);
  });
});
