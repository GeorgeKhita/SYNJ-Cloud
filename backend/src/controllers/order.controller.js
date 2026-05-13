const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const orderRepo = require('../services/order.repository');
const userRepo = require('../services/user.repository');
const provisioning = require('../provisioning/provisioning.service');
const proxmox_resources = require('../proxmox/resources');
const proxmox_config = require('../config/proxmox.config');
const products = require('../config/products.config');

async function preCheck(req, res) {
  const { productId, ram, cpu, storage } = req.body;

  const checks = {
    backend: true,
    proxmox: false,
    resources: false,
    product: false
  };

  const product = products[productId];
  if (!product) {
    return res.json({ ready: false, checks: checks, error: 'Produit inconnu' });
  }
  checks.product = true;

  const resource = await proxmox_resources.getResources(proxmox_config.default_node);
  if (!resource) {
    return res.json({ ready: false, checks: checks, error: 'Infrastructure temporairement indisponible' });
  }
  checks.proxmox = true;

  if (ram > resource.ram || cpu > resource.cpu || (storage || 0) > resource.storage) {
    return res.json({ ready: false, checks: checks, error: 'Ressources insuffisantes' });
  }
  checks.resources = true;

  res.json({ ready: true, checks: checks });
}

async function provision(req, res) {
  const { paymentIntentId, productId, ram, cpu, storage, os } = req.body;
  const userId = req.user.userId;

  if (!paymentIntentId || !productId || !ram || !cpu) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    return res.status(400).json({ error: 'PaymentIntent invalide' });
  }

  if (paymentIntent.status !== 'requires_capture' && paymentIntent.status !== 'succeeded') {
    return res.status(400).json({ error: 'Paiement non confirmé, statut: ' + paymentIntent.status });
  }

  const existingOrder = await orderRepo.findOrderByPaymentIntent(paymentIntentId);
  if (existingOrder) {
    return res.status(409).json({ error: 'Ce paiement a déjà été traité' });
  }

  const orderId = await orderRepo.createOrder({
    userId: userId,
    productId: productId,
    paymentIntentId: paymentIntentId,
    ram: ram,
    cpu: cpu,
    storage: storage || 0,
    os: os || null,
    amountTotal: paymentIntent.amount,
    status: 'pending'
  });

  if (!orderId) {
    if (paymentIntent.status === 'requires_capture') {
      await stripe.paymentIntents.cancel(paymentIntentId);
    }
    return res.status(500).json({ error: 'Erreur création commande' });
  }

  const user = await userRepo.findUserById(userId);

  const paymentData = {
    paymentIntentId: paymentIntentId,
    orderId: orderId,
    userId: userId,
    customerEmail: user.email,
    productId: productId,
    ram: ram,
    cpu: cpu,
    storage: storage || 0,
    os: os || null
  };

  const result = await provisioning.handlePaymentSucceeded(paymentData);

  if (result.error) {
    if (paymentIntent.status === 'requires_capture') {
      await stripe.paymentIntents.cancel(paymentIntentId);
      console.log('Paiement annulé — client jamais débité');
    }
    await orderRepo.updateOrderStatus(orderId, 'failed');
    return res.status(500).json({ error: result.error });
  }

  if (paymentIntent.status === 'requires_capture') {
    try {
      await stripe.paymentIntents.capture(paymentIntentId);
      console.log('Paiement capturé avec succès');
    } catch (error) {
      console.log('Erreur capture paiement:', error.message);
    }
  }

  await orderRepo.updateOrderStatus(orderId, 'paid');

  res.json({
    success: true,
    orderId: orderId,
    vmId: result.vmId,
    message: 'Service déployé avec succès'
  });
}

module.exports = { preCheck, provision };