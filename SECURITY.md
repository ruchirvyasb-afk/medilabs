# Security and privacy notes

MedLens handles protected health information. The included encryption is application-layer AES-256-GCM; PostgreSQL/TLS, disk encryption, database backups, centralized logs, and secret management are separate mandatory production controls.

Never run with development defaults in production. Set `NODE_ENV=production`, set `FRONTEND_ORIGIN` to the exact deployed UI origin, enforce PostgreSQL TLS, provision least-privilege database credentials, and place the API behind HTTPS.

The supplied report parser is intentionally conservative and does not diagnose, prescribe, or invent reference ranges. It is not a substitute for clinical review.

The included JWT is access-token-only to keep the starter implementation focused. For production, add short-lived access tokens plus rotating, hashed, httpOnly + Secure + SameSite refresh tokens, CSRF controls where cookies are used, account lockout/monitoring, MFA for staff roles, and a formal authorization review.
