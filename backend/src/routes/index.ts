import { Router } from 'express';
import { productController } from '../controllers/productController';
import { shelfController } from '../controllers/shelfController';
import { inventoryController } from '../controllers/inventoryController';
import { sensorController } from '../controllers/sensorController';
import { alertController } from '../controllers/alertController';
import { dashboardController } from '../controllers/dashboardController';
import { analyticsController } from '../controllers/analyticsController';
import { simulationController } from '../controllers/simulationController';
import { settingsController } from '../controllers/settingsController';
import { authenticateSensorRequest } from '../middleware/auth';
import { getDatabase } from '../db/connection';

export const apiRouter = Router();

// --- System & Health ---
apiRouter.get('/health', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT 1 as healthy').get() as { healthy: number };
    res.json({
      success: true,
      data: {
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: result?.healthy === 1 ? 'CONNECTED' : 'DEGRADED',
        uptimeSeconds: Math.round(process.uptime()),
        version: '1.0.0'
      }
    });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      data: {
        status: 'DOWN',
        database: 'DISCONNECTED',
        error: err.message
      }
    });
  }
});

// --- Dashboard ---
apiRouter.get('/dashboard/summary', dashboardController.getSummary);

// --- Products ---
apiRouter.get('/products', productController.getProducts);
apiRouter.get('/products/:id', productController.getProductById);
apiRouter.post('/products', productController.createProduct);
apiRouter.put('/products/:id', productController.updateProduct);
apiRouter.delete('/products/:id', productController.deleteProduct);

// --- Shelves ---
apiRouter.get('/shelves', shelfController.getShelves);
apiRouter.get('/shelves/:id', shelfController.getShelfById);
apiRouter.post('/shelves', shelfController.createShelf);
apiRouter.put('/shelves/:id', shelfController.updateShelf);
apiRouter.delete('/shelves/:id', shelfController.deleteShelf);

// --- Inventory ---
apiRouter.get('/inventory', inventoryController.getInventory);
apiRouter.post('/inventory/restock', inventoryController.restock);
apiRouter.post('/inventory/adjust', inventoryController.adjust);
apiRouter.get('/inventory/movements', inventoryController.getMovements);
apiRouter.get('/inventory/export', inventoryController.exportCsv);
apiRouter.get('/inventory/movements/export', inventoryController.exportMovementsCsv);

// --- Sensors & Telemetry ---
apiRouter.get('/sensors', sensorController.getSensors);
apiRouter.get('/sensors/:id', sensorController.getSensorById);
apiRouter.get('/sensors/:id/readings', sensorController.getReadings);
apiRouter.post('/sensors/readings', authenticateSensorRequest, sensorController.postReading);

// --- Alerts ---
apiRouter.get('/alerts', alertController.getAlerts);
apiRouter.post('/alerts/:id/acknowledge', alertController.acknowledge);
apiRouter.post('/alerts/:id/resolve', alertController.resolve);

// --- Analytics & Reports ---
apiRouter.get('/analytics/inventory', analyticsController.getInventoryAnalytics);
apiRouter.get('/analytics/restocking', analyticsController.getRestockingAnalytics);
apiRouter.get('/analytics/export', analyticsController.exportReportCsv);

// --- Sensor Simulation ---
apiRouter.get('/simulation/status', simulationController.getStatus);
apiRouter.post('/simulation/start', simulationController.start);
apiRouter.post('/simulation/stop', simulationController.stop);
apiRouter.post('/simulation/scenario', simulationController.setScenario);
apiRouter.post('/simulation/reset', simulationController.reset);

// --- Settings ---
apiRouter.get('/settings', settingsController.getSettings);
apiRouter.put('/settings', settingsController.updateSettings);
