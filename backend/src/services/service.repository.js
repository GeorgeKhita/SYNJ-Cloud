const db = require('../config/db.client');
const { encrypt } = require('../utils/encryption');

async function saveService(serviceData) {
  try {
    const query = `
      INSERT INTO services 
      (user_id, order_id, product_id, node_name, vm_id, 
       ip_address, port, username, password, ram, cpu, storage, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    const values = [
      serviceData.userId,
      serviceData.orderId,
      serviceData.productId,
      serviceData.node,
      serviceData.vmId,
      encrypt(serviceData.ip),
      encrypt(String(serviceData.port)),
      encrypt(serviceData.username),
      encrypt(serviceData.password),
      serviceData.ram,
      serviceData.cpu,
      serviceData.storage
    ];

    const [result] = await db.execute(query, values);
    return result.insertId;
  } catch (error) {
    console.log('Erreur sauvegarde service:', error.message);
    return null;
  }
}

async function findServiceByOrderId(orderId) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM services WHERE order_id = ?',
      [orderId]
    );
    return rows[0] || null;
  } catch (error) {
    console.log('Erreur recherche service:', error.message);
    return null;
  }
}

async function findServicesByUserId(userId) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM services WHERE user_id = ?',
      [userId]
    );
    return rows;
  } catch (error) {
    console.log('Erreur recherche services:', error.message);
    return [];
  }
}

async function updateServiceStatus(serviceId, status) {
  try {
    await db.execute(
      'UPDATE services SET status = ? WHERE id = ?',
      [status, serviceId]
    );
    return true;
  } catch (error) {
    console.log('Erreur mise à jour statut:', error.message);
    return false;
  }
}

async function suspendService(serviceId) {
  try {
    await db.execute(
      'UPDATE services SET status = ?, suspended_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 14 DAY) WHERE id = ?',
      ['suspended', serviceId]
    );
    return true;
  } catch (error) {
    console.log('Erreur suspension service:', error.message);
    return false;
  }
}

async function reactivateService(serviceId) {
  try {
    await db.execute(
      'UPDATE services SET status = ?, suspended_at = NULL, expires_at = NULL WHERE id = ?',
      ['active', serviceId]
    );
    return true;
  } catch (error) {
    console.log('Erreur réactivation service:', error.message);
    return false;
  }
}

async function markPendingDeletion(serviceId) {
  try {
    await db.execute(
      'UPDATE services SET status = ? WHERE id = ?',
      ['pending_deletion', serviceId]
    );
    return true;
  } catch (error) {
    console.log('Erreur marquage suppression:', error.message);
    return false;
  }
}

async function deleteService(serviceId) {
  try {
    await db.execute(
      'UPDATE services SET status = ? WHERE id = ?',
      ['deleted', serviceId]
    );
    return true;
  } catch (error) {
    console.log('Erreur suppression service:', error.message);
    return false;
  }
}

async function findExpiredServices() {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM services WHERE status = ? AND expires_at <= NOW()',
      ['suspended']
    );
    return rows;
  } catch (error) {
    console.log('Erreur recherche services expirés:', error.message);
    return [];
  }
}

async function findServicesExpiringSoon(days) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM services WHERE status = ? AND expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY) AND expires_at > NOW()',
      ['suspended', days]
    );
    return rows;
  } catch (error) {
    console.log('Erreur recherche services expirant bientôt:', error.message);
    return [];
  }
}

module.exports = {
  saveService,
  findServiceByOrderId,
  findServicesByUserId,
  updateServiceStatus,
  suspendService,
  reactivateService,
  markPendingDeletion,
  deleteService,
  findExpiredServices,
  findServicesExpiringSoon
};