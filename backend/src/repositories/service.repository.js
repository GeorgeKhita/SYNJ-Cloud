import pool from '../config/db.js';
import { encrypt, decrypt } from '../utils/encryption.js';

function decryptRow(row) {
  if (!row) return null;
  return {
    ...row,
    ip_address: row.ip_address ? decrypt(row.ip_address) : null,
    port:       row.port       ? decrypt(row.port)       : null,
    username:   row.username   ? decrypt(row.username)   : null,
    password:   row.password   ? decrypt(row.password)   : null,
  };
}

export async function create({ email, firstName, externalOrderId, productType, node, vmId, ip, port, username, password, ramGb, cpu, storageGb }) {
  const [result] = await pool.query(
    `INSERT INTO services
       (customer_email, customer_name, external_order_id, product_type, node_name, vm_id,
        ip_address, port, username, password, ram_gb, cpu, storage_gb)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [email, firstName, externalOrderId ?? null, productType, node, vmId,
     encrypt(ip ?? ''), encrypt(String(port)), encrypt(username), encrypt(password),
     ramGb, cpu, storageGb]
  );
  return result.insertId;
}

export async function findById(serviceId) {
  const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [serviceId]);
  return decryptRow(rows[0] ?? null);
}

export async function updateStatus(serviceId, status) {
  await pool.query('UPDATE services SET status = ?, updated_at = NOW() WHERE id = ?', [status, serviceId]);
}

export async function markFailed(serviceId, errorMsg) {
  await pool.query(
    'UPDATE services SET status = ?, error_msg = ?, updated_at = NOW() WHERE id = ?',
    ['failed', errorMsg, serviceId]
  );
}

export async function updateIp(serviceId, ip) {
  await pool.query('UPDATE services SET ip_address = ?, updated_at = NOW() WHERE id = ?', [encrypt(ip), serviceId]);
}

export async function updateVmId(serviceId, vmId) {
  await pool.query('UPDATE services SET vm_id = ?, updated_at = NOW() WHERE id = ?', [vmId, serviceId]);
}

export async function countByEmailAndType(email, productType) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count FROM services
     WHERE customer_email = ? AND product_type = ? AND status != 'deleted'`,
    [email, productType]
  );
  return Number(rows[0].count);
}

export async function suspend(serviceId) {
  await pool.query(
    `UPDATE services SET status = 'suspended', suspended_at = NOW(),
     expires_at = DATE_ADD(NOW(), INTERVAL 14 DAY), updated_at = NOW()
     WHERE id = ?`,
    [serviceId]
  );
}

export async function reactivate(serviceId) {
  await pool.query(
    `UPDATE services SET status = 'active', suspended_at = NULL, expires_at = NULL, updated_at = NOW()
     WHERE id = ?`,
    [serviceId]
  );
}

export async function markDeleted(serviceId) {
  await pool.query(
    `UPDATE services SET status = 'deleted', updated_at = NOW() WHERE id = ?`,
    [serviceId]
  );
}

export async function findAll() {
  const [rows] = await pool.query(
    `SELECT id, customer_email, customer_name, external_order_id, product_type,
            node_name, vm_id, ip_address, port, username,
            ram_gb, cpu, storage_gb, status, created_at
     FROM services WHERE status NOT IN ('deleted', 'failed')`
  );
  return rows.map(decryptRow);
}

export async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, customer_email, customer_name, external_order_id, product_type,
            node_name, vm_id, ip_address, port, username,
            ram_gb, cpu, storage_gb, status, created_at
     FROM services WHERE customer_email = ? AND status NOT IN ('deleted', 'failed')`,
    [email]
  );
  return rows.map(decryptRow);
}

export async function findExpired() {
  const [rows] = await pool.query(
    `SELECT * FROM services WHERE status = 'suspended' AND expires_at <= NOW()`
  );
  return rows.map(decryptRow);
}

export async function findExpiringSoon(days) {
  const [rows] = await pool.query(
    `SELECT * FROM services
     WHERE status = 'suspended'
       AND expires_at > NOW()
       AND expires_at <= DATE_ADD(NOW(), INTERVAL ? DAY)`,
    [days]
  );
  return rows.map(decryptRow);
}
