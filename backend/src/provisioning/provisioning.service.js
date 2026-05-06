const proxmox_resources = require('../proxmox/resources');
const proxmox_config = require('../config/proxmox.config');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const lock = require('../lock/lock.service');

async function handlePaymentSucceeded(paymentData) {
    const resource = await proxmox_resources.getResources(proxmox_config.default_node);

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

    // TODO : Clonage du template CT
    // TODO : Configuration CT (RAM, CPU, stockage, réseau)
    // TODO : Démarrage CT
    // TODO : Health check

    await lock.releaseLock(paymentData.orderId);

    // TODO : Chiffrement accès + enregistrement BDD
    // TODO : Envoi email accès
    // TODO : Mise à jour espace client

    return { success: true };
}

module.exports = { handlePaymentSucceeded };