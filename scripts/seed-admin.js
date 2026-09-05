import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbDriver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || 'replace-this-password';

if (password === 'replace-this-password') {
  console.warn('⚠  Using default seed password. Set SEED_ADMIN_PASSWORD in .env for production.');
}

async function seed() {
  const passwordHash = await bcrypt.hash(password, 12);

  if (dbDriver === 'postgres') {
    const pg = await import('pg');
    const { Pool } = pg.default;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
        [email, passwordHash, 'admin'],
      );
      console.log(`✓ Admin seed complete (PostgreSQL): ${email}`);
    } finally {
      await pool.end();
    }
  } else {
    // SQLite via sql.js
    const { default: initSqlJs } = await import('sql.js');
    const { readFileSync, writeFileSync } = await import('node:fs');

    const dbPath = resolve(projectRoot, 'data', 'medlens.db');
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync(dbPath));
    db.run('PRAGMA foreign_keys = ON');

    db.run(
      'INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, passwordHash, 'admin'],
    );

    writeFileSync(dbPath, Buffer.from(db.export()));
    db.close();
    console.log(`✓ Admin seed complete (SQLite): ${email}`);
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
