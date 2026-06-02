import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function requireApiKey(req, _res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== env.API_KEY) throw AppError.unauthorized('API key invalide');
  next();
}
