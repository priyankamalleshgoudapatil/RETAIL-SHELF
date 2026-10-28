import { Request, Response } from 'express';
import { z } from 'zod';
import { sensorService } from '../services/sensorService';
import { DataSource } from '../types';

const readingSchema = z.object({
  sensorId: z.string().min(1, 'sensorId is required'),
  weightGrams: z.number({ required_error: 'weightGrams is required' }),
  timestamp: z.string().optional(),
  source: z.enum(['SIMULATED', 'HARDWARE']).default('SIMULATED'),
});

export const sensorController = {
  getSensors: (req: Request, res: Response) => {
    const sensors = sensorService.getAllSensors();
    res.json({ success: true, data: sensors });
  },

  getSensorById: (req: Request, res: Response) => {
    const { id } = req.params;
    const sensors = sensorService.getAllSensors();
    const sensor = sensors.find(s => s.id === id);

    if (!sensor) {
      res.status(404).json({ success: false, error: `Sensor ${id} not found.` });
      return;
    }

    const readings = sensorService.getSensorReadings(id, 30);
    res.json({ success: true, data: { ...sensor, recent_readings: readings } });
  },

  getReadings: (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const readings = sensorService.getSensorReadings(id, limit);
    res.json({ success: true, data: readings });
  },

  postReading: (req: Request, res: Response) => {
    const parsed = readingSchema.parse(req.body);

    const providedToken = req.headers['x-sensor-key'] as string || 
                         (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

    const result = sensorService.processReading({
      sensorId: parsed.sensorId,
      grossWeightGrams: parsed.weightGrams,
      timestamp: parsed.timestamp,
      source: parsed.source as DataSource,
      providedToken
    });

    res.status(201).json({
      success: true,
      message: 'Sensor reading successfully ingested and processed',
      data: result
    });
  }
};
