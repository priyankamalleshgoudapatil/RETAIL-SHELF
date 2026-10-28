import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// Security and CORS configuration
app.use(cors({
  origin: '*', // Allow frontend dev server and network clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Sensor-Key']
}));

// Body parsing with safe size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Centralized Error Handling
app.use(errorHandler);
