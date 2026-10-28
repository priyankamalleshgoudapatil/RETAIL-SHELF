import { getDatabase } from '../db/connection';
import { Sensor, SensorReading, DataSource } from '../types';
import { inventoryService } from './inventoryService';
import { alertService } from './alertService';
import { logger } from '../utils/logger';
import { config } from '../config';

export class SensorService {
  private db = getDatabase();

  /**
   * Processes an incoming sensor telemetry reading (simulated or real hardware).
   * Validates device, logs reading, updates sensor heartbeat, calculates inventory, and manages alerts.
   */
  public processReading(params: {
    sensorId: string;
    grossWeightGrams: number;
    timestamp?: string;
    source: DataSource;
    providedToken?: string;
  }): { success: boolean; reading: SensorReading; inventoryUpdated: boolean } {
    const { sensorId, grossWeightGrams, timestamp, source, providedToken } = params;
    const serverReceiptTime = new Date().toISOString();
    const readingTime = timestamp ? new Date(timestamp).toISOString() : serverReceiptTime;

    // 1. Verify sensor is registered in our database
    const sensor = this.db.prepare('SELECT * FROM sensors WHERE id = ?').get(sensorId) as Sensor | undefined;
    if (!sensor) {
      throw new Error(`Unauthorized or unregistered sensor device: ${sensorId}`);
    }

    // 2. If reading claims to be HARDWARE, enforce device token or global secret authentication
    if (source === 'HARDWARE') {
      const isGlobalSecret = providedToken && providedToken === config.hardwareSensorSecret;
      const isDeviceToken = sensor.device_token && providedToken === sensor.device_token;
      if (!isGlobalSecret && !isDeviceToken) {
        throw new Error(`Invalid device token or secret for hardware sensor ${sensorId}`);
      }
    }

    // 3. Basic sanity check on gross weight (e.g. non-negative within small tolerance, reasonable max)
    const isValid = grossWeightGrams >= -10 && grossWeightGrams <= 250000 ? 1 : 0;
    const notes = isValid ? 'Valid telemetry' : 'Weight reading outside physical operational boundary';

    // 4. Record reading in time-series log
    const insertRes = this.db.prepare(`
      INSERT INTO sensor_readings (sensor_id, shelf_id, gross_weight_grams, reading_timestamp, server_receipt_timestamp, source, is_valid, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sensorId,
      sensor.shelf_id || null,
      grossWeightGrams,
      readingTime,
      serverReceiptTime,
      source,
      isValid,
      notes
    );

    // 5. Update sensor heartbeat and connection status
    const wasOffline = sensor.connection_status !== 'ONLINE';
    this.db.prepare(`
      UPDATE sensors 
      SET connection_status = 'ONLINE', 
          last_seen_at = ?, 
          updated_at = ?
      WHERE id = ?
    `).run(serverReceiptTime, serverReceiptTime, sensorId);

    // If sensor was offline and is now back online, resolve offline alert
    if (wasOffline) {
      alertService.handleSensorReconnected(sensorId);
    }

    // 6. Update inventory if shelf is assigned
    let inventoryUpdated = false;
    if (sensor.shelf_id && isValid === 1) {
      const inv = inventoryService.updateInventoryFromSensor({
        shelfId: sensor.shelf_id,
        grossWeightGrams,
        readingTimestamp: readingTime,
        sensorId
      });
      inventoryUpdated = !!inv;
    }

    const recordedReading: SensorReading = {
      id: Number(insertRes.lastInsertRowid),
      sensor_id: sensorId,
      shelf_id: sensor.shelf_id || null,
      gross_weight_grams: grossWeightGrams,
      reading_timestamp: readingTime,
      server_receipt_timestamp: serverReceiptTime,
      source,
      is_valid: isValid,
      notes
    };

    return { success: true, reading: recordedReading, inventoryUpdated };
  }

  /**
   * Scans all registered sensors for offline timeouts.
   * Compares (now - last_seen_at) > offline_timeout_sec.
   */
  public checkSensorHealth(): { checked: number; offlineCount: number } {
    const sensors = this.db.prepare('SELECT * FROM sensors').all() as Sensor[];
    const now = Date.now();
    let offlineCount = 0;

    for (const sensor of sensors) {
      const timeoutMs = (sensor.offline_timeout_sec || 15) * 1000;
      const lastSeen = sensor.last_seen_at ? new Date(sensor.last_seen_at).getTime() : 0;
      const elapsedMs = now - lastSeen;

      if (lastSeen === 0 || elapsedMs > timeoutMs) {
        offlineCount++;
        if (sensor.connection_status !== 'OFFLINE') {
          this.db.prepare(`
            UPDATE sensors 
            SET connection_status = 'OFFLINE', updated_at = ? 
            WHERE id = ?
          `).run(new Date().toISOString(), sensor.id);

          alertService.handleSensorOffline(sensor.id, sensor.shelf_id || null, elapsedMs / 1000);
        }
      }
    }

    return { checked: sensors.length, offlineCount };
  }

  /**
   * Retrieves all sensors with attached shelf & product details.
   */
  public getAllSensors(): any[] {
    return this.db.prepare(`
      SELECT 
        s.*, 
        sh.name as shelf_name, sh.location as shelf_location,
        p.id as product_id, p.name as product_name, p.sku as product_sku,
        (SELECT gross_weight_grams FROM sensor_readings WHERE sensor_id = s.id ORDER BY id DESC LIMIT 1) as latest_gross_weight,
        (SELECT server_receipt_timestamp FROM sensor_readings WHERE sensor_id = s.id ORDER BY id DESC LIMIT 1) as latest_reading_time
      FROM sensors s
      LEFT JOIN shelves sh ON s.shelf_id = sh.id
      LEFT JOIN products p ON sh.current_product_id = p.id
      ORDER BY s.id ASC
    `).all();
  }

  /**
   * Retrieves reading history for a specific sensor.
   */
  public getSensorReadings(sensorId: string, limit: number = 50): SensorReading[] {
    return this.db.prepare(`
      SELECT * FROM sensor_readings 
      WHERE sensor_id = ? 
      ORDER BY server_receipt_timestamp DESC 
      LIMIT ?
    `).all(sensorId, limit) as SensorReading[];
  }
}

export const sensorService = new SensorService();
