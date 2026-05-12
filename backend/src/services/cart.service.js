const product_config = require('../config/products.config');
const proxmox_resources = require('../proxmox/resources');
const lock_services = require('../lock/lock.service');
const proxmox_config = require('../config/proxmox.config');
const price_sum = require('../utils/calculatePrice');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const orderRepo = require('./order.repository');

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

  const price = price_sum.calculatePrice(product, requested);
  return { success: true, orderId: orderId, price: price };
}

async function checkout(userId, productId, orderId, requested, os) {
  const product = product_config[productId];
  if (!product) return null;

  const price = price_sum.calculatePrice(product, requested);
  const amountInCents = Math.round(price * 100);

  // Créer le PaymentIntent Stripe
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'eur',
      metadata: {
        orderId: String(orderId),
        userId: String(userId),
        productId: productId
      }
    });
  } catch (error) {
    console.log('Erreur Stripe PaymentIntent:', error.message);
    return { error: 'Erreur lors de la création du paiement' };
  }

  // Créer la commande en BDD
  const orderDbId = await orderRepo.createOrder({
    userId: userId,
    productId: productId,
    paymentIntentId: paymentIntent.id,
    ram: requested.ram,
    cpu: requested.cpu,
    storage: requested.storage || 0,
    os: os || null,
    amountTotal: amountInCents,
    status: 'pending'
  });

  if (!orderDbId) {
    return { error: 'Erreur lors de la création de la commande' };
  }

  return {
    success: true,
    orderId: orderDbId,
    clientSecret: paymentIntent.client_secret
  };
}

module.exports = { validateCart, checkout };