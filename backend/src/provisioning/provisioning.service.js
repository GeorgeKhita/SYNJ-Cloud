const proxmox_resources = require('../proxmox/resources');
const proxmox_config = require('../config/proxmox.config');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function handlePaymentSucceeded(paymentData) {
    const resource = await proxmox_resources.getResources(proxmox_config.default_node);
    if (!resource) {
        try {
            await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
        } catch (e) {
            console.log('Erreur remboursement:', e.message);
        }
        return { error: "Proxmox indisponible, remboursement effectué" };
    }

    if (paymentData.ram > resource.ram || paymentData.cpu > resource.cpu || paymentData.storage > resource.storage) {
        await stripe.refunds.create({ payment_intent: paymentData.paymentIntentId });
        return { error: "Ressources insuffisantes, remboursement effectué" };
    }

    console.log('Re-vérification OK, prêt pour déploiement');
    return { success: true };
}

module.exports = {handlePaymentSucceeded};