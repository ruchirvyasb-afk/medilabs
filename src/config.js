import 'dotenv/config';
import crypto from 'node:crypto';

/** @returns {string} 32 random bytes, base64 encoded */
function generateKey() {
  return crypto.randomBytes(32).toString('base64');
}

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

// Auto-generate secrets in dev mode if not provided
if (isDev && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = generateKey();
  console.warn('⚠  JWT_SECRET not set — auto-generated for this dev session.');
}
if (isDev && !process.env.DATA_ENCRYPTION_KEY) {
  process.env.DATA_ENCRYPTION_KEY = generateKey();
  console.warn('⚠  DATA_ENCRYPTION_KEY not set — auto-generated for this dev session.');
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4173,
  host: process.env.HOST || '0.0.0.0',
  isDev,

  // Database
  dbDriver: (process.env.DB_DRIVER || 'sqlite').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://medlens:replace_me@localhost:5432/medlens',
  dbSsl: process.env.DB_SSL === 'true',

  // Security
  jwtSecret: process.env.JWT_SECRET,
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY,
  frontendOrigin: process.env.FRONTEND_ORIGIN?.split(',') || false,

  // Seed
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || 'replace-this-password',
};

// Validate encryption key decodes to 32 bytes
const keyBuf = Buffer.from(config.dataEncryptionKey, 'base64');
if (keyBuf.length !== 32) {
  throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.');
}
config.encryptionKeyBuffer = keyBuf;

export default config;
