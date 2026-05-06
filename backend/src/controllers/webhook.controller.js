const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const provisioning = require('../provisioning/provisioning.service');

async function handleWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch(event.type){
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            const paymentData = {
                paymentIntentId: paymentIntent.id,
                orderId: paymentIntent.metadata.orderId,
                ram: parseInt(paymentIntent.metadata.ram),
                cpu: parseInt(paymentIntent.metadata.cpu),
                storage: parseInt(paymentIntent.metadata.storage)
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

module.exports = {handleWebhook};