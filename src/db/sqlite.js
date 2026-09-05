import initSqlJs from 'sql.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

// Resolve data directory relative to project root
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = resolve(projectRoot, 'data');
mkdirSync(dataDir, { recursive: true });
const dbPath = resolve(dataDir, 'medlens.db');

// Initialize sql.js and open/create the database
const SQL = await initSqlJs();
let db;
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// db.export() implicitly ends any in-progress transaction (it snapshots via a
// close/reopen internally), so persistence must be suspended for the
// duration of an explicit BEGIN…COMMIT/ROLLBACK and flushed once it ends.
let inExplicitTransaction = false;

/** Persist the in-memory database to disk (no-op mid-transaction). */
function save() {
  if (inExplicitTransaction) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

// Auto-save every 5 seconds and on process exit. unref() so this timer alone
// never keeps the process alive — the listening server does that in
// production; in tests/scripts, the process can exit once real work is done.
const saveInterval = setInterval(save, 5000).unref();
process.on('exit', () => { clearInterval(saveInterval); try { save(); } catch {} });
process.on('SIGINT', () => { save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });

/**
 * Convert PostgreSQL-style $1, $2 placeholders to SQLite ? placeholders.
 * Returns ordered params array.
 */
function convertQuery(sql, params = []) {
  // Replace $N with ? and reorder params by their index
  const usedIndices = [];
  const converted = sql.replace(/\$(\d+)/g, (_match, num) => {
    usedIndices.push(parseInt(num, 10) - 1);
    return '?';
  });
  const orderedParams = usedIndices.map((i) => params[i]);

  // Stringify any object/array params (JSONB → TEXT in SQLite)
  const safeParams = orderedParams.map((p) =>
    p !== null && p !== undefined && typeof p === 'object' && !(p instanceof Buffer)
      ? JSON.stringify(p)
      : p === undefined ? null : p,
  );

  return { sql: converted, params: safeParams };
}

/**
 * Convert column names from snake_case SQL results to a flat object.
 * Also attempts to parse JSON strings back to objects for JSONB-like columns.
 */
function parseRows(stmt) {
  const rows = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    // Parse JSONB-like TEXT columns
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { row[key] = JSON.parse(val); } catch { /* not JSON */ }
      }
    }
    rows.push(row);
  }
  stmt.free();
  return rows;
}

/**
 * Replace PostgreSQL's now() with SQLite's datetime equivalent.
 * Replace PostgreSQL-specific verified_at=now() patterns.
 */
function adaptSql(sql) {
  return sql
    .replace(/\bnow\(\)/gi, "datetime('now')")
    .replace(/::jsonb/gi, '');
}

/** Unified query interface matching pg's { rows } shape */
async function query(sql, params = []) {
  const adapted = adaptSql(sql);
  const q = convertQuery(adapted, params);
  const trimmed = q.sql.trim().toUpperCase();

  if (
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('WITH') ||
    trimmed.startsWith('PRAGMA')
  ) {
    const stmt = db.prepare(q.sql);
    if (q.params.length) stmt.bind(q.params);
    const rows = parseRows(stmt);
    return { rows };
  }

  // INSERT … RETURNING
  if (trimmed.startsWith('INSERT') && trimmed.includes('RETURNING')) {
    const returningMatch = q.sql.match(/RETURNING\s+(.+)$/i);
    const returningCols = returningMatch ? returningMatch[1].trim() : '*';
    const withoutReturning = q.sql.replace(/\s+RETURNING\s+.+$/i, '');
    const tableMatch = q.sql.match(/INSERT\s+INTO\s+(\w+)/i);

    db.run(withoutReturning, q.params);

    if (tableMatch) {
      const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0];
      const selectSql = `SELECT ${returningCols} FROM ${tableMatch[1]} WHERE rowid = ?`;
      const stmt = db.prepare(selectSql);
      stmt.bind([lastId]);
      const rows = parseRows(stmt);
      save(); // persist after writes
      return { rows };
    }
    save();
    return { rows: [] };
  }

  // UPDATE/DELETE with RETURNING
  if (trimmed.includes('RETURNING')) {
    const returningMatch = q.sql.match(/RETURNING\s+(.+)$/i);
    const returningCols = returningMatch ? returningMatch[1].trim() : '*';
    const withoutReturning = q.sql.replace(/\s+RETURNING\s+.+$/i, '');
    const tableMatch = q.sql.match(/UPDATE\s+(\w+)/i);
    const whereMatch = q.sql.match(/(WHERE\s+.+?)(?:\s+RETURNING)/i);

    db.run(withoutReturning, q.params);
    save();

    if (tableMatch && whereMatch) {
      const wq = convertQuery(whereMatch[1], params);
      const selectSql = `SELECT ${returningCols} FROM ${tableMatch[1]} ${wq.sql}`;
      const stmt = db.prepare(selectSql);
      stmt.bind(wq.params);
      return { rows: parseRows(stmt) };
    }
    return { rows: [] };
  }

  // Plain INSERT/UPDATE/DELETE
  db.run(q.sql, q.params);
  save();
  return { rows: [], rowCount: db.getRowsModified() };
}

/**
 * Transaction support — returns a client-like object.
 * Mimics pg's pool.connect() → client with query/release.
 */
async function connect() {
  let inTransaction = false;

  return {
    async query(sql, params = []) {
      const upper = sql.trim().toUpperCase();
      if (upper === 'BEGIN') {
        db.run('BEGIN');
        inTransaction = true;
        inExplicitTransaction = true;
        return { rows: [] };
      }
      if (upper === 'COMMIT') {
        db.run('COMMIT');
        inTransaction = false;
        inExplicitTransaction = false;
        save();
        return { rows: [] };
      }
      if (upper === 'ROLLBACK') {
        if (inTransaction) {
          try { db.run('ROLLBACK'); } catch { /* already committed/rolled back */ }
          inTransaction = false;
          inExplicitTransaction = false;
        }
        return { rows: [] };
      }
      return query(sql, params);
    },
    release() {
      if (inTransaction) {
        try { db.run('ROLLBACK'); } catch { /* already committed/rolled back */ }
        inTransaction = false;
        inExplicitTransaction = false;
      }
    },
  };
}

/** Ping the database — used by health checks */
async function ping() {
  db.exec('SELECT 1');
  return true;
}

/** Run raw SQL (used by migration scripts) */
async function exec(sql) {
  db.exec(sql);
  save();
}

/** Close the database */
async function end() {
  clearInterval(saveInterval);
  save();
  db.close();
}

export default { query, connect, ping, exec, end };
