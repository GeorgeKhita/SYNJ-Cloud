import { z } from 'zod';
import * as reservation from '../services/reservation.service.js';

const reserveSchema = z.object({
  cartId: z.string().min(1),
  resources: z.object({
    cpu:        z.number().int().nonnegative(),
    ram_gb:     z.number().int().nonnegative(),
    storage_gb: z.number().int().nonnegative(),
  }),
});

export async function reserve(req, res) {
  const parsed = reserveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } });
  }
  const { cartId, resources } = parsed.data;
  const result = await reservation.reserve(cartId, resources);
  res.json(result);
}

export async function release(req, res) {
  await reservation.release(req.params.cartId);
  res.json({ released: true });
}
