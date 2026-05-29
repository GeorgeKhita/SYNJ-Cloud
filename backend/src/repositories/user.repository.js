import pool from '../config/db.js';

const SAFE_FIELDS = 'id, wordpress_id, email, first_name, last_name, role, status, created_at';

export async function findByWordpressId(wordpressId) {
  const [rows] = await pool.query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE wordpress_id = ?`,
    [wordpressId]
  );
  return rows[0] ?? null;
}

export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function upsert(wordpressId, email, firstName, lastName = '') {
  await pool.query(
    `INSERT INTO users (wordpress_id, email, first_name, last_name)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email      = VALUES(email),
       first_name = VALUES(first_name),
       last_name  = VALUES(last_name),
       updated_at = NOW()`,
    [wordpressId, email, firstName, lastName]
  );
  const [rows] = await pool.query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE wordpress_id = ?`,
    [wordpressId]
  );
  return rows[0];
}
