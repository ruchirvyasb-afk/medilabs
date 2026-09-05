import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import db from '../db/index.js';
import config from '../config.js';

const router = Router();
const startedAt = Date.now();

// Read version from package.json
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let appVersion = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
  appVersion = pkg.version || appVersion;
} catch { /* fallback */ }

/** GET /api/health — liveness check (always 200 if the process is up) */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/** GET /api/health/ready — readiness check (verifies DB connectivity) */
router.get('/ready', async (_req, res) => {
  try {
    await db.ping();
    res.json({
      status: 'ready',
      db: 'connected',
      driver: config.dbDriver,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'unavailable',
      db: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/** GET /api/health/info — app metadata */
router.get('/info', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    version: appVersion,
    nodeVersion: process.version,
    dbDriver: config.dbDriver,
    env: config.env,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
