import { Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection';
import { Shelf } from '../types';

const shelfSchema = z.object({
  id: z.string().min(2, 'Shelf ID required').optional(),
  name: z.string().min(2, 'Shelf name required'),
  location: z.string().min(2, 'Location description required'),
  tare_weight_grams: z.number().min(0, 'Tare weight cannot be negative').default(0),
  max_capacity_items: z.number().int().positive('Max capacity must be positive').default(20),
});

export const shelfController = {
  getShelves: (req: Request, res: Response) => {
    const db = getDatabase();
    const { status, search } = req.query;

    let query = `
      SELECT 
        s.*,
        p.id as product_id, p.name as product_name, p.sku as product_sku, p.unit_weight_grams,
        p.low_stock_threshold,
        i.estimated_quantity, i.current_gross_weight, i.current_net_weight, i.stock_percentage,
        COALESCE(i.stock_status, 'UNKNOWN') as stock_status, i.last_calculated_at,
        sn.id as sensor_id, sn.sensor_type, sn.connection_status as sensor_status, sn.data_source as sensor_source,
        sn.last_seen_at as sensor_last_seen
      FROM shelves s
      LEFT JOIN products p ON s.current_product_id = p.id
      LEFT JOIN inventory i ON (s.id = i.shelf_id AND p.id = i.product_id)
      LEFT JOIN sensors sn ON s.id = sn.shelf_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string') {
      query += ` AND (s.name LIKE ? OR s.location LIKE ? OR s.id LIKE ? OR p.name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      query += ` AND COALESCE(i.stock_status, 'UNKNOWN') = ?`;
      params.push(status);
    }

    query += ` ORDER BY s.id ASC`;
    const shelves = db.prepare(query).all(...params);

    res.json({ success: true, data: shelves });
  },

  getShelfById: (req: Request, res: Response) => {
    const db = getDatabase();
    const { id } = req.params;

    const shelf = db.prepare(`
      SELECT 
        s.*,
        p.id as product_id, p.name as product_name, p.sku as product_sku, p.category as product_category,
        p.unit_weight_grams, p.low_stock_threshold,
        i.estimated_quantity, i.current_gross_weight, i.current_net_weight, i.stock_percentage,
        COALESCE(i.stock_status, 'UNKNOWN') as stock_status, i.last_calculated_at,
        sn.id as sensor_id, sn.sensor_type, sn.connection_status as sensor_status, sn.data_source as sensor_source,
        sn.last_seen_at as sensor_last_seen, sn.offline_timeout_sec
      FROM shelves s
      LEFT JOIN products p ON s.current_product_id = p.id
      LEFT JOIN inventory i ON (s.id = i.shelf_id AND p.id = i.product_id)
      LEFT JOIN sensors sn ON s.id = sn.shelf_id
      WHERE s.id = ?
    `).get(id) as any;

    if (!shelf) {
      res.status(404).json({ success: false, error: `Shelf ${id} not found.` });
      return;
    }

    // Recent readings
    const readings = db.prepare(`
      SELECT * FROM sensor_readings WHERE shelf_id = ? ORDER BY server_receipt_timestamp DESC LIMIT 20
    `).all(id);

    // Active alerts for this shelf
    const alerts = db.prepare(`
      SELECT * FROM alerts WHERE shelf_id = ? AND resolved = 0 ORDER BY created_at DESC
    `).all(id);

    res.json({ success: true, data: { ...shelf, recent_readings: readings, active_alerts: alerts } });
  },

  createShelf: (req: Request, res: Response) => {
    const db = getDatabase();
    const parsed = shelfSchema.parse(req.body);

    const now = new Date().toISOString();
    let id = parsed.id;
    if (!id) {
      const count = (db.prepare('SELECT COUNT(*) as c FROM shelves').get() as any).c + 1;
      id = `SH-${count.toString().padStart(3, '0')}`;
    }

    const existing = db.prepare('SELECT id FROM shelves WHERE id = ?').get(id);
    if (existing) {
      res.status(409).json({ success: false, error: `Shelf ID '${id}' already exists.` });
      return;
    }

    db.prepare(`
      INSERT INTO shelves (id, name, location, tare_weight_grams, max_capacity_items, current_product_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      parsed.name,
      parsed.location,
      parsed.tare_weight_grams,
      parsed.max_capacity_items,
      now,
      now
    );

    const created = db.prepare('SELECT * FROM shelves WHERE id = ?').get(id);
    res.status(201).json({ success: true, message: 'Shelf created successfully', data: created });
  },

  updateShelf: (req: Request, res: Response) => {
    const db = getDatabase();
    const { id } = req.params;
    const parsed = shelfSchema.partial().parse(req.body);

    const current = db.prepare('SELECT * FROM shelves WHERE id = ?').get(id) as Shelf | undefined;
    if (!current) {
      res.status(404).json({ success: false, error: `Shelf ${id} not found.` });
      return;
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE shelves 
      SET name = COALESCE(?, name),
          location = COALESCE(?, location),
          tare_weight_grams = COALESCE(?, tare_weight_grams),
          max_capacity_items = COALESCE(?, max_capacity_items),
          updated_at = ?
      WHERE id = ?
    `).run(
      parsed.name ?? null,
      parsed.location ?? null,
      parsed.tare_weight_grams ?? null,
      parsed.max_capacity_items ?? null,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM shelves WHERE id = ?').get(id);
    res.json({ success: true, message: 'Shelf updated successfully', data: updated });
  },

  deleteShelf: (req: Request, res: Response) => {
    const db = getDatabase();
    const { id } = req.params;

    const shelf = db.prepare('SELECT * FROM shelves WHERE id = ?').get(id) as Shelf | undefined;
    if (!shelf) {
      res.status(404).json({ success: false, error: `Shelf ${id} not found.` });
      return;
    }

    // Check if shelf has assigned product or active sensor
    if (shelf.current_product_id) {
      res.status(400).json({
        success: false,
        error: `Cannot delete shelf ${id} while product ${shelf.current_product_id} is assigned. Please reassign the product first.`
      });
      return;
    }

    const assignedSensor = db.prepare('SELECT id FROM sensors WHERE shelf_id = ?').get(id) as { id: string } | undefined;
    if (assignedSensor) {
      res.status(400).json({
        success: false,
        error: `Cannot delete shelf ${id} while sensor ${assignedSensor.id} is bound to it. Please reassign the sensor first.`
      });
      return;
    }

    db.prepare('DELETE FROM shelves WHERE id = ?').run(id);
    res.json({ success: true, message: `Shelf ${id} deleted successfully.` });
  }
};
