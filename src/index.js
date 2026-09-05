import config from './config.js';
import app from './app.js';
import db from './db/index.js';

// Startup banner
console.log(`
  ╔══════════════════════════════════════╗
  ║         MedLens API  v1.0.0         ║
  ╟──────────────────────────────────────╢
  ║  env:     ${config.env.padEnd(25)} ║
  ║  db:      ${config.dbDriver.padEnd(25)} ║
  ║  host:    ${config.host.padEnd(25)} ║
  ║  port:    ${String(config.port).padEnd(25)} ║
  ╚══════════════════════════════════════╝
`);

const server = app.listen(config.port, config.host, () => {
  console.log(`✓ MedLens API listening on http://${config.host}:${config.port}`);
  console.log(`  Health: http://${config.host}:${config.port}/api/health`);
});

// ── Graceful shutdown ──────────────────────────────────
// Cloud Run sends SIGTERM before stopping a container instance.

function shutdown(signal) {
  console.log(`\n⏻ Received ${signal} — shutting down gracefully…`);
  server.close(async () => {
    try {
      await db.end();
      console.log('✓ Database connections closed.');
    } catch { /* already closed */ }
    process.exit(0);
  });
  // Force exit after 10 seconds if connections are hanging
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

