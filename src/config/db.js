const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Verificar conexión al arrancar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  Error conectando a PostgreSQL:', err.message);
    process.exit(1);
  }
  console.log('✅  PostgreSQL conectado —', process.env.DB_NAME);
  release();
});

module.exports = pool;