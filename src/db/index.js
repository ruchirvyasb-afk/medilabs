import config from '../config.js';

let db;

if (config.dbDriver === 'postgres') {
  const mod = await import('./postgres.js');
  db = mod.default;
} else {
  const mod = await import('./sqlite.js');
  db = mod.default;
}

export default db;
