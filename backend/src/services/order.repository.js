const db = require('../config/db.client');

async function createOrder(orderData) {
  try {
    const query = `
      INSERT INTO orders 
      (user_id, product_id, payment_intent_id, ram, cpu, storage, os, amount_total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      orderData.userId,
      orderData.productId,
      orderData.paymentIntentId,
      orderData.ram,
      orderData.cpu,
      orderData.storage || 0,
      orderData.os || null,
      orderData.amountTotal,
      orderData.status || 'pending'
    ];

    const [result] = await db.execute(query, values);
    return result.insertId;
  } catch (error) {
    console.log('Erreur création commande:', error.message);
    return null;
  }
}

async function findOrderByPaymentIntent(paymentIntentId) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM orders WHERE payment_intent_id = ?',
      [paymentIntentId]
    );
    return rows[0] || null;
  } catch (error) {
    console.log('Erreur recherche commande:', error.message);
    return null;
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await db.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );
    return true;
  } catch (error) {
    console.log('Erreur mise à jour commande:', error.message);
    return false;
  }
}

module.exports = { createOrder, findOrderByPaymentIntent, updateOrderStatus };