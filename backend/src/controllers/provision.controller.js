import { z } from 'zod';
import * as serviceRepo from '../repositories/service.repository.js';
import { provision }    from '../services/provisioning.service.js';
import { AppError }     from '../utils/AppError.js';
import logger           from '../utils/logger.js';

const startSchema = z.object({
  email:           z.string().email(),
  firstName:       z.string().min(1),
  lastName:        z.string().min(1).optional(),
  // Regex : commence par une lettre minuscule, alphanum + tirets, 2-32 chars
  desiredUsername: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/).optional(),
  productType:     z.enum(['vps', 'vpn', 'nas']),
  templateId:      z.number().int().positive(),
  externalOrderId: z.string().min(1),
  cartId:          z.string().min(1).optional(),
  paymentIntentId: z.string().min(1).optional(),
  resources: z.object({
    cpu:        z.number().int().positive(),
    ram_gb:     z.number().int().positive(),
    storage_gb: z.number().int().positive(),
  }),
});

// POST /provision — WooCommerce appelle ça après paiement confirmé.
// Crée immédiatement le service en BDD (status=provisioning) et lance le provisioning
// en arrière-plan. Retourne le serviceId pour que WooCommerce puisse poller.
export async function start(req, res) {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } });
  }
  const body = parsed.data;

  // Crée le service placeholder dès maintenant — on a besoin de l'ID pour le polling
  const serviceId = await serviceRepo.create({
    email:           body.email,
    firstName:       body.firstName,
    externalOrderId: body.externalOrderId,
    productType:     body.productType,
    node:            process.env.PROXMOX_DEFAULT_NODE ?? '',
    vmId:            0,       // mis à jour pendant le provisioning
    ip:              '',
    port:            body.productType === 'vps' ? '22' : '443',
    username:        body.productType === 'nas' ? 'admin' : (body.desiredUsername ?? body.firstName.toLowerCase()),
    password:        '',
    ramGb:           body.resources.ram_gb,
    cpu:             body.resources.cpu,
    storageGb:       body.resources.storage_gb,
  });

  logger.info({ serviceId, externalOrderId: body.externalOrderId }, 'provision:queued');

  // Fire-and-forget — WooCommerce poll GET /provision/:serviceId/status
  provision(serviceId, body).catch(() => {});

  res.status(202).json({ serviceId, status: 'provisioning' });
}

// GET /provision/:serviceId/status — Pollé par WooCommerce toutes les 5 s.
// Retourne { status, access } si actif, ou { status: 'failed', reason } si échec.
export async function status(req, res) {
  const serviceId = Number(req.params.serviceId);
  if (!Number.isInteger(serviceId) || serviceId <= 0) throw AppError.badRequest('serviceId invalide');

  const svc = await serviceRepo.findById(serviceId);
  if (!svc) throw AppError.notFound('Service introuvable');

  if (svc.status === 'active') {
    return res.json({
      status: 'active',
      access: {
        ip:       svc.ip_address,
        port:     svc.port,
        username: svc.username,
        password: svc.password,
      },
    });
  }

  if (svc.status === 'failed') {
    return res.json({ status: 'failed', reason: svc.error_msg ?? 'Erreur inconnue' });
  }

  res.json({ status: svc.status });
}
