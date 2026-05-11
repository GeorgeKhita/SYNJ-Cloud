const proxmox_resources = require('../proxmox/resources');
const proxmox_client = require('../proxmox/proxmox.client');
const proxmox_config = require('../config/proxmox.config');
const products = require('../config/products.config');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const lock = require('../lock/lock.service');
const crypto = require('crypto');
const { saveService } = require('../services/service.repository');

async function getNextVmId() {
  const result = await proxmox_client.proxmoxRequest('get', '/cluster/nextid');
  if (!result) return null;
  return Number(result);
}

async function waitForContainer(node, vmId, maxAttempts) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await proxmox_client.getContainerStatus(node, vmId);
    if (status && status.status === 'running') {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return false;
}

function generatePassword(length) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

async function getContainerIp(node, vmId) {
  const config = await proxmox_client.proxmoxRequest(
    'get', '/nodes/' + node + '/lxc/' + vmId + '/config'
  );
  if (!config || !config.net0) return null;

  const match = config.net0.match(/ip=(\d+\.\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

async function handlePaymentSucceeded(paymentData) {
  const node = proxmox_config.default_node;

  // --- Vérification ressources ---
  const resource = await proxmox_resources.getResources(node);
  if (!resource) {
    try {
      await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    } catch (e) {
      console.log('Erreur remboursement:', e.message);
    }
    await lock.releaseLock(paymentData.orderId);
    return { error: "Proxmox indisponible, remboursement effectué" };
  }

  if (paymentData.ram > resource.ram || paymentData.cpu > resource.cpu || paymentData.storage > resource.storage) {
    await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    await lock.releaseLock(paymentData.orderId);
    return { error: "Ressources insuffisantes, remboursement effectué" };
  }

  console.log('Re-vérification OK, prêt pour déploiement');

  // --- Récupérer le template ID du produit ---
  const product = products[paymentData.productId];
  if (!product) {
    await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    await lock.releaseLock(paymentData.orderId);
    return { error: "Produit inconnu: " + paymentData.productId };
  }

  // --- Obtenir un VMID unique ---
  const newVmId = await getNextVmId();
  if (!newVmId) {
    await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    await lock.releaseLock(paymentData.orderId);
    return { error: "Impossible d'obtenir un VMID" };
  }

  // --- Clonage du template CT ---
  console.log('Clonage template', product.templateId, '→ nouveau CT', newVmId);
  const cloneResult = await proxmox_client.cloneContainer(node, product.templateId, newVmId);
  if (!cloneResult) {
    await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    await lock.releaseLock(paymentData.orderId);
    return { error: "Échec du clonage CT" };
  }

  // --- Configuration CT (RAM, CPU, réseau) ---
  console.log('Configuration CT', newVmId);
  const tempPassword = generatePassword(16);
  const configResult = await proxmox_client.configureContainer(node, newVmId, {
    memory: paymentData.ram * 1024,
    cores: paymentData.cpu,
    rootfs: 'local-lvm:' + (paymentData.storage || 8),
    net0: 'name=eth0,bridge=vmbr0,ip=dhcp'
  });
  if (!configResult) {
    console.log('Avertissement: configuration CT peut avoir échoué');
  }

  // --- Démarrage CT ---
  console.log('Démarrage CT', newVmId);
  const startResult = await proxmox_client.startContainer(node, newVmId);
  if (!startResult) {
    await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    await lock.releaseLock(paymentData.orderId);
    return { error: "Échec du démarrage CT" };
  }

  // --- Health check (attente max 60s) ---
  console.log('Health check CT', newVmId);
  const isRunning = await waitForContainer(node, newVmId, 12);
  if (!isRunning) {
    await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
    await lock.releaseLock(paymentData.orderId);
    return { error: "CT non démarré après timeout" };
  }

  console.log('CT', newVmId, 'déployé et actif');
  await lock.releaseLock(paymentData.orderId);

  // --- Récupérer l'IP du conteneur ---
  const containerIp = await getContainerIp(node, newVmId);

  // --- Générer les infos d'accès selon le service ---
  const accessInfo = {
    ip: containerIp || 'en attente',
    port: paymentData.productId === 'vps' ? '22' : '443',
    username: paymentData.productId === 'nas' ? 'admin' : 'root',
    password: tempPassword
  };

  // --- Chiffrement + enregistrement BDD ---
  console.log('Enregistrement service en BDD');
  const serviceId = await saveService({
    orderId: paymentData.orderId,
    customerEmail: paymentData.customerEmail,
    productId: paymentData.productId,
    node: node,
    vmId: newVmId,
    ip: accessInfo.ip,
    port: accessInfo.port,
    username: accessInfo.username,
    password: accessInfo.password,
    ram: paymentData.ram,
    cpu: paymentData.cpu,
    storage: paymentData.storage || 0
  });

  if (!serviceId) {
    console.log('Erreur: service déployé mais non enregistré en BDD — intervention manuelle requise');
  }

  // TODO : Envoi email accès
  // TODO : Mise à jour espace client

  return { success: true, vmId: newVmId, node: node, serviceId: serviceId };
}

module.exports = { handlePaymentSucceeded };