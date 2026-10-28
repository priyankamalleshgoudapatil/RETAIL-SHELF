import { Request, Response } from 'express';
import { z } from 'zod';
import { simulationService, SimulationScenario } from '../services/simulationService';

const scenarioSchema = z.object({
  scenario: z.enum(['NORMAL', 'RUSH_HOUR', 'RESTOCK_RUN', 'SENSOR_DISCONNECT']),
});

const startSchema = z.object({
  scenario: z.enum(['NORMAL', 'RUSH_HOUR', 'RESTOCK_RUN', 'SENSOR_DISCONNECT']).optional().default('NORMAL'),
  intervalMs: z.number().int().min(1000).max(60000).optional().default(4000),
});

export const simulationController = {
  getStatus: (req: Request, res: Response) => {
    const status = simulationService.getStatus();
    res.json({ success: true, data: status });
  },

  start: (req: Request, res: Response) => {
    const { scenario, intervalMs } = startSchema.parse(req.body);
    const status = simulationService.start(scenario, intervalMs);
    res.json({ success: true, message: `Simulation started in ${scenario} mode`, data: status });
  },

  stop: (req: Request, res: Response) => {
    const status = simulationService.stop();
    res.json({ success: true, message: 'Simulation stopped successfully', data: status });
  },

  setScenario: (req: Request, res: Response) => {
    const { scenario } = scenarioSchema.parse(req.body);
    const status = simulationService.setScenario(scenario);
    res.json({ success: true, message: `Simulation scenario set to ${scenario}`, data: status });
  },

  reset: (req: Request, res: Response) => {
    simulationService.resetDataset();
    const status = simulationService.getStatus();
    res.json({ success: true, message: 'Simulation demo dataset has been reset to initial baseline values', data: status });
  }
};
