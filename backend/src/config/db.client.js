const mysql = require('mysql2');
const config = require('./db.config');

const pool = mysql.createPool({
  host: config.db_host,
  database: config.db_name,
  user: config.db_user,
  password: config.db_password
});

pool.getConnection((err, connection) => {
  if (err) console.log('Erreur MySQL:', err.message);
  else {
    console.log('MySQL connecté');
    connection.release();
  }
});

module.exports = pool;