import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

const loginLimit = rateLimit({ windowMs: 60_000, limit: 10 });

const wpLoginSchema = z.object({
  wordpress_id: z.number().int().positive(),
  email:        z.string().email(),
  first_name:   z.string().min(1),
  last_name:    z.string().default(''),
  timestamp:    z.number().int().positive(),
  signature:    z.string().length(64),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const wpLogoutSchema = z.object({
  wordpress_id: z.number().int().positive(),
  email:        z.string().email(),
  first_name:   z.string().min(1),
  last_name:    z.string().default(''),
  timestamp:    z.number().int().positive(),
  signature:    z.string().length(64),
});

router.post('/wordpress',    loginLimit, validate(wpLoginSchema),  authController.wordpressLogin);
router.post('/logout-wp',    loginLimit, validate(wpLogoutSchema), authController.logoutFromWordpress);
router.post('/refresh',      validate(refreshSchema),              authController.refresh);
router.post('/logout',       requireAuth,                          authController.logout);
router.get ('/me',           requireAuth,                          authController.me);

export default router;
