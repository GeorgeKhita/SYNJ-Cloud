import { env } from '../config/env.js';
import logger from '../utils/logger.js';

function parseOrderId(externalOrderId) {
  // externalOrderId peut être "WC-300" ou "300"
  const match = String(externalOrderId).match(/(\d+)$/);
  return match ? match[1] : externalOrderId;
}

function authHeader() {
  const token = Buffer.from(`${env.WC_KEY}:${env.WC_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

export async function refundOrder(externalOrderId, reason) {
  const orderId = parseOrderId(externalOrderId);
  const url     = `${env.WC_URL}/wp-json/wc/v3/orders/${orderId}/refunds`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader(),
      },
      body: JSON.stringify({ reason, api_refund: true }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ orderId, status: res.status, body: text }, 'woocommerce:refund_failed');
      return false;
    }

    logger.info({ orderId, reason }, 'woocommerce:refund_created');
    return true;
  } catch (err) {
    logger.error({ err: err.message, orderId }, 'woocommerce:refund_error');
    return false;
  }
}
