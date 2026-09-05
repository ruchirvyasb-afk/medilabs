import crypto from 'node:crypto';
import config from '../config.js';

const key = config.encryptionKeyBuffer;

/**
 * Encrypt a JS value with AES-256-GCM.
 * Returns a JSON-safe envelope: { v, iv, tag, ciphertext }.
 */
export function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/**
 * Decrypt an AES-256-GCM envelope back to its original JS value.
 */
export function decrypt(blob) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(blob.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}
