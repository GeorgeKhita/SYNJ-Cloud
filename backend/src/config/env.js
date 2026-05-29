import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  DB_HOST:     z.string().min(1),
  DB_NAME:     z.string().min(1),
  DB_USER:     z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),

  STRIPE_SECRET_KEY:      z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET:  z.string().startsWith('whsec_'),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),

  JWT_SECRET:         z.string().min(32),
  REFRESH_SECRET:     z.string().min(32),
  WORDPRESS_SECRET:   z.string().min(32),
  ENCRYPTION_KEY:     z.string().min(32),

  PROXMOX_URL:           z.string().url(),
  PROXMOX_TOKEN_ID:      z.string().min(1),
  PROXMOX_SECRET:        z.string().min(1),
  PROXMOX_DEFAULT_NODE:  z.string().min(1),
  PROXMOX_SSH_HOST:      z.string().min(1),
  PROXMOX_SSH_USER:      z.string().min(1),
  PROXMOX_SSH_KEY:       z.string().min(1),

  FRONTEND_URL:        z.string().url(),
  RESOURCE_CACHE_TTL:  z.coerce.number().default(60000),
  LOCK_TTL_MIN:        z.coerce.number().default(15),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`[env] Variables manquantes ou invalides :\n${missing}`);
  process.exit(1);
}

export const env = result.data;
