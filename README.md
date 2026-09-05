# MedLens secure backend

MedLens now has a Node/Express API and PostgreSQL storage design for protected clinical records. This is a deployment-ready foundation, but it must be configured with real secrets and a managed PostgreSQL instance before being exposed publicly.

## Security model

- AES-256-GCM encrypts patient profiles, source report text, observations, and summaries **before** they are sent to PostgreSQL.
- Passwords are hashed with bcrypt (12 rounds); never stored in plaintext.
- Short-lived signed JWTs (15 minutes) secure the API. Production should use an httpOnly secure refresh-token cookie / rotation service in addition.
- Roles are enforced server-side: `admin` manages users, `clinician` creates/reviews records, and `customer` can only read their own linked patient record.
- SQL is parameterized. Helmet, CORS allow-listing, request-size limits, and login rate limiting are enabled.
- Audit records are append-only at database level through a PostgreSQL trigger.
- Source ranges are the only ranges used to compute low/normal/high. Missing ranges stay `unclassified`.

## Setup

1. Install Node dependencies with `npm install` (npm needs to be available on the deployment machine).
2. Create a PostgreSQL database/user with a unique strong password and TLS enabled for production.
3. Copy `.env.example` to `.env`, then replace every placeholder. Generate the encryption key with Node's crypto command shown in that file.
4. Run `npm run db:migrate` then `npm run db:seed`.
5. Run `npm start` (or `npm run dev` locally).

Do not commit `.env`, a database dump, any report data, or encryption keys. Use a secrets manager in production and rotate `JWT_SECRET` / `DATA_ENCRYPTION_KEY` through a planned key-rotation process.

## Main API endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/users` — admin only
- `POST /api/patients` — admin/clinician only
- `GET /api/patients/:patientId` — role-aware record read
- `POST /api/patients/:patientId/reports` — source-aware extraction and safe summary
- `PATCH /api/observations/:observationId/verify` — admin/clinician only
- `GET /api/patients/:patientId/audit`

The browser prototype remains available on `/`. For a complete production UI, add a login page that keeps the short-lived access token in memory and sends it in the `Authorization: Bearer` header—never in localStorage.
