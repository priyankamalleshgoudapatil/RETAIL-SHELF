import { getDatabase } from '../db/connection';
import { InventoryItem, StockMovement, StockStatus, MovementType } from '../types';
import { alertService } from './alertService';
import { logger } from '../utils/logger';

export interface CalculationResult {
  netWeightGrams: number;
  estimatedQuantity: number;
  stockPercentage: number;
  stockStatus: StockStatus;
  isValid: boolean;
  notes?: string;
}

export class InventoryService {
  private db = getDatabase();

  /**
   * Pure calculation function:
   * Net product weight = Measured gross weight − Empty shelf/platform tare weight.
   * Estimated quantity = Rounded net product weight / Calibrated unit weight.
   * Clamped to [0, shelf capacity].
   */
  public calculateStock(params: {
    grossWeightGrams: number;
    tareWeightGrams: number;
    unitWeightGrams: number;
    capacity: number;
    lowStockThreshold: number;
  }): CalculationResult {
    const { grossWeightGrams, tareWeightGrams, unitWeightGrams, capacity, lowStockThreshold } = params;

    // Check calibration validity
    if (!unitWeightGrams || unitWeightGrams <= 0) {
      return {
        netWeightGrams: 0,
        estimatedQuantity: 0,
        stockPercentage: 0,
        stockStatus: 'UNKNOWN',
        isValid: false,
        notes: 'Uncalibrated product: Unit weight is zero or undefined.'
      };
    }

    const netWeight = grossWeightGrams - tareWeightGrams;

    // Handle negative net weight within noise tolerance
    if (netWeight < -Math.max(5, unitWeightGrams * 0.3)) {
      return {
        netWeightGrams: Math.round(netWeight * 10) / 10,
        estimatedQuantity: 0,
        stockPercentage: 0,
        stockStatus: 'UNKNOWN',
        isValid: false,
        notes: `Negative weight reading (${netWeight.toFixed(1)}g) exceeds tare allowance.`
      };
    }

    const clampedNetWeight = Math.max(0, netWeight);
    const rawQuantity = clampedNetWeight / unitWeightGrams;
    const roundedQuantity = Math.round(rawQuantity);
    const estimatedQuantity = Math.max(0, Math.min(capacity, roundedQuantity));
    const stockPercentage = capacity > 0 ? Math.min(100, Math.round((estimatedQuantity / capacity) * 10000) / 100) : 0;

    let stockStatus: StockStatus;
    if (estimatedQuantity === 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (estimatedQuantity <= lowStockThreshold) {
      stockStatus = 'LOW_STOCK';
    } else {
      stockStatus = 'IN_STOCK';
    }

    return {
      netWeightGrams: Math.round(clampedNetWeight * 10) / 10,
      estimatedQuantity,
      stockPercentage,
      stockStatus,
      isValid: true
    };
  }

  /**
   * Updates inventory when a sensor delivers a valid weight reading.
   * Uses deadband noise filtering to prevent false micro-movements.
   */
  public updateInventoryFromSensor(params: {
    shelfId: string;
    grossWeightGrams: number;
    readingTimestamp: string;
    sensorId?: string;
  }): InventoryItem | null {
    const { shelfId, grossWeightGrams, readingTimestamp, sensorId } = params;

    // Fetch shelf and associated product
    const shelf = this.db.prepare(`
      SELECT s.*, p.id as product_id, p.name as product_name, p.unit_weight_grams, 
             p.capacity as product_capacity, p.low_stock_threshold
      FROM shelves s
      LEFT JOIN products p ON s.current_product_id = p.id
      WHERE s.id = ?
    `).get(shelfId) as any;

    if (!shelf || !shelf.product_id) {
      logger.debug(`No product assigned to shelf ${shelfId}. Skipping inventory calculation.`);
      return null;
    }

    const calculation = this.calculateStock({
      grossWeightGrams,
      tareWeightGrams: shelf.tare_weight_grams || 0,
      unitWeightGrams: shelf.unit_weight_grams,
      capacity: shelf.product_capacity || shelf.max_capacity_items || 20,
      lowStockThreshold: shelf.low_stock_threshold || 5
    });

    if (!calculation.isValid) {
      logger.warn(`Invalid calculation for shelf ${shelfId}: ${calculation.notes}`);
      // Record reading as abnormal if weight is drastically negative
      if (grossWeightGrams < (shelf.tare_weight_grams || 0) - 50) {
        alertService.createAbnormalReadingAlert(
          sensorId || 'UNKNOWN',
          shelfId,
          grossWeightGrams,
          calculation.notes || 'Sensor weight significantly below tare weight.'
        );
      }
      return null;
    }

    const now = new Date().toISOString();

    // Check existing inventory for this product and shelf
    const existing = this.db.prepare(`
      SELECT * FROM inventory WHERE product_id = ? AND shelf_id = ?
    `).get(shelf.product_id, shelfId) as InventoryItem | undefined;

    let updatedInventory: InventoryItem;

    if (!existing) {
      // First inventory record
      this.db.prepare(`
        INSERT INTO inventory (product_id, shelf_id, current_gross_weight, current_net_weight, estimated_quantity, stock_percentage, stock_status, last_calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        shelf.product_id,
        shelfId,
        grossWeightGrams,
        calculation.netWeightGrams,
        calculation.estimatedQuantity,
        calculation.stockPercentage,
        calculation.stockStatus,
        now
      );

      updatedInventory = {
        id: 0,
        product_id: shelf.product_id,
        shelf_id: shelfId,
        current_gross_weight: grossWeightGrams,
        current_net_weight: calculation.netWeightGrams,
        estimated_quantity: calculation.estimatedQuantity,
        stock_percentage: calculation.stockPercentage,
        stock_status: calculation.stockStatus,
        last_calculated_at: now
      };
    } else {
      const prevQuantity = existing.estimated_quantity;
      const prevWeight = existing.current_gross_weight;
      const quantityDiff = calculation.estimatedQuantity - prevQuantity;

      // Update inventory record
      this.db.prepare(`
        UPDATE inventory 
        SET current_gross_weight = ?, 
            current_net_weight = ?, 
            estimated_quantity = ?, 
            stock_percentage = ?, 
            stock_status = ?, 
            last_calculated_at = ?
        WHERE id = ?
      `).run(
        grossWeightGrams,
        calculation.netWeightGrams,
        calculation.estimatedQuantity,
        calculation.stockPercentage,
        calculation.stockStatus,
        now,
        existing.id
      );

      // If quantity changed, log stock movement
      if (quantityDiff !== 0) {
        const movementType: MovementType = quantityDiff > 0 ? 'RESTOCK' : 'CONSUMPTION';
        const reason = quantityDiff > 0 ? 'Stock replenishment detected' : 'Customer product removal detected';

        this.db.prepare(`
          INSERT INTO stock_movements (product_id, shelf_id, movement_type, quantity_delta, previous_quantity, new_quantity, previous_weight, new_weight, reason, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          shelf.product_id,
          shelfId,
          movementType,
          quantityDiff,
          prevQuantity,
          calculation.estimatedQuantity,
          prevWeight,
          grossWeightGrams,
          reason,
          `Sensor detected weight shift from ${prevWeight}g to ${grossWeightGrams}g`,
          now
        );
        logger.info(`Stock change on ${shelfId} (${shelf.product_name}): ${prevQuantity} -> ${calculation.estimatedQuantity} (delta: ${quantityDiff})`);
      }

      updatedInventory = {
        ...existing,
        current_gross_weight: grossWeightGrams,
        current_net_weight: calculation.netWeightGrams,
        estimated_quantity: calculation.estimatedQuantity,
        stock_percentage: calculation.stockPercentage,
        stock_status: calculation.stockStatus,
        last_calculated_at: now
      };
    }

    // Evaluate stock alerts based on new inventory state
    alertService.evaluateStockAlert({
      shelfId,
      productId: shelf.product_id,
      estimatedQuantity: calculation.estimatedQuantity,
      lowStockThreshold: shelf.low_stock_threshold || 5,
      stockStatus: calculation.stockStatus,
      productName: shelf.product_name,
      shelfName: shelf.name,
      sensorId
    });

    return updatedInventory;
  }

  /**
   * Manual restocking workflow by staff.
   * Performs atomic database updates and resolves alerts.
   */
  public restockShelf(params: {
    shelfId: string;
    productId: string;
    quantityToAdd: number;
    reason?: string;
    notes?: string;
    performedBy?: string;
  }): { success: boolean; inventory: InventoryItem; movement: StockMovement } {
    const { shelfId, productId, quantityToAdd, reason = 'Manual restocking by staff', notes, performedBy } = params;

    if (quantityToAdd <= 0) {
      throw new Error('Quantity to add must be greater than zero.');
    }

    const restockTx = this.db.transaction(() => {
      const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
      const shelf = this.db.prepare('SELECT * FROM shelves WHERE id = ?').get(shelfId) as any;

      if (!product) throw new Error(`Product ${productId} not found.`);
      if (!shelf) throw new Error(`Shelf ${shelfId} not found.`);

      const existingInv = this.db.prepare('SELECT * FROM inventory WHERE product_id = ? AND shelf_id = ?').get(productId, shelfId) as InventoryItem | undefined;

      const previousQuantity = existingInv ? existingInv.estimated_quantity : 0;
      const capacity = product.capacity || shelf.max_capacity_items || 20;
      const newQuantity = Math.min(capacity, previousQuantity + quantityToAdd);
      const actualDelta = newQuantity - previousQuantity;

      const netWeight = newQuantity * product.unit_weight_grams;
      const grossWeight = netWeight + (shelf.tare_weight_grams || 0);
      const stockPercentage = Math.round((newQuantity / capacity) * 10000) / 100;
      const stockStatus: StockStatus = newQuantity === 0 ? 'OUT_OF_STOCK' : (newQuantity <= product.low_stock_threshold ? 'LOW_STOCK' : 'IN_STOCK');
      const now = new Date().toISOString();

      let invId: number;
      if (existingInv) {
        this.db.prepare(`
          UPDATE inventory 
          SET current_gross_weight = ?, current_net_weight = ?, estimated_quantity = ?, stock_percentage = ?, stock_status = ?, last_calculated_at = ?
          WHERE id = ?
        `).run(grossWeight, netWeight, newQuantity, stockPercentage, stockStatus, now, existingInv.id);
        invId = existingInv.id;
      } else {
        const info = this.db.prepare(`
          INSERT INTO inventory (product_id, shelf_id, current_gross_weight, current_net_weight, estimated_quantity, stock_percentage, stock_status, last_calculated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(productId, shelfId, grossWeight, netWeight, newQuantity, stockPercentage, stockStatus, now);
        invId = Number(info.lastInsertRowid);
      }

      // Record movement
      const movementInfo = this.db.prepare(`
        INSERT INTO stock_movements (product_id, shelf_id, movement_type, quantity_delta, previous_quantity, new_quantity, previous_weight, new_weight, reason, notes, created_at)
        VALUES (?, ?, 'RESTOCK', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        shelfId,
        actualDelta,
        previousQuantity,
        newQuantity,
        existingInv?.current_gross_weight || 0,
        grossWeight,
        reason,
        notes ? `${notes} (Operator: ${performedBy || 'Staff'})` : `Restocked by ${performedBy || 'Staff'}`,
        now
      );

      // Also log sensor reading if sensor exists for this shelf so history reflects new weight
      const sensor = this.db.prepare('SELECT id FROM sensors WHERE shelf_id = ? LIMIT 1').get(shelfId) as { id: string } | undefined;
      if (sensor) {
        this.db.prepare(`
          INSERT INTO sensor_readings (sensor_id, shelf_id, gross_weight_grams, reading_timestamp, server_receipt_timestamp, source, is_valid, notes)
          VALUES (?, ?, ?, ?, ?, 'SIMULATED', 1, 'Restock balance update')
        `).run(sensor.id, shelfId, grossWeight, now, now);
      }

      // Check and update alerts
      alertService.evaluateStockAlert({
        shelfId,
        productId,
        estimatedQuantity: newQuantity,
        lowStockThreshold: product.low_stock_threshold,
        stockStatus,
        productName: product.name,
        shelfName: shelf.name,
        sensorId: sensor?.id
      });

      const updatedInventory: InventoryItem = {
        id: invId,
        product_id: productId,
        shelf_id: shelfId,
        current_gross_weight: grossWeight,
        current_net_weight: netWeight,
        estimated_quantity: newQuantity,
        stock_percentage: stockPercentage,
        stock_status: stockStatus,
        last_calculated_at: now
      };

      const recordedMovement: StockMovement = {
        id: Number(movementInfo.lastInsertRowid),
        product_id: productId,
        shelf_id: shelfId,
        movement_type: 'RESTOCK',
        quantity_delta: actualDelta,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        previous_weight: existingInv?.current_gross_weight || 0,
        new_weight: grossWeight,
        reason,
        notes,
        created_at: now
      };

      return { success: true, inventory: updatedInventory, movement: recordedMovement };
    });

    return restockTx();
  }

  /**
   * Manual stock adjustment workflow (e.g. inventory audit, damaged item write-off).
   */
  public adjustStock(params: {
    shelfId: string;
    productId: string;
    newQuantity: number;
    reason: string;
    notes?: string;
    adjustedBy?: string;
  }): { success: boolean; inventory: InventoryItem; movement: StockMovement } {
    const { shelfId, productId, newQuantity, reason, notes, adjustedBy } = params;

    if (newQuantity < 0) {
      throw new Error('New quantity cannot be negative.');
    }

    const adjustTx = this.db.transaction(() => {
      const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
      const shelf = this.db.prepare('SELECT * FROM shelves WHERE id = ?').get(shelfId) as any;

      if (!product) throw new Error(`Product ${productId} not found.`);
      if (!shelf) throw new Error(`Shelf ${shelfId} not found.`);

      const existingInv = this.db.prepare('SELECT * FROM inventory WHERE product_id = ? AND shelf_id = ?').get(productId, shelfId) as InventoryItem | undefined;

      const previousQuantity = existingInv ? existingInv.estimated_quantity : 0;
      const delta = newQuantity - previousQuantity;
      const capacity = product.capacity || shelf.max_capacity_items || 20;

      if (newQuantity > capacity) {
        throw new Error(`Quantity ${newQuantity} exceeds shelf capacity of ${capacity}.`);
      }

      const netWeight = newQuantity * product.unit_weight_grams;
      const grossWeight = netWeight + (shelf.tare_weight_grams || 0);
      const stockPercentage = Math.round((newQuantity / capacity) * 10000) / 100;
      const stockStatus: StockStatus = newQuantity === 0 ? 'OUT_OF_STOCK' : (newQuantity <= product.low_stock_threshold ? 'LOW_STOCK' : 'IN_STOCK');
      const now = new Date().toISOString();

      let invId: number;
      if (existingInv) {
        this.db.prepare(`
          UPDATE inventory 
          SET current_gross_weight = ?, current_net_weight = ?, estimated_quantity = ?, stock_percentage = ?, stock_status = ?, last_calculated_at = ?
          WHERE id = ?
        `).run(grossWeight, netWeight, newQuantity, stockPercentage, stockStatus, now, existingInv.id);
        invId = existingInv.id;
      } else {
        const info = this.db.prepare(`
          INSERT INTO inventory (product_id, shelf_id, current_gross_weight, current_net_weight, estimated_quantity, stock_percentage, stock_status, last_calculated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(productId, shelfId, grossWeight, netWeight, newQuantity, stockPercentage, stockStatus, now);
        invId = Number(info.lastInsertRowid);
      }

      // Record movement
      const movementInfo = this.db.prepare(`
        INSERT INTO stock_movements (product_id, shelf_id, movement_type, quantity_delta, previous_quantity, new_quantity, previous_weight, new_weight, reason, notes, created_at)
        VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        shelfId,
        delta,
        previousQuantity,
        newQuantity,
        existingInv?.current_gross_weight || 0,
        grossWeight,
        reason,
        notes ? `${notes} (Audited by: ${adjustedBy || 'Staff'})` : `Adjusted by ${adjustedBy || 'Staff'}`,
        now
      );

      // Update alert state
      const sensor = this.db.prepare('SELECT id FROM sensors WHERE shelf_id = ? LIMIT 1').get(shelfId) as { id: string } | undefined;
      alertService.evaluateStockAlert({
        shelfId,
        productId,
        estimatedQuantity: newQuantity,
        lowStockThreshold: product.low_stock_threshold,
        stockStatus,
        productName: product.name,
        shelfName: shelf.name,
        sensorId: sensor?.id
      });

      const updatedInventory: InventoryItem = {
        id: invId,
        product_id: productId,
        shelf_id: shelfId,
        current_gross_weight: grossWeight,
        current_net_weight: netWeight,
        estimated_quantity: newQuantity,
        stock_percentage: stockPercentage,
        stock_status: stockStatus,
        last_calculated_at: now
      };

      const recordedMovement: StockMovement = {
        id: Number(movementInfo.lastInsertRowid),
        product_id: productId,
        shelf_id: shelfId,
        movement_type: 'MANUAL_ADJUSTMENT',
        quantity_delta: delta,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        previous_weight: existingInv?.current_gross_weight || 0,
        new_weight: grossWeight,
        reason,
        notes,
        created_at: now
      };

      return { success: true, inventory: updatedInventory, movement: recordedMovement };
    });

    return adjustTx();
  }

  /**
   * Gets inventory list with product and shelf details.
   */
  public getInventoryList(): any[] {
    return this.db.prepare(`
      SELECT 
        i.*,
        p.name as product_name, p.sku as product_sku, p.category as product_category,
        p.unit_weight_grams, p.capacity as product_capacity, p.low_stock_threshold,
        s.name as shelf_name, s.location as shelf_location, s.tare_weight_grams,
        sn.id as sensor_id, sn.connection_status as sensor_status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN shelves s ON i.shelf_id = s.id
      LEFT JOIN sensors sn ON s.id = sn.shelf_id
      ORDER BY 
        CASE i.stock_status 
          WHEN 'OUT_OF_STOCK' THEN 1 
          WHEN 'LOW_STOCK' THEN 2 
          WHEN 'UNKNOWN' THEN 3 
          ELSE 4 
        END,
        i.stock_percentage ASC
    `).all();
  }

  /**
   * Retrieves stock movements with optional filtering.
   */
  public getMovements(filters?: {
    productId?: string;
    shelfId?: string;
    movementType?: MovementType;
    limit?: number;
  }): any[] {
    let query = `
      SELECT m.*, p.name as product_name, p.sku as product_sku, s.name as shelf_name
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      JOIN shelves s ON m.shelf_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.productId) {
      query += ` AND m.product_id = ?`;
      params.push(filters.productId);
    }
    if (filters?.shelfId) {
      query += ` AND m.shelf_id = ?`;
      params.push(filters.shelfId);
    }
    if (filters?.movementType) {
      query += ` AND m.movement_type = ?`;
      params.push(filters.movementType);
    }

    query += ` ORDER BY m.created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    return this.db.prepare(query).all(...params);
  }
}

export const inventoryService = new InventoryService();
