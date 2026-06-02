import redis from '../config/redis.js';
import { env } from '../config/env.js';
import { getCapacity } from './proxmox.service.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

const KEY    = (cartId) => `cart:rsv:${cartId}`;
const TTL_S  = ()       => env.LOCK_TTL_MIN * 60;

async function getTotalReserved() {
  const keys = await redis.keys('cart:rsv:*');
  if (!keys.length) return { cpu: 0, ram_gb: 0, storage_gb: 0 };
  const values = await redis.mget(...keys);
  return values.reduce((acc, v) => {
    if (!v) return acc;
    const r = JSON.parse(v);
    return {
      cpu:        acc.cpu        + (r.cpu        || 0),
      ram_gb:     acc.ram_gb     + (r.ram_gb     || 0),
      storage_gb: acc.storage_gb + (r.storage_gb || 0),
    };
  }, { cpu: 0, ram_gb: 0, storage_gb: 0 });
}

// Vérifie si les ressources demandées sont disponibles (capacity Proxmox - réservations actives)
// Si Proxmox est injoignable, on laisse passer (fail-open) pour ne pas bloquer les ventes.
export async function checkAvailable(resources) {
  const [capacity, reserved] = await Promise.all([getCapacity(), getTotalReserved()]);
  if (!capacity) return { available: true };

  for (const key of ['cpu', 'ram_gb', 'storage_gb']) {
    const needed    = resources[key] || 0;
    const available = capacity[key] - reserved[key];
    if (needed > 0 && available < needed) {
      logger.warn({ key, needed, available }, 'reservation:check_failed');
      return {
        available: false,
        reason: `Ressources insuffisantes : ${key} (disponible: ${available}, demandé: ${needed})`,
      };
    }
  }
  return { available: true };
}

// Réserve les ressources pour un panier (TTL = LOCK_TTL_MIN minutes)
export async function reserve(cartId, resources) {
  const check = await checkAvailable(resources);
  if (!check.available) throw AppError.conflict(check.reason, 'CAPACITY_EXCEEDED');

  const ok = await redis.set(KEY(cartId), JSON.stringify(resources), 'EX', TTL_S(), 'NX');
  if (!ok) {
    // Déjà réservé pour ce panier — on rafraîchit le TTL
    await redis.expire(KEY(cartId), TTL_S());
  }

  logger.info({ cartId, resources, ttlMin: env.LOCK_TTL_MIN }, 'reservation:acquired');
  return { reserved: true, expiresIn: TTL_S() };
}

// Libère la réservation (abandon panier ou fin de provisioning)
export async function release(cartId) {
  await redis.del(KEY(cartId));
  logger.info({ cartId }, 'reservation:released');
}
