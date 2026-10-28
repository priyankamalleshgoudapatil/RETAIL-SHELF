import { Request, Response } from 'express';
import { z } from 'zod';
import { inventoryService } from '../services/inventoryService';
import { generateCsv } from '../utils/csv';

const restockSchema = z.object({
  shelfId: z.string().min(1, 'Shelf ID required'),
  productId: z.string().min(1, 'Product ID required'),
  quantityToAdd: z.number().int().positive('Quantity to add must be a positive integer'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  performedBy: z.string().optional(),
});

const adjustSchema = z.object({
  shelfId: z.string().min(1, 'Shelf ID required'),
  productId: z.string().min(1, 'Product ID required'),
  newQuantity: z.number().int().min(0, 'Quantity cannot be negative'),
  reason: z.string().min(2, 'Reason for adjustment required'),
  notes: z.string().optional(),
  adjustedBy: z.string().optional(),
});

export const inventoryController = {
  getInventory: (req: Request, res: Response) => {
    const list = inventoryService.getInventoryList();
    res.json({ success: true, data: list });
  },

  restock: (req: Request, res: Response) => {
    const parsed = restockSchema.parse(req.body);
    const result = inventoryService.restockShelf(parsed);
    res.json({
      success: true,
      message: `Successfully restocked ${parsed.quantityToAdd} units.`,
      data: result
    });
  },

  adjust: (req: Request, res: Response) => {
    const parsed = adjustSchema.parse(req.body);
    const result = inventoryService.adjustStock(parsed);
    res.json({
      success: true,
      message: `Stock successfully adjusted to ${parsed.newQuantity} units.`,
      data: result
    });
  },

  getMovements: (req: Request, res: Response) => {
    const { productId, shelfId, type, limit } = req.query;
    const movements = inventoryService.getMovements({
      productId: typeof productId === 'string' ? productId : undefined,
      shelfId: typeof shelfId === 'string' ? shelfId : undefined,
      movementType: typeof type === 'string' ? (type as any) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
    });
    res.json({ success: true, data: movements });
  },

  exportCsv: (req: Request, res: Response) => {
    const list = inventoryService.getInventoryList();
    const headers = [
      'Shelf ID', 'Shelf Name', 'Location', 'Product ID', 'Product Name', 'SKU', 
      'Category', 'Unit Weight (g)', 'Gross Weight (g)', 'Net Weight (g)', 
      'Estimated Quantity', 'Capacity', 'Stock %', 'Status', 'Sensor ID', 'Sensor Status', 'Last Calculated'
    ];

    const rows = list.map(item => [
      item.shelf_id,
      item.shelf_name,
      item.shelf_location,
      item.product_id,
      item.product_name,
      item.product_sku,
      item.product_category,
      item.unit_weight_grams,
      item.current_gross_weight,
      item.current_net_weight,
      item.estimated_quantity,
      item.product_capacity,
      item.stock_percentage,
      item.stock_status,
      item.sensor_id || 'N/A',
      item.sensor_status || 'N/A',
      item.last_calculated_at
    ]);

    const csvContent = generateCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="smart_retail_inventory_${Date.now()}.csv"`);
    res.send(csvContent);
  },

  exportMovementsCsv: (req: Request, res: Response) => {
    const movements = inventoryService.getMovements({ limit: 1000 });
    const headers = [
      'ID', 'Timestamp', 'Product Name', 'SKU', 'Shelf Name', 
      'Movement Type', 'Delta', 'Previous Qty', 'New Qty', 'Previous Weight (g)', 'New Weight (g)', 'Reason', 'Notes'
    ];

    const rows = movements.map(m => [
      m.id,
      m.created_at,
      m.product_name,
      m.product_sku,
      m.shelf_name,
      m.movement_type,
      m.quantity_delta,
      m.previous_quantity,
      m.new_quantity,
      m.previous_weight ?? 'N/A',
      m.new_weight ?? 'N/A',
      m.reason,
      m.notes || ''
    ]);

    const csvContent = generateCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="stock_movements_${Date.now()}.csv"`);
    res.send(csvContent);
  }
};
