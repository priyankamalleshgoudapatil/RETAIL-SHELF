import { getDatabase } from '../db/connection';
import { Alert, AlertType, AlertSeverity, StockStatus } from '../types';
import { logger } from '../utils/logger';

export class AlertService {
  private db = getDatabase();

  /**
   * Evaluates current inventory stock status and creates, escalates, or auto-resolves alerts.
   */
  public evaluateStockAlert(params: {
    shelfId: string;
    productId: string;
    estimatedQuantity: number;
    lowStockThreshold: number;
    stockStatus: StockStatus;
    productName: string;
    shelfName: string;
    sensorId?: string;
  }): void {
    const { shelfId, productId, estimatedQuantity, lowStockThreshold, stockStatus, productName, shelfName, sensorId } = params;
    const now = new Date().toISOString();

    // Find any currently active (unresolved) stock alerts for this shelf and product
    const activeAlert = this.db.prepare(`
      SELECT * FROM alerts 
      WHERE shelf_id = ? AND product_id = ? AND resolved = 0 AND alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK')
      ORDER BY created_at DESC LIMIT 1
    `).get(shelfId, productId) as Alert | undefined;

    if (stockStatus === 'OUT_OF_STOCK') {
      if (activeAlert) {
        if (activeAlert.alert_type === 'OUT_OF_STOCK') {
          // Already active OUT_OF_STOCK alert; do not duplicate
          return;
        } else if (activeAlert.alert_type === 'LOW_STOCK') {
          // Escalate existing LOW_STOCK alert to OUT_OF_STOCK
          logger.warn(`Escalating alert for ${productName} on ${shelfName} to OUT_OF_STOCK`);
          this.db.prepare(`
            UPDATE alerts 
            SET alert_type = 'OUT_OF_STOCK', 
                severity = 'CRITICAL', 
                description = ?, 
                updated_at = ? 
            WHERE id = ?
          `).run(
            `ESCALATED: ${productName} on ${shelfName} is completely OUT OF STOCK (0 units remaining). Immediate restocking required.`,
            now,
            activeAlert.id
          );
          return;
        }
      } else {
        // Create new OUT_OF_STOCK alert
        const alertId = `ALT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
        this.db.prepare(`
          INSERT INTO alerts (id, alert_type, severity, shelf_id, product_id, sensor_id, description, acknowledged, resolved, created_at, updated_at)
          VALUES (?, 'OUT_OF_STOCK', 'CRITICAL', ?, ?, ?, ?, 0, 0, ?, ?)
        `).run(
          alertId,
          shelfId,
          productId,
          sensorId || null,
          `CRITICAL: ${productName} on ${shelfName} is completely OUT OF STOCK (0 units remaining). Immediate restocking required.`,
          now,
          now
        );
        logger.info(`Created OUT_OF_STOCK alert ${alertId} for ${productName}`);
      }
    } else if (stockStatus === 'LOW_STOCK') {
      if (activeAlert) {
        // If an active LOW_STOCK alert already exists, do not duplicate
        // If it was OUT_OF_STOCK but some items appeared (maybe 1 item), update description
        if (activeAlert.alert_type === 'OUT_OF_STOCK') {
          this.db.prepare(`
            UPDATE alerts 
            SET alert_type = 'LOW_STOCK', 
                severity = 'WARNING', 
                description = ?, 
                updated_at = ? 
            WHERE id = ?
          `).run(
            `LOW STOCK: ${productName} on ${shelfName} has ${estimatedQuantity} units remaining (Threshold: ${lowStockThreshold}).`,
            now,
            activeAlert.id
          );
        }
        return;
      } else {
        // Create new LOW_STOCK alert
        const alertId = `ALT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
        this.db.prepare(`
          INSERT INTO alerts (id, alert_type, severity, shelf_id, product_id, sensor_id, description, acknowledged, resolved, created_at, updated_at)
          VALUES (?, 'LOW_STOCK', 'WARNING', ?, ?, ?, ?, 0, 0, ?, ?)
        `).run(
          alertId,
          shelfId,
          productId,
          sensorId || null,
          `LOW STOCK: ${productName} on ${shelfName} has ${estimatedQuantity} units remaining (Threshold: ${lowStockThreshold}).`,
          now,
          now
        );
        logger.info(`Created LOW_STOCK alert ${alertId} for ${productName}`);
      }
    } else if (stockStatus === 'IN_STOCK') {
      // Auto-resolve any active stock alerts if stock has recovered above the threshold
      if (activeAlert) {
        logger.info(`Auto-resolving active alert ${activeAlert.id} as stock recovered to ${estimatedQuantity} units.`);
        this.db.prepare(`
          UPDATE alerts 
          SET resolved = 1, 
              resolved_at = ?, 
              resolution_notes = ?, 
              updated_at = ? 
          WHERE id = ?
        `).run(
          now,
          `Auto-resolved: Inventory restored to ${estimatedQuantity} units (above threshold ${lowStockThreshold}).`,
          now,
          activeAlert.id
        );
      }
    }
  }

  /**
   * Evaluates sensor connectivity and triggers or auto-resolves SENSOR_OFFLINE alert.
   */
  public handleSensorOffline(sensorId: string, shelfId: string | null, elapsedSec: number): void {
    const now = new Date().toISOString();
    // Check if an active SENSOR_OFFLINE alert exists
    const existing = this.db.prepare(`
      SELECT * FROM alerts 
      WHERE sensor_id = ? AND alert_type = 'SENSOR_OFFLINE' AND resolved = 0
      LIMIT 1
    `).get(sensorId) as Alert | undefined;

    if (!existing) {
      const alertId = `ALT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      this.db.prepare(`
        INSERT INTO alerts (id, alert_type, severity, shelf_id, sensor_id, description, acknowledged, resolved, created_at, updated_at)
        VALUES (?, 'SENSOR_OFFLINE', 'WARNING', ?, ?, ?, 0, 0, ?, ?)
      `).run(
        alertId,
        shelfId,
        sensorId,
        `Sensor ${sensorId} is OFFLINE: No telemetry received for ${Math.round(elapsedSec)} seconds (timeout exceeded).`,
        now,
        now
      );
      logger.warn(`Generated SENSOR_OFFLINE alert for sensor ${sensorId}`);
    }
  }

  /**
   * Called when a sensor reconnects and transmits valid data.
   */
  public handleSensorReconnected(sensorId: string): void {
    const now = new Date().toISOString();
    const activeOfflineAlert = this.db.prepare(`
      SELECT * FROM alerts 
      WHERE sensor_id = ? AND alert_type = 'SENSOR_OFFLINE' AND resolved = 0
      LIMIT 1
    `).get(sensorId) as Alert | undefined;

    if (activeOfflineAlert) {
      this.db.prepare(`
        UPDATE alerts 
        SET resolved = 1, 
            resolved_at = ?, 
            resolution_notes = 'Auto-resolved: Sensor reconnected and resumed telemetry transmissions.', 
            updated_at = ? 
        WHERE id = ?
      `).run(now, now, activeOfflineAlert.id);
      logger.info(`Auto-resolved SENSOR_OFFLINE alert for sensor ${sensorId} upon reconnection.`);
    }
  }

  /**
   * Creates an abnormal reading alert if reading violates physical constraints.
   */
  public createAbnormalReadingAlert(sensorId: string, shelfId: string | null, grossWeight: number, reason: string): void {
    const now = new Date().toISOString();
    const alertId = `ALT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    this.db.prepare(`
      INSERT INTO alerts (id, alert_type, severity, shelf_id, sensor_id, description, acknowledged, resolved, created_at, updated_at)
      VALUES (?, 'ABNORMAL_READING', 'WARNING', ?, ?, ?, 0, 0, ?, ?)
    `).run(
      alertId,
      shelfId,
      sensorId,
      `Abnormal weight reading of ${grossWeight}g detected on sensor ${sensorId}: ${reason}`,
      now,
      now
    );
  }

  /**
   * Staff acknowledges an alert.
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string = 'Staff Member'): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE alerts 
      SET acknowledged = 1, 
          acknowledged_at = ?, 
          acknowledged_by = ?, 
          updated_at = ? 
      WHERE id = ?
    `).run(now, acknowledgedBy, now, alertId);
    return res.changes > 0;
  }

  /**
   * Staff resolves an alert with notes.
   */
  public resolveAlert(alertId: string, resolutionNotes: string = 'Resolved by staff'): boolean {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      UPDATE alerts 
      SET resolved = 1, 
          resolved_at = ?, 
          resolution_notes = ?, 
          updated_at = ? 
      WHERE id = ?
    `).run(now, resolutionNotes, now, alertId);
    return res.changes > 0;
  }

  /**
   * Retrieves alerts with optional filters.
   */
  public getAlerts(filters?: {
    resolved?: boolean;
    severity?: AlertSeverity;
    type?: AlertType;
    shelfId?: string;
    limit?: number;
  }): Alert[] {
    let query = `
      SELECT a.*, 
             p.name as product_name, p.sku as product_sku,
             s.name as shelf_name, s.location as shelf_location
      FROM alerts a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN shelves s ON a.shelf_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.resolved !== undefined) {
      query += ` AND a.resolved = ?`;
      params.push(filters.resolved ? 1 : 0);
    }
    if (filters?.severity) {
      query += ` AND a.severity = ?`;
      params.push(filters.severity);
    }
    if (filters?.type) {
      query += ` AND a.alert_type = ?`;
      params.push(filters.type);
    }
    if (filters?.shelfId) {
      query += ` AND a.shelf_id = ?`;
      params.push(filters.shelfId);
    }

    query += ` ORDER BY a.resolved ASC, a.created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    return this.db.prepare(query).all(...params) as Alert[];
  }
}

export const alertService = new AlertService();
