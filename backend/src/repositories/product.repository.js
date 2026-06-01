import pool from '../config/db.js';

function parse(row) {
  if (!row) return null;
  return {
    ...row,
    pricing_config:  typeof row.pricing_config  === 'string' ? JSON.parse(row.pricing_config)  : row.pricing_config,
    resource_config: typeof row.resource_config === 'string' ? JSON.parse(row.resource_config) : row.resource_config,
  };
}

export async function findAll({ type } = {}) {
  const conditions = ['status = ?'];
  const params     = ['active'];

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  const [rows] = await pool.query(
    `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY name`,
    params
  );
  return rows.map(parse);
}

export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  return parse(rows[0] ?? null);
}
