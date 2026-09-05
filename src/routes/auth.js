import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import db from '../db/index.js';
import { auth, sign } from '../middleware/auth.js';
import { credentials } from '../validators/schemas.js';

const router = Router();

// Brute-force protection for credential-guessing endpoints only — not /me,
// which every page load calls just to check an existing session.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

/** POST /api/auth/login */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email=$1 AND disabled_at IS NULL',
      [input.email.toLowerCase()],
    );

    if (!rows[0] || !(await bcrypt.compare(input.password, rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await db.query(
      'INSERT INTO audit_events (patient_id, actor_id, action, metadata) VALUES ($1,$2,$3,$4)',
      [null, rows[0].id, 'auth.login', {}],
    );

    res.json({
      token: sign(rows[0]),
      user: { id: rows[0].id, email: rows[0].email, role: rows[0].role },
    });
  } catch (e) {
    next(e);
  }
});

/** POST /api/auth/register — public sign-up, always creates a 'customer' account */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    const email = input.email.toLowerCase();
    const hash = await bcrypt.hash(input.password, 12);

    let user;
    try {
      const { rows } = await db.query(
        'INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role',
        [email, hash, 'customer'],
      );
      user = rows[0];
    } catch (e) {
      if (e.code === '23505' || /unique/i.test(e.message || '')) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw e;
    }

    await db.query(
      'INSERT INTO audit_events (patient_id, actor_id, action, metadata) VALUES ($1,$2,$3,$4)',
      [null, user.id, 'auth.register', {}],
    );

    res.status(201).json({ token: sign(user), user });
  } catch (e) {
    next(e);
  }
});

/** GET /api/auth/me */
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
