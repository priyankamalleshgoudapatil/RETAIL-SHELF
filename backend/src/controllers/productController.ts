import { Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection';
import { Product, StockStatus } from '../types';
import { inventoryService } from '../services/inventoryService';

const productSchema = z.object({
  name: z.string().min(2, 'Product name must have at least 2 characters'),
  sku: z.string().min(2, 'SKU must have at least 2 characters'),
  category: z.string().min(2, 'Category is required'),
  description: z.string().optional(),
  unit_weight_grams: z.number().positive('Unit weight must be greater than zero'),
  shelf_id: z.string().nullable().optional(),
  capacity: z.number().int().positive('Capacity must be greater than zero').default(20),
  low_stock_threshold: z.number().int().min(0, 'Threshold cannot be negative').default(5),
});

export const productController = {
  getProducts: (req: Request, res: Response) => {
    const db = getDatabase();
    const { search, category, status } = req.query;

    let query = `
      SELECT 
        p.*,
        s.name as shelf_name, s.location as shelf_location,
        i.estimated_quantity, i.current_gross_weight, i.stock_percentage,
        COALESCE(i.stock_status, 'UNKNOWN') as stock_status,
        sn.id as sensor_id, sn.connection_status as sensor_status
      FROM products p
      LEFT JOIN shelves s ON p.shelf_id = s.id
      LEFT JOIN inventory i ON (p.id = i.product_id AND p.shelf_id = i.shelf_id)
      LEFT JOIN sensors sn ON s.id = sn.shelf_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string') {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category && typeof category === 'string' && category !== 'ALL') {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      query += ` AND COALESCE(i.stock_status, 'UNKNOWN') = ?`;
      params.push(status);
    }

    query += ` ORDER BY p.name ASC`;
    const products = db.prepare(query).all(...params);

    res.json({ success: true, data: products });
  },

  getProductById: (req: Request, res: Response) => {
    const db = getDatabase();
    const { id } = req.params;

    const product = db.prepare(`
      SELECT 
        p.*,
        s.name as shelf_name, s.location as shelf_location, s.tare_weight_grams,
        i.estimated_quantity, i.current_gross_weight, i.current_net_weight, i.stock_percentage,
        COALESCE(i.stock_status, 'UNKNOWN') as stock_status, i.last_calculated_at,
        sn.id as sensor_id, sn.connection_status as sensor_status
      FROM products p
      LEFT JOIN shelves s ON p.shelf_id = s.id
      LEFT JOIN inventory i ON (p.id = i.product_id AND p.shelf_id = i.shelf_id)
      LEFT JOIN sensors sn ON s.id = sn.shelf_id
      WHERE p.id = ?
    `).get(id) as any;

    if (!product) {
      res.status(404).json({ success: false, error: `Product ${id} not found.` });
      return;
    }

    // Also get recent movements for this product
    const movements = db.prepare(`
      SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(id);

    res.json({ success: true, data: { ...product, recent_movements: movements } });
  },

  createProduct: (req: Request, res: Response) => {
    const db = getDatabase();
    const parsed = productSchema.parse(req.body);

    // Check duplicate SKU
    const existingSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(parsed.sku);
    if (existingSku) {
      res.status(409).json({ success: false, error: `Product with SKU '${parsed.sku}' already exists.` });
      return;
    }

    // Check shelf assignment conflicts
    if (parsed.shelf_id) {
      const shelf = db.prepare('SELECT id, current_product_id FROM shelves WHERE id = ?').get(parsed.shelf_id) as any;
      if (!shelf) {
        res.status(400).json({ success: false, error: `Assigned shelf '${parsed.shelf_id}' does not exist.` });
        return;
      }
      if (shelf.current_product_id) {
        res.status(409).json({
          success: false,
          error: `Shelf '${parsed.shelf_id}' is already occupied by product ${shelf.current_product_id}. Reassign that product first.`
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const id = `PROD-${Date.now().toString(36).toUpperCase()}`;

    const createTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO products (id, name, sku, category, description, unit_weight_grams, shelf_id, capacity, low_stock_threshold, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        parsed.name,
        parsed.sku,
        parsed.category,
        parsed.description || '',
        parsed.unit_weight_grams,
        parsed.shelf_id || null,
        parsed.capacity,
        parsed.low_stock_threshold,
        now,
        now
      );

      if (parsed.shelf_id) {
        db.prepare('UPDATE shelves SET current_product_id = ?, updated_at = ? WHERE id = ?').run(id, now, parsed.shelf_id);
        
        // Initialize empty inventory record for this product and shelf
        db.prepare(`
          INSERT INTO inventory (product_id, shelf_id, current_gross_weight, current_net_weight, estimated_quantity, stock_percentage, stock_status, last_calculated_at)
          VALUES (?, ?, 0, 0, 0, 0, 'OUT_OF_STOCK', ?)
        `).run(id, parsed.shelf_id, now);
      }
    });

    createTx();

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.status(201).json({ success: true, message: 'Product created successfully', data: created });
  },

  updateProduct: (req: Request, res: Response) => {
    const db = getDatabase();
    const { id } = req.params;
    const parsed = productSchema.partial().parse(req.body);

    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
    if (!current) {
      res.status(404).json({ success: false, error: `Product ${id} not found.` });
      return;
    }

    // Check SKU conflict
    if (parsed.sku && parsed.sku !== current.sku) {
      const existingSku = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(parsed.sku, id);
      if (existingSku) {
        res.status(409).json({ success: false, error: `SKU '${parsed.sku}' is already in use by another product.` });
        return;
      }
    }

    const now = new Date().toISOString();

    const updateTx = db.transaction(() => {
      // If shelf changed
      if (parsed.shelf_id !== undefined && parsed.shelf_id !== current.shelf_id) {
        // Clear previous shelf association
        if (current.shelf_id) {
          db.prepare('UPDATE shelves SET current_product_id = NULL, updated_at = ? WHERE id = ?').run(now, current.shelf_id);
        }

        // Assign new shelf if not null
        if (parsed.shelf_id) {
          const newShelf = db.prepare('SELECT id, current_product_id FROM shelves WHERE id = ?').get(parsed.shelf_id) as any;
          if (!newShelf) throw new Error(`Shelf ${parsed.shelf_id} not found.`);
          if (newShelf.current_product_id && newShelf.current_product_id !== id) {
            throw new Error(`Shelf ${parsed.shelf_id} is already occupied by product ${newShelf.current_product_id}.`);
          }
          db.prepare('UPDATE shelves SET current_product_id = ?, updated_at = ? WHERE id = ?').run(id, now, parsed.shelf_id);
          
          // Ensure inventory record exists
          const inv = db.prepare('SELECT id FROM inventory WHERE product_id = ? AND shelf_id = ?').get(id, parsed.shelf_id);
          if (!inv) {
            db.prepare(`
              INSERT INTO inventory (product_id, shelf_id, current_gross_weight, current_net_weight, estimated_quantity, stock_percentage, stock_status, last_calculated_at)
              VALUES (?, ?, 0, 0, 0, 0, 'OUT_OF_STOCK', ?)
            `).run(id, parsed.shelf_id, now);
          }
        }
      }

      db.prepare(`
        UPDATE products 
        SET name = COALESCE(?, name),
            sku = COALESCE(?, sku),
            category = COALESCE(?, category),
            description = COALESCE(?, description),
            unit_weight_grams = COALESCE(?, unit_weight_grams),
            shelf_id = ?,
            capacity = COALESCE(?, capacity),
            low_stock_threshold = COALESCE(?, low_stock_threshold),
            updated_at = ?
        WHERE id = ?
      `).run(
        parsed.name ?? null,
        parsed.sku ?? null,
        parsed.category ?? null,
        parsed.description ?? null,
        parsed.unit_weight_grams ?? null,
        parsed.shelf_id !== undefined ? parsed.shelf_id : current.shelf_id,
        parsed.capacity ?? null,
        parsed.low_stock_threshold ?? null,
        now,
        id
      );
    });

    updateTx();

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ success: true, message: 'Product updated successfully', data: updated });
  },

  deleteProduct: (req: Request, res: Response) => {
    const db = getDatabase();
    const { id } = req.params;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
    if (!product) {
      res.status(404).json({ success: false, error: `Product ${id} not found.` });
      return;
    }

    // Check if product is currently stocked on a shelf with items > 0
    const activeInventory = db.prepare(`
      SELECT estimated_quantity FROM inventory WHERE product_id = ? AND estimated_quantity > 0
    `).get(id) as { estimated_quantity: number } | undefined;

    if (activeInventory && activeInventory.estimated_quantity > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete product '${product.name}' because it currently has ${activeInventory.estimated_quantity} active items in stock. Please restock or adjust quantity to 0 and unassign from the shelf before deletion.`
      });
      return;
    }

    const deleteTx = db.transaction(() => {
      // Unlink from shelves
      db.prepare('UPDATE shelves SET current_product_id = NULL WHERE current_product_id = ?').run(id);
      // Remove inventory records
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
      // Delete product
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    });

    deleteTx();

    res.json({ success: true, message: `Product '${product.name}' was safely removed.` });
  }
};
