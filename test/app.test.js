import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('base64');
process.env.DATA_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('base64');

const { default: app } = await import('../src/app.js');

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/health reports ok without touching the database', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
  });
});

test('GET /api/patients without a token is rejected before any DB access', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/patients`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Authentication required.');
  });
});

test('POST /api/auth/login rejects an under-length password before touching the DB', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'short' }),
    });
    assert.equal(res.status, 400);
  });
});

test('GET /api/observations/:id/verify without a role is rejected as unauthenticated', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/observations/00000000-0000-0000-0000-000000000000/verify`, {
      method: 'PATCH',
    });
    assert.equal(res.status, 401);
  });
});
