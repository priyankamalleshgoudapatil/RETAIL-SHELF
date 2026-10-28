import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { getDatabase } from '../db/connection';

/**
 * Middleware to authenticate sensor ingestion requests.
 * Simulated sensor requests from local loop are permitted.
 * Real hardware requests (or requests marked HARDWARE) must provide valid 'X-Sensor-Key' or 'Authorization: Bearer <key>'.
 */
export function authenticateSensorRequest(req: Request, res: Response, next: NextFunction): void {
  const source = (req.body?.source || 'SIMULATED').toUpperCase();

  if (source === 'SIMULATED') {
    return next();
  }

  const providedKey = req.headers['x-sensor-key'] as string || 
                      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

  if (!providedKey) {
    res.status(401).json({
      success: false,
      error: 'Authentication required for hardware sensor telemetry. Please provide X-Sensor-Key header.'
    });
    return;
  }

  // Check global hardware sensor secret or individual device token
  const db = getDatabase();
  const globalKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'hardware_api_key'").get() as { value: string } | undefined;
  const validSecret = globalKeySetting?.value || config.hardwareSensorSecret;

  if (providedKey === validSecret) {
    return next();
  }

  // Alternatively check sensor-specific device token
  const sensorId = req.body?.sensorId;
  if (sensorId) {
    const sensor = db.prepare('SELECT device_token FROM sensors WHERE id = ?').get(sensorId) as { device_token?: string } | undefined;
    if (sensor?.device_token && sensor.device_token === providedKey) {
      return next();
    }
  }

  res.status(403).json({
    success: false,
    error: 'Invalid hardware sensor authentication key.'
  });
}
