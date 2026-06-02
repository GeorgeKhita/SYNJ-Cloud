import { z } from 'zod';
import * as proxmox      from '../services/proxmox.service.js';
import * as reservation  from '../services/reservation.service.js';
import { AppError }      from '../utils/AppError.js';

export async function memory(_req, res) {
  const data = await proxmox.getNodeMemory();
  if (!data) throw AppError.conflict('Proxmox injoignable', 'PROXMOX_UNAVAILABLE');
  res.json(data);
}

export async function cpu(_req, res) {
  const data = await proxmox.getNodeCpu();
  if (!data) throw AppError.conflict('Proxmox injoignable', 'PROXMOX_UNAVAILABLE');
  res.json(data);
}

export async function storage(_req, res) {
  const data = await proxmox.getNodeStorage();
  if (!data) throw AppError.conflict('Proxmox injoignable', 'PROXMOX_UNAVAILABLE');
  res.json(data);
}

const checkSchema = z.object({
  cpu:        z.number().int().nonnegative(),
  ram_gb:     z.number().int().nonnegative(),
  storage_gb: z.number().int().nonnegative(),
});

// WooCommerce appelle cet endpoint avant d'autoriser l'ajout au panier
export async function check(req, res) {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } });
  }
  const result = await reservation.checkAvailable(parsed.data);
  res.json(result);
}
