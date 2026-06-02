import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', issues: err.issues },
    });
  }

  logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error');

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Une erreur interne est survenue' : err.message,
    },
  });
}
