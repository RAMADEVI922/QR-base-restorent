/**
 * Unit tests for table management API endpoints
 * Tests Requirements: 8.1, 8.2, 8.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { 
  createTable, 
  getAllTables, 
  getTableById, 
  updateTableStatus, 
  deleteTable 
} from './tableService.js';
import { generateQRCode } from './qrCodeGenerator.js';

// Mock the dependencies
vi.mock('./tableService.js');
vi.mock('./qrCodeGenerator.js');

// Create a test app instance
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Table Management Endpoints
  app.post('/api/tables', async (req, res) => {
    try {
      const { tableId } = req.body;
      
      if (!tableId || typeof tableId !== 'string') {
        return res.status(400).json({ 
          error: 'Table ID is required and must be a string' 
        });
      }

      const qrCode = await generateQRCode(tableId);
      const table = await createTable(qrCode);
      
      res.status(201).json(table);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to create table',
        message: error.message 
      });
    }
  });

  app.get('/api/tables', async (req, res) => {
    try {
      const tables = await getAllTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to retrieve tables',
        message: error.message 
      });
    }
  });

  app.get('/api/tables/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const table = await getTableById(id);
      
      if (!table) {
        return res.status(404).json({ 
          error: 'Table not found' 
        });
      }
      
      res.json(table);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to retrieve table',
        message: error.message 
      });
    }
  });

  app.put('/api/tables/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ 
          error: 'Status is required and must be a string' 
        });
      }
      
      const existingTable = await getTableById(id);
      if (!existingTable) {
        return res.status(404).json({ 
          error: 'Table not found' 
        });
      }
      
      const updatedTable = await updateTableStatus(id, status);
      res.json(updatedTable);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to update table',
        message: error.message 
      });
    }
  });

  app.delete('/api/tables/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingTable = await getTableById(id);
      if (!existingTable) {
        return res.status(404).json({ 
          error: 'Table not found' 
        });
      }
      
      const deletedTable = await deleteTable(id);
      res.json(deletedTable);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to delete table',
        message: error.message 
      });
    }
  });

  return app;
}

describe('Table Management API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('POST /api/tables', () => {
    it('should create a new table with valid tableId', async () => {
      const mockQRCode = 'data:image/png;base64,mockqrcode';
      const mockTable = {
        id: 'table-uuid',
        qrCode: mockQRCode,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      generateQRCode.mockResolvedValue(mockQRCode);
      createTable.mockResolvedValue(mockTable);

      const response = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-1' })
        .expect(201);

      expect(response.body).toEqual(mockTable);
      expect(generateQRCode).toHaveBeenCalledWith('table-1');
      expect(createTable).toHaveBeenCalledWith(mockQRCode);
    });

    it('should return 400 if tableId is missing', async () => {
      const response = await request(app)
        .post('/api/tables')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Table ID is required and must be a string');
    });

    it('should return 400 if tableId is not a string', async () => {
      const response = await request(app)
        .post('/api/tables')
        .send({ tableId: 123 })
        .expect(400);

      expect(response.body.error).toBe('Table ID is required and must be a string');
    });

    it('should return 500 if table creation fails', async () => {
      generateQRCode.mockResolvedValue('qr-code');
      createTable.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/tables')
        .send({ tableId: 'table-1' })
        .expect(500);

      expect(response.body.error).toBe('Failed to create table');
    });
  });

  describe('GET /api/tables', () => {
    it('should return all tables', async () => {
      const mockTables = [
        { id: 'table-1', qrCode: 'qr1', status: 'active' },
        { id: 'table-2', qrCode: 'qr2', status: 'inactive' }
      ];

      getAllTables.mockResolvedValue(mockTables);

      const response = await request(app)
        .get('/api/tables')
        .expect(200);

      expect(response.body).toEqual(mockTables);
      expect(getAllTables).toHaveBeenCalled();
    });

    it('should return empty array if no tables exist', async () => {
      getAllTables.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/tables')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 500 if retrieval fails', async () => {
      getAllTables.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/tables')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve tables');
    });
  });

  describe('GET /api/tables/:id', () => {
    it('should return table by ID', async () => {
      const mockTable = {
        id: 'table-1',
        qrCode: 'qr-code',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      getTableById.mockResolvedValue(mockTable);

      const response = await request(app)
        .get('/api/tables/table-1')
        .expect(200);

      expect(response.body).toEqual(mockTable);
      expect(getTableById).toHaveBeenCalledWith('table-1');
    });

    it('should return 404 if table not found', async () => {
      getTableById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tables/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Table not found');
    });

    it('should return 500 if retrieval fails', async () => {
      getTableById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/tables/table-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to retrieve table');
    });
  });

  describe('PUT /api/tables/:id', () => {
    it('should update table status', async () => {
      const mockTable = {
        id: 'table-1',
        qrCode: 'qr-code',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const updatedTable = { ...mockTable, status: 'inactive' };

      getTableById.mockResolvedValue(mockTable);
      updateTableStatus.mockResolvedValue(updatedTable);

      const response = await request(app)
        .put('/api/tables/table-1')
        .send({ status: 'inactive' })
        .expect(200);

      expect(response.body).toEqual(updatedTable);
      expect(updateTableStatus).toHaveBeenCalledWith('table-1', 'inactive');
    });

    it('should return 400 if status is missing', async () => {
      const response = await request(app)
        .put('/api/tables/table-1')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Status is required and must be a string');
    });

    it('should return 404 if table not found', async () => {
      getTableById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/tables/nonexistent')
        .send({ status: 'inactive' })
        .expect(404);

      expect(response.body.error).toBe('Table not found');
    });

    it('should return 500 if update fails', async () => {
      const mockTable = { id: 'table-1', status: 'active' };
      getTableById.mockResolvedValue(mockTable);
      updateTableStatus.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/tables/table-1')
        .send({ status: 'inactive' })
        .expect(500);

      expect(response.body.error).toBe('Failed to update table');
    });
  });

  describe('DELETE /api/tables/:id', () => {
    it('should soft delete a table', async () => {
      const mockTable = {
        id: 'table-1',
        qrCode: 'qr-code',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const deletedTable = { ...mockTable, status: 'inactive' };

      getTableById.mockResolvedValue(mockTable);
      deleteTable.mockResolvedValue(deletedTable);

      const response = await request(app)
        .delete('/api/tables/table-1')
        .expect(200);

      expect(response.body).toEqual(deletedTable);
      expect(deleteTable).toHaveBeenCalledWith('table-1');
    });

    it('should return 404 if table not found', async () => {
      getTableById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/tables/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Table not found');
    });

    it('should return 500 if deletion fails', async () => {
      const mockTable = { id: 'table-1', status: 'active' };
      getTableById.mockResolvedValue(mockTable);
      deleteTable.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/tables/table-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to delete table');
    });
  });
});
