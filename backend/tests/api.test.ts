import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { getDatabase, closeDatabase } from '../src/db/connection';
import { seedDatabase } from '../src/db/seed';
import { inventoryService } from '../src/services/inventoryService';

beforeAll(() => {
  getDatabase();
  seedDatabase(true); // Fresh clean seed for testing
});

afterAll(() => {
  closeDatabase();
});

describe('Smart-Retail Shelf Sensor Network - System Test Suite', () => {

  // 1. Health check
  it('GET /api/health should return UP status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.database).toBe('CONNECTED');
  });

  // 2. Inventory Calculation Engine Unit Logic
  describe('Inventory Calculation Engine', () => {
    it('calculates correct quantity with tare weight deduction', () => {
      // Tare: 250g, Gross: 2050g, Unit: 100g, Capacity: 25, Threshold: 5
      // Net: 1800g -> 18 units -> IN_STOCK
      const res = inventoryService.calculateStock({
        grossWeightGrams: 2050,
        tareWeightGrams: 250,
        unitWeightGrams: 100,
        capacity: 25,
        lowStockThreshold: 5
      });

      expect(res.isValid).toBe(true);
      expect(res.netWeightGrams).toBe(1800);
      expect(res.estimatedQuantity).toBe(18);
      expect(res.stockStatus).toBe('IN_STOCK');
      expect(res.stockPercentage).toBe(72);
    });

    it('identifies LOW_STOCK condition correctly', () => {
      // Net: 400g -> 4 units -> <= 5 -> LOW_STOCK
      const res = inventoryService.calculateStock({
        grossWeightGrams: 700,
        tareWeightGrams: 300,
        unitWeightGrams: 100,
        capacity: 20,
        lowStockThreshold: 5
      });

      expect(res.estimatedQuantity).toBe(4);
      expect(res.stockStatus).toBe('LOW_STOCK');
    });

    it('identifies OUT_OF_STOCK condition when gross equals tare', () => {
      const res = inventoryService.calculateStock({
        grossWeightGrams: 400,
        tareWeightGrams: 400,
        unitWeightGrams: 200,
        capacity: 15,
        lowStockThreshold: 4
      });

      expect(res.estimatedQuantity).toBe(0);
      expect(res.stockStatus).toBe('OUT_OF_STOCK');
    });

    it('clamps quantity to shelf capacity if overfilled', () => {
      const res = inventoryService.calculateStock({
        grossWeightGrams: 5000,
        tareWeightGrams: 0,
        unitWeightGrams: 100,
        capacity: 20,
        lowStockThreshold: 5
      });

      expect(res.estimatedQuantity).toBe(20); // Clamped to 20
    });

    it('flags uncalibrated or zero unit-weight product as UNKNOWN', () => {
      const res = inventoryService.calculateStock({
        grossWeightGrams: 1200,
        tareWeightGrams: 200,
        unitWeightGrams: 0,
        capacity: 20,
        lowStockThreshold: 5
      });

      expect(res.isValid).toBe(false);
      expect(res.stockStatus).toBe('UNKNOWN');
    });
  });

  // 3. Products CRUD
  describe('Product Management API', () => {
    it('GET /api/products returns list of products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(12);
    });

    it('POST /api/products creates a new product and prevents duplicate SKU', async () => {
      const uniqueSku = `TEST-SKU-${Date.now()}`;
      const newProduct = {
        name: 'Test Energy Bar',
        sku: uniqueSku,
        category: 'Bakery & Snacks',
        unit_weight_grams: 65,
        capacity: 30,
        low_stock_threshold: 6
      };

      const res = await request(app).post('/api/products').send(newProduct);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe(uniqueSku);

      // Attempt duplicate SKU
      const dupRes = await request(app).post('/api/products').send(newProduct);
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);
    });

    it('PUT /api/products/:id updates an existing product', async () => {
      const res = await request(app).put('/api/products/PROD-001').send({
        description: 'Updated description for biscuits'
      });
      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated description for biscuits');
    });
  });

  // 4. Shelves API
  describe('Shelf Management API', () => {
    it('GET /api/shelves returns all shelves with product information', async () => {
      const res = await request(app).get('/api/shelves');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(8);
      const shelf1 = res.body.data.find((s: any) => s.id === 'SH-001');
      expect(shelf1).toBeDefined();
      expect(shelf1.product_name).toBeDefined();
    });

    it('POST /api/shelves creates a new shelf', async () => {
      const uniqueShelfId = `SH-TEST-${Math.floor(Math.random() * 900 + 100)}`;
      const res = await request(app).post('/api/shelves').send({
        id: uniqueShelfId,
        name: 'Testing Shelf Bay',
        location: 'Aisle 9 - Test Tier',
        tare_weight_grams: 150,
        max_capacity_items: 20
      });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(uniqueShelfId);
    });
  });

  // 5. Restocking & Movements Workflow
  describe('Inventory Restocking and Movements', () => {
    it('POST /api/inventory/restock adds stock and records movement', async () => {
      const res = await request(app).post('/api/inventory/restock').send({
        shelfId: 'SH-003',
        productId: 'PROD-003',
        quantityToAdd: 10,
        reason: 'Restocking test batch',
        performedBy: 'Test Runner'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory.estimated_quantity).toBe(10);
      expect(res.body.data.movement.movement_type).toBe('RESTOCK');
      expect(res.body.data.movement.quantity_delta).toBe(10);
    });

    it('GET /api/inventory/movements returns movement history', async () => {
      const res = await request(app).get('/api/inventory/movements');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/inventory/export exports inventory CSV', async () => {
      const res = await request(app).get('/api/inventory/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Shelf ID');
    });
  });

  // 6. Sensor Ingestion & Authentication
  describe('Sensor Telemetry & Hardware Authentication', () => {
    it('allows simulated sensor reading ingestion without auth key', async () => {
      const res = await request(app)
        .post('/api/sensors/readings')
        .send({
          sensorId: 'SEN-001',
          weightGrams: 2050,
          source: 'SIMULATED'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects HARDWARE sensor telemetry if auth token is missing', async () => {
      const res = await request(app)
        .post('/api/sensors/readings')
        .send({
          sensorId: 'SEN-001',
          weightGrams: 2050,
          source: 'HARDWARE'
        });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('accepts HARDWARE sensor telemetry when valid X-Sensor-Key header is provided', async () => {
      const res = await request(app)
        .post('/api/sensors/readings')
        .set('X-Sensor-Key', 'smart_retail_esp32_secret_token_2026')
        .send({
          sensorId: 'SEN-001',
          weightGrams: 2050,
          source: 'HARDWARE'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // 7. Alerts Workflow
  describe('Alerts Management', () => {
    it('GET /api/alerts returns active and historical alerts', async () => {
      const res = await request(app).get('/api/alerts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/alerts/:id/acknowledge acknowledges an alert', async () => {
      const res = await request(app)
        .post('/api/alerts/ALT-1001/acknowledge')
        .send({ acknowledgedBy: 'Supervisor Jane' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/alerts/:id/resolve resolves an alert with notes', async () => {
      const res = await request(app)
        .post('/api/alerts/ALT-1001/resolve')
        .send({ resolutionNotes: 'Restocked shelf and verified weight' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 8. Dashboard and Analytics
  describe('Dashboard and Analytics Aggregations', () => {
    it('GET /api/dashboard/summary returns consolidated live metrics', async () => {
      const res = await request(app).get('/api/dashboard/summary');
      expect(res.status).toBe(200);
      expect(res.body.data.totalProducts).toBeGreaterThan(0);
      expect(res.body.data.totalShelves).toBeGreaterThan(0);
      expect(res.body.data.onlineSensors).toBeGreaterThanOrEqual(1);
      expect(res.body.data.urgentRestocking).toBeDefined();
    });

    it('GET /api/analytics/inventory returns status distributions', async () => {
      const res = await request(app).get('/api/analytics/inventory');
      expect(res.status).toBe(200);
      expect(res.body.data.statusDistribution).toBeDefined();
      expect(res.body.data.shelfFillRates).toBeDefined();
    });
  });

  // 9. Simulation Controls
  describe('Sensor Simulation API', () => {
    it('starts, changes scenario, and stops simulation cleanly', async () => {
      const startRes = await request(app)
        .post('/api/simulation/start')
        .send({ scenario: 'NORMAL', intervalMs: 5000 });
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.isActive).toBe(true);

      const scenRes = await request(app)
        .post('/api/simulation/scenario')
        .send({ scenario: 'RUSH_HOUR' });
      expect(scenRes.status).toBe(200);
      expect(scenRes.body.data.scenario).toBe('RUSH_HOUR');

      const stopRes = await request(app).post('/api/simulation/stop');
      expect(stopRes.status).toBe(200);
      expect(stopRes.body.data.isActive).toBe(false);
    });
  });
});
