const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const provisioning = require('../provisioning/provisioning.service');
const orderRepo = require('../services/order.repository');
const userRepo = require('../services/user.repository');

async function handleWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;

        // Retrouver la commande en BDD
        const order = await orderRepo.findOrderByPaymentIntent(paymentIntent.id);
        if (!order) {
          console.log('Commande introuvable pour PaymentIntent:', paymentIntent.id);
          break;
        }

        // Retrouver l'email du client
        const user = await userRepo.findUserById(order.user_id);
        if (!user) {
          console.log('Utilisateur introuvable pour order:', order.id);
          break;
        }

        // Mettre à jour le statut de la commande
        await orderRepo.updateOrderStatus(order.id, 'paid');

        // Construire paymentData depuis la BDD
        const paymentData = {
          paymentIntentId: paymentIntent.id,
          orderId: order.id,
          userId: order.user_id,
          customerEmail: user.email,
          productId: order.product_id,
          ram: order.ram,
          cpu: order.cpu,
          storage: order.storage,
          os: order.os
        };

        await provisioning.handlePaymentSucceeded(paymentData);
        break;

      case 'invoice.payment_failed':
        console.log('suspension service (critique)');
        break;

      case 'customer.subscription.deleted':
        console.log('résiliation (haute)');
        break;

      case 'invoice.payment_succeeded':
        console.log('renouvellement (haute)');
        break;

      case 'charge.refunded':
        console.log('annulation/remboursement (haute)');
        break;

      default:
        console.log('Événement non géré:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.log('Erreur webhook:', error.message);
    res.status(400).json({ error: 'Signature invalide' });
  }
}

module.exports = { handleWebhook };