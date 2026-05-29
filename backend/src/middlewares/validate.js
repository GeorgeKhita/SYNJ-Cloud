import { AppError } from '../utils/AppError.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join(', ');
      return next(AppError.badRequest(message, 'VALIDATION_ERROR'));
    }
    req.body = result.data;
    next();
  };
}
