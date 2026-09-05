import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbDriver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

async function migrate() {
  if (dbDriver === 'postgres') {
    // PostgreSQL migration
    const pg = await import('pg');
    const { Pool } = pg.default;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    });
    try {
      const schema = await readFile(resolve(projectRoot, 'db', 'schema.sql'), 'utf8');
      await pool.query(schema);
      console.log('✓ PostgreSQL migration complete.');
    } finally {
      await pool.end();
    }
  } else {
    // SQLite migration via sql.js
    const { default: initSqlJs } = await import('sql.js');
    const { mkdirSync, existsSync, readFileSync, writeFileSync } = await import('node:fs');

    const dataDir = resolve(projectRoot, 'data');
    mkdirSync(dataDir, { recursive: true });
    const dbPath = resolve(dataDir, 'medlens.db');

    const SQL = await initSqlJs();
    let db;
    if (existsSync(dbPath)) {
      db = new SQL.Database(readFileSync(dbPath));
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    const schema = await readFile(resolve(projectRoot, 'db', 'schema.sqlite.sql'), 'utf8');
    db.exec(schema);

    // Save to disk
    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
    db.close();
    console.log('✓ SQLite migration complete. Database: data/medlens.db');
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
