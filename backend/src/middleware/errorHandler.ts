import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error(`Error processing ${req.method} ${req.url}:`, err);

  if (err instanceof ZodError) {
    const errorDetails = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({
      success: false,
      error: `Validation Error: ${errorDetails}`,
      details: err.errors
    });
    return;
  }

  const statusCode = err.statusCode || (err.message.includes('not found') ? 404 : 500);
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.'
  });
}
