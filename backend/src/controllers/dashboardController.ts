import { Request, Response } from 'express';
import { getDatabase } from '../db/connection';
import { simulationService } from '../services/simulationService';
import { alertService } from '../services/alertService';
import { sensorService } from '../services/sensorService';

export const dashboardController = {
  getSummary: (req: Request, res: Response) => {
    const db = getDatabase();

    // Check sensor offline states in real-time
    sensorService.checkSensorHealth();

    // 1. Counts
    const totalProducts = (db.prepare('SELECT COUNT(*) as c FROM products').get() as any).c;
    const totalShelves = (db.prepare('SELECT COUNT(*) as c FROM shelves').get() as any).c;

    const sensorStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN connection_status = 'ONLINE' THEN 1 ELSE 0 END) as online_count,
        SUM(CASE WHEN connection_status != 'ONLINE' THEN 1 ELSE 0 END) as offline_count
      FROM sensors
    `).get() as any;

    const onlineSensors = sensorStats?.online_count || 0;
    const offlineSensors = sensorStats?.offline_count || 0;

    const shelfStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN stock_status = 'IN_STOCK' THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN stock_status = 'LOW_STOCK' THEN 1 ELSE 0 END) as low_stock,
        SUM(CASE WHEN stock_status = 'OUT_OF_STOCK' THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN stock_status = 'UNKNOWN' THEN 1 ELSE 0 END) as unknown_stock
      FROM inventory
    `).get() as any;

    const inStockShelves = shelfStats?.in_stock || 0;
    const lowStockShelves = shelfStats?.low_stock || 0;
    const outOfStockShelves = shelfStats?.out_of_stock || 0;
    const unknownShelves = shelfStats?.unknown_stock || 0;

    const activeAlertsCount = (db.prepare('SELECT COUNT(*) as c FROM alerts WHERE resolved = 0').get() as any).c;

    // 2. Urgent Restocking Items (Out of stock or Low stock)
    const urgentRestocking = db.prepare(`
      SELECT 
        p.id as productId, p.name as productName, p.sku,
        s.id as shelfId, s.name as shelfName, s.location as shelfLocation,
        i.estimated_quantity as currentQuantity, p.capacity, p.low_stock_threshold as threshold,
        i.stock_percentage as stockPercentage, i.stock_status as status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN shelves s ON i.shelf_id = s.id
      WHERE i.stock_status IN ('OUT_OF_STOCK', 'LOW_STOCK')
      ORDER BY 
        CASE i.stock_status WHEN 'OUT_OF_STOCK' THEN 1 ELSE 2 END,
        i.estimated_quantity ASC
      LIMIT 8
    `).all() as any[];

    // 3. Critical Unresolved Alerts
    const criticalAlerts = alertService.getAlerts({ resolved: false, limit: 5 });

    // 4. Recent Stock Movements
    const recentMovements = db.prepare(`
      SELECT m.*, p.name as product_name, p.sku as product_sku, s.name as shelf_name
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      JOIN shelves s ON m.shelf_id = s.id
      ORDER BY m.created_at DESC
      LIMIT 8
    `).all();

    // 5. Recent Sensor Readings
    const recentReadings = db.prepare(`
      SELECT r.*, s.name as shelf_name, sn.sensor_type
      FROM sensor_readings r
      LEFT JOIN shelves s ON r.shelf_id = s.id
      LEFT JOIN sensors sn ON r.sensor_id = sn.id
      ORDER BY r.server_receipt_timestamp DESC
      LIMIT 8
    `).all();

    // 6. Hourly / Movement trend for charts
    // Fetch last 12 hours aggregated or last 10 movements
    const inventoryHistory = db.prepare(`
      SELECT 
        strftime('%H:%M', created_at) as time_label,
        COUNT(CASE WHEN movement_type = 'RESTOCK' THEN 1 END) as restock_count,
        COUNT(CASE WHEN movement_type = 'CONSUMPTION' THEN 1 END) as consumption_count,
        AVG(new_quantity) as avg_quantity
      FROM stock_movements
      GROUP BY strftime('%Y-%m-%d %H', created_at)
      ORDER BY created_at ASC
      LIMIT 12
    `).all();

    const simStatus = simulationService.getStatus();

    res.json({
      success: true,
      data: {
        totalProducts,
        totalShelves,
        onlineSensors,
        offlineSensors,
        inStockShelves,
        lowStockShelves,
        outOfStockShelves,
        unknownShelves,
        activeAlertsCount,
        isSimulationActive: simStatus.isActive,
        activeScenario: simStatus.scenario,
        criticalAlerts,
        urgentRestocking,
        recentMovements,
        recentReadings,
        inventoryHistory,
      }
    });
  }
};
