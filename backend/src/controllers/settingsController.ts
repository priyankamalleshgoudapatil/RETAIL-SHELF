import { Request, Response } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/connection';

const settingsUpdateSchema = z.record(z.string());

export const settingsController = {
  getSettings: (req: Request, res: Response) => {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM settings').all() as Array<{ key: string; value: string; description: string; updated_at: string }>;
    
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    res.json({
      success: true,
      data: {
        settings: settingsMap,
        definitions: rows
      }
    });
  },

  updateSettings: (req: Request, res: Response) => {
    const db = getDatabase();
    const parsed = settingsUpdateSchema.parse(req.body);
    const now = new Date().toISOString();

    const updateTx = db.transaction(() => {
      const updateStmt = db.prepare(`
        INSERT INTO settings (key, value, description, updated_at) 
        VALUES (@key, @value, @description, @updated_at)
        ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
      `);

      for (const [key, value] of Object.entries(parsed)) {
        updateStmt.run({
          key,
          value: String(value),
          description: `Configured via settings dashboard`,
          updated_at: now
        });
      }
    });

    updateTx();

    const rows = db.prepare('SELECT * FROM settings').all() as any[];
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    res.json({ success: true, message: 'Settings updated successfully', data: settingsMap });
  }
};
