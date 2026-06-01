import * as productRepo from '../repositories/product.repository.js';
import { AppError } from '../utils/AppError.js';

const PUBLIC_FIELDS = ['id', 'name', 'slug', 'type', 'description', 'base_price', 'pricing_config', 'resource_config', 'status'];

function toPublic(product) {
  return Object.fromEntries(PUBLIC_FIELDS.map(k => [k, product[k]]));
}

export async function listProducts(type) {
  const products = await productRepo.findAll({ type });
  return products.map(toPublic);
}

export async function getProduct(id) {
  const product = await productRepo.findById(id);
  if (!product || product.status === 'inactive') throw AppError.notFound('Produit introuvable');
  return toPublic(product);
}

export async function calculatePrice(id, resources) {
  const product = await productRepo.findById(id);
  if (!product || product.status === 'inactive') throw AppError.notFound('Produit introuvable');

  const { pricing_config, resource_config, base_price } = product;
  let total = Number(base_price);

  for (const [key, value] of Object.entries(resources)) {
    if (!(key in pricing_config)) {
      throw AppError.badRequest(`Ressource inconnue : ${key}`, 'INVALID_RESOURCE');
    }

    const cfg = resource_config[key];
    if (cfg) {
      if (value < cfg.min || value > cfg.max) {
        throw AppError.badRequest(`${key} doit être entre ${cfg.min} et ${cfg.max}`, 'RESOURCE_OUT_OF_RANGE');
      }
      const steps = (value - cfg.min) / cfg.step;
      if (!Number.isInteger(Math.round(steps * 1e9) / 1e9)) {
        throw AppError.badRequest(`${key} doit être un multiple de ${cfg.step}`, 'RESOURCE_INVALID_STEP');
      }
    }

    total += value * pricing_config[key];
  }

  return { price: Math.round(total * 100) / 100, currency: 'EUR' };
}
