const db = require('../config/db.client');

async function findUserById(userId) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    return rows[0] || null;
  } catch (error) {
    console.log('Erreur recherche utilisateur:', error.message);
    return null;
  }
}

async function findUserByEmail(email) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  } catch (error) {
    console.log('Erreur recherche utilisateur:', error.message);
    return null;
  }
}

async function createUser(userData) {
  try {
    const query = `
      INSERT INTO users (email, password, first_name, last_name, phone)
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
      userData.email,
      userData.password,
      userData.firstName,
      userData.lastName,
      userData.phone || null
    ];

    const [result] = await db.execute(query, values);
    return result.insertId;
  } catch (error) {
    console.log('Erreur création utilisateur:', error.message);
    return null;
  }
}

async function updateStripeCustomerId(userId, stripeCustomerId) {
  try {
    await db.execute(
      'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
      [stripeCustomerId, userId]
    );
    return true;
  } catch (error) {
    console.log('Erreur mise à jour Stripe customer:', error.message);
    return false;
  }
}

module.exports = { findUserById, findUserByEmail, createUser, updateStripeCustomerId };