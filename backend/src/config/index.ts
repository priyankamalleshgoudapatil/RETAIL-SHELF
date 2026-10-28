import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../../smart_retail.db'),
  hardwareSensorSecret: process.env.HARDWARE_SENSOR_SECRET || 'smart_retail_esp32_secret_token_2026',
  defaultOfflineTimeoutSec: parseInt(process.env.DEFAULT_OFFLINE_TIMEOUT_SEC || '15', 10),
  defaultReportingIntervalSec: parseInt(process.env.DEFAULT_REPORTING_INTERVAL_SEC || '5', 10),
};
