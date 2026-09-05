import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credentials, profileSchema, createPatient } from '../src/validators/schemas.js';

test('credentials rejects a password under 12 characters', () => {
  assert.throws(() => credentials.parse({ email: 'a@b.com', password: 'short' }));
});

test('credentials accepts a valid email/password pair', () => {
  const result = credentials.parse({ email: 'a@b.com', password: 'a-strong-password-1' });
  assert.equal(result.email, 'a@b.com');
});

test('profileSchema defaults array fields to empty when omitted', () => {
  const result = profileSchema.parse({ fullName: 'Jane Doe', age: 30, sex: 'Female' });
  assert.deepEqual(result.symptoms, []);
  assert.deepEqual(result.medications, []);
});

test('createPatient rejects a non-uuid ownerUserId', () => {
  assert.throws(() =>
    createPatient.parse({
      profile: { fullName: 'Jane Doe', age: 30, sex: 'Female' },
      ownerUserId: 'not-a-uuid',
    }),
  );
});
