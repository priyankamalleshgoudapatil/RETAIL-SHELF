import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = new Database(config.databasePath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');

    initSchema(dbInstance);
  }
  return dbInstance;
}

export function initSchema(db: Database.Database): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Initialize default settings if missing
  const initSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, description, updated_at) 
    VALUES (@key, @value, @description, @updated_at)
  `);

  const now = new Date().toISOString();
  const defaultSettings = [
    { key: 'store_name', value: 'Metro Fresh Supermarket', description: 'Store branch identifier', updated_at: now },
    { key: 'default_low_stock_threshold', value: '5', description: 'Default threshold for low stock alert', updated_at: now },
    { key: 'sensor_reporting_interval_sec', value: '5', description: 'Default seconds between readings', updated_at: now },
    { key: 'sensor_offline_timeout_sec', value: '15', description: 'Seconds before marking sensor as offline', updated_at: now },
    { key: 'simulation_mode', value: 'true', description: 'Enable software sensor simulation', updated_at: now },
    { key: 'hardware_api_key', value: config.hardwareSensorSecret, description: 'Token required for ESP32 sensor ingestion', updated_at: now },
  ];

  for (const s of defaultSettings) {
    initSetting.run(s);
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
