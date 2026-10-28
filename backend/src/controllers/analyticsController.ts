import { Request, Response } from 'express';
import { getDatabase } from '../db/connection';
import { generateCsv } from '../utils/csv';

export const analyticsController = {
  getInventoryAnalytics: (req: Request, res: Response) => {
    const db = getDatabase();

    // 1. Status distribution
    const statusDistribution = db.prepare(`
      SELECT 
        stock_status as name, 
        COUNT(*) as value,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM inventory), 1) as percentage
      FROM inventory
      GROUP BY stock_status
    `).all();

    // 2. Category distribution
    const categoryDistribution = db.prepare(`
      SELECT 
        p.category as name,
        COUNT(DISTINCT p.id) as product_count,
        SUM(COALESCE(i.estimated_quantity, 0)) as total_units,
        ROUND(AVG(COALESCE(i.stock_percentage, 0)), 1) as avg_fill_rate
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY p.category
    `).all();

    // 3. Low-Stock & Out-of-Stock incident frequency by product
    const incidentFrequency = db.prepare(`
      SELECT 
        p.name as product_name,
        p.sku,
        COUNT(CASE WHEN a.alert_type = 'LOW_STOCK' THEN 1 END) as low_stock_incidents,
        COUNT(CASE WHEN a.alert_type = 'OUT_OF_STOCK' THEN 1 END) as stockout_incidents,
        COUNT(a.id) as total_incidents
      FROM products p
      LEFT JOIN alerts a ON p.id = a.product_id
      GROUP BY p.id
      HAVING total_incidents > 0
      ORDER BY total_incidents DESC
      LIMIT 10
    `).all();

    // 4. Sensor connectivity breakdown
    const sensorHealth = db.prepare(`
      SELECT 
        connection_status as status,
        COUNT(*) as count,
        data_source as source
      FROM sensors
      GROUP BY connection_status, data_source
    `).all();

    // 5. Shelf Fill Rate Comparison
    const shelfFillRates = db.prepare(`
      SELECT 
        s.name as shelf_name,
        p.name as product_name,
        COALESCE(i.stock_percentage, 0) as fill_percentage,
        COALESCE(i.estimated_quantity, 0) as quantity,
        COALESCE(p.capacity, s.max_capacity_items) as capacity,
        COALESCE(i.stock_status, 'UNKNOWN') as status
      FROM shelves s
      LEFT JOIN products p ON s.current_product_id = p.id
      LEFT JOIN inventory i ON s.id = i.shelf_id
      ORDER BY fill_percentage ASC
    `).all();

    res.json({
      success: true,
      data: {
        statusDistribution,
        categoryDistribution,
        incidentFrequency,
        sensorHealth,
        shelfFillRates,
      }
    });
  },

  getRestockingAnalytics: (req: Request, res: Response) => {
    const db = getDatabase();

    // Daily / chronological restock velocity
    const restockVelocity = db.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(CASE WHEN movement_type = 'RESTOCK' THEN 1 END) as restock_operations,
        SUM(CASE WHEN movement_type = 'RESTOCK' THEN quantity_delta ELSE 0 END) as units_restocked,
        COUNT(CASE WHEN movement_type = 'CONSUMPTION' THEN 1 END) as customer_pickups,
        ABS(SUM(CASE WHEN movement_type = 'CONSUMPTION' THEN quantity_delta ELSE 0 END)) as units_consumed
      FROM stock_movements
      GROUP BY date(created_at)
      ORDER BY date ASC
      LIMIT 30
    `).all();

    // Top restocked products
    const topRestockedProducts = db.prepare(`
      SELECT 
        p.name as product_name,
        p.sku,
        COUNT(m.id) as restock_events,
        SUM(m.quantity_delta) as total_units_replenished
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      WHERE m.movement_type = 'RESTOCK'
      GROUP BY p.id
      ORDER BY total_units_replenished DESC
      LIMIT 8
    `).all();

    res.json({
      success: true,
      data: {
        restockVelocity,
        topRestockedProducts,
      }
    });
  },

  exportReportCsv: (req: Request, res: Response) => {
    const db = getDatabase();

    const incidentData = db.prepare(`
      SELECT 
        p.name as product_name,
        p.sku,
        p.category,
        COALESCE(i.estimated_quantity, 0) as current_stock,
        COALESCE(i.stock_status, 'UNKNOWN') as current_status,
        COUNT(CASE WHEN a.alert_type = 'LOW_STOCK' THEN 1 END) as low_stock_alerts,
        COUNT(CASE WHEN a.alert_type = 'OUT_OF_STOCK' THEN 1 END) as stockout_alerts
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      LEFT JOIN alerts a ON p.id = a.product_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all() as any[];

    const headers = [
      'Product Name', 'SKU', 'Category', 'Current Stock', 'Stock Status', 
      'Low Stock Incidents', 'Stockout Incidents'
    ];

    const rows = incidentData.map(r => [
      r.product_name,
      r.sku,
      r.category,
      r.current_stock,
      r.current_status,
      r.low_stock_alerts,
      r.stockout_alerts
    ]);

    const csvContent = generateCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="retail_analytics_report_${Date.now()}.csv"`);
    res.send(csvContent);
  }
};
