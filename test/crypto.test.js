import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('base64');
process.env.DATA_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('base64');

const { encrypt, decrypt } = await import('../src/services/crypto.js');

test('encrypt/decrypt round-trips an arbitrary object', () => {
  const original = { testName: 'ALT', value: 42, referenceRange: '7 - 35 U/L' };
  const blob = encrypt(original);
  assert.deepEqual(decrypt(blob), original);
});

test('encrypt never stores plaintext in the envelope', () => {
  const blob = encrypt({ secret: 'patient-identifying-value' });
  const serialized = JSON.stringify(blob);
  assert.ok(!serialized.includes('patient-identifying-value'));
});

test('decrypt fails closed when the auth tag has been tampered with', () => {
  const blob = encrypt({ value: 1 });
  blob.tag = Buffer.from('0'.repeat(32), 'hex').toString('base64');
  assert.throws(() => decrypt(blob));
});
