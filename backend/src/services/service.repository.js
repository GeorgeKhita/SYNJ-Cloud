const db = require('../config/db.client');
const { encrypt } = require('../utils/encryption');

async function saveService(serviceData) {
  try {
    const query = `
      INSERT INTO services 
      (order_id, customer_email, product_id, node_name, vm_id, 
       ip_address, port, username, password, ram, cpu, storage, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    const values = [
      serviceData.orderId,
      serviceData.customerEmail,
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

module.exports = { saveService };