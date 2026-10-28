import { Request, Response } from 'express';
import { z } from 'zod';
import { alertService } from '../services/alertService';
import { AlertSeverity, AlertType } from '../types';

const acknowledgeSchema = z.object({
  acknowledgedBy: z.string().optional().default('Staff Member'),
});

const resolveSchema = z.object({
  resolutionNotes: z.string().min(2, 'Resolution notes are required').default('Resolved by staff'),
});

export const alertController = {
  getAlerts: (req: Request, res: Response) => {
    const { resolved, severity, type, shelfId, limit } = req.query;

    const alerts = alertService.getAlerts({
      resolved: resolved === 'true' ? true : (resolved === 'false' ? false : undefined),
      severity: severity ? (severity as AlertSeverity) : undefined,
      type: type ? (type as AlertType) : undefined,
      shelfId: typeof shelfId === 'string' ? shelfId : undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
    });

    res.json({ success: true, data: alerts });
  },

  acknowledge: (req: Request, res: Response) => {
    const { id } = req.params;
    const { acknowledgedBy } = acknowledgeSchema.parse(req.body);

    const success = alertService.acknowledgeAlert(id, acknowledgedBy);
    if (!success) {
      res.status(404).json({ success: false, error: `Alert ${id} not found or could not be updated.` });
      return;
    }

    res.json({ success: true, message: `Alert ${id} acknowledged successfully.` });
  },

  resolve: (req: Request, res: Response) => {
    const { id } = req.params;
    const { resolutionNotes } = resolveSchema.parse(req.body);

    const success = alertService.resolveAlert(id, resolutionNotes);
    if (!success) {
      res.status(404).json({ success: false, error: `Alert ${id} not found or could not be updated.` });
      return;
    }

    res.json({ success: true, message: `Alert ${id} resolved successfully.` });
  }
};
