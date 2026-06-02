import Stripe from 'stripe';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function refund(paymentIntentId, reason = 'Échec du provisioning') {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason:         'fraudulent',
      metadata:       { reason },
    });
    logger.info({ paymentIntentId, refundId: refund.id }, 'stripe:refund_created');
    return true;
  } catch (err) {
    logger.error({ err: err.message, paymentIntentId }, 'stripe:refund_failed');
    return false;
  }
}
