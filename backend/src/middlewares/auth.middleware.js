import { AppError } from '../utils/AppError.js';
import { verifyAccess } from '../utils/jwt.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized());
  }

  const token = header.slice(7);
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    next(AppError.unauthorized('Token invalide ou expiré', 'TOKEN_INVALID'));
  }
}
