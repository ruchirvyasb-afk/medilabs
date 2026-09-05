import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl ? { rejectUnauthorized: true } : false,
  max: 10,
});

/** Unified query interface */
async function query(sql, params = []) {
  return pool.query(sql, params);
}

/** Transaction support — returns a pg client */
async function connect() {
  return pool.connect();
}

/** Ping the database — used by health checks */
async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

/** Run raw SQL (used by migration scripts) */
async function exec(sql) {
  await pool.query(sql);
}

/** Close the pool */
async function end() {
  await pool.end();
}

export default { query, connect, ping, exec, end };
