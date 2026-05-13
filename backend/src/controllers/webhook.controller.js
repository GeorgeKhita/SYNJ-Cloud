const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const orderRepo = require('../services/order.repository');
const userRepo = require('../services/user.repository');
const serviceRepo = require('../services/service.repository');
const proxmoxClient = require('../proxmox/proxmox.client');
const mail = require('../mail/mail.service');

async function handleWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('Paiement reçu:', paymentIntent.id, '— en attente de provision via /orders/provision');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        const order = await orderRepo.findOrderBySubscription(subscriptionId);
        if (!order) break;

        const service = await serviceRepo.findServiceByOrderId(order.id);
        if (!service) break;

        const user = await userRepo.findUserById(order.user_id);

        await serviceRepo.suspendService(service.id);
        await orderRepo.updateOrderStatus(order.id, 'failed');
        await proxmoxClient.stopContainer(service.node_name, service.vm_id);

        console.log('Service', service.id, 'suspendu — CT', service.vm_id, 'arrêté');

        if (user) {
          await mail.sendPaymentFailedEmail(user.email, user.first_name);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) break;

        const order = await orderRepo.findOrderBySubscription(subscriptionId);
        if (!order) break;

        const service = await serviceRepo.findServiceByOrderId(order.id);
        if (!service) break;

        if (service.status === 'suspended') {
          await serviceRepo.reactivateService(service.id);
          await orderRepo.updateOrderStatus(order.id, 'paid');
          await proxmoxClient.startContainer(service.node_name, service.vm_id);

          console.log('Service', service.id, 'réactivé — CT', service.vm_id, 'redémarré');

          const user = await userRepo.findUserById(order.user_id);
          if (user) {
            await mail.sendServiceReactivatedEmail(user.email, user.first_name);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        const order = await orderRepo.findOrderBySubscription(subscriptionId);
        if (!order) break;

        const service = await serviceRepo.findServiceByOrderId(order.id);
        if (!service) break;

        await serviceRepo.markPendingDeletion(service.id);
        await orderRepo.updateOrderStatus(order.id, 'failed');

        if (service.status === 'active') {
          await proxmoxClient.stopContainer(service.node_name, service.vm_id);
        }

        console.log('Service', service.id, 'en attente de suppression — J+14');

        const user = await userRepo.findUserById(order.user_id);
        if (user) {
          await mail.sendSubscriptionDeletedEmail(user.email, user.first_name);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        const order = await orderRepo.findOrderByPaymentIntent(paymentIntentId);
        if (!order) break;

        await orderRepo.updateOrderStatus(order.id, 'refunded');

        const service = await serviceRepo.findServiceByOrderId(order.id);
        if (service && service.status !== 'deleted') {
          await proxmoxClient.stopContainer(service.node_name, service.vm_id);
          await new Promise(resolve => setTimeout(resolve, 5000));
          await proxmoxClient.deleteContainer(service.node_name, service.vm_id);
          await serviceRepo.deleteService(service.id);

          console.log('Service', service.id, 'supprimé après remboursement');
        }
        break;
      }

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