import { app } from './app';
import { config } from './config';
import { getDatabase, closeDatabase } from './db/connection';
import { seedDatabase } from './db/seed';
import { simulationService } from './services/simulationService';
import { logger } from './utils/logger';

// 1. Ensure database is initialized and seeded if empty
try {
  getDatabase();
  seedDatabase(false); // Non-destructive: seeds only if empty
} catch (err) {
  logger.error('Failed to initialize database:', err);
  process.exit(1);
}

// 2. Start server
const server = app.listen(config.port, () => {
  logger.info(`================================================================`);
  logger.info(`Smart-Retail Shelf Sensor Network Backend Running`);
  logger.info(`Port:        ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health:      http://localhost:${config.port}/api/health`);
  logger.info(`API Base:    http://localhost:${config.port}/api`);
  logger.info(`Database:    ${config.databasePath}`);
  logger.info(`Simulation:  ${simulationService.getStatus().isActive ? 'ACTIVE' : 'IDLE'}`);
  logger.info(`================================================================`);
});

// Graceful shutdown handling
const shutdown = () => {
  logger.info('Shutting down Smart-Retail server gracefully...');
  simulationService.stop();
  server.close(() => {
    closeDatabase();
    logger.info('Server closed. Database connection released.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
