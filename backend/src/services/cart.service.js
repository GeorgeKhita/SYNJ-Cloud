const product_config = require('../config/products.config');
const proxmox_resources = require('../proxmox/resources');
const lock_services = require('../lock/lock.service');
const proxmox_config = require('../config/proxmox.config');

async function validateCart(productId, orderId, requested) {
  const product = product_config[productId];
  if (!product) return null;

  const resource = await proxmox_resources.getResources(proxmox_config.default_node);
  if (!resource) return { error: "Ressources temporairement indisponibles" };

  const locked = await lock_services.getLockedResources(proxmox_config.default_node);
  const available = {
    ram: resource.ram - locked.ram,
    cpu: resource.cpu - locked.cpu,
    storage: resource.storage - locked.storage
  };

  if (requested.ram > available.ram || requested.cpu > available.cpu || requested.storage > available.storage) {
    return { error: "Ressources insuffisantes" };
  }

  const lock = await lock_services.acquireLock(orderId, proxmox_config.default_node, requested);
  if (!lock) {
    return { error: "LOCK_CONFLICT", message: "Ressource déjà réservée" };
  }

  return { success: true, orderId: orderId };
}

module.exports = { validateCart };