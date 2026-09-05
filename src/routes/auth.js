import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { auth, sign } from '../middleware/auth.js';
import { credentials } from '../validators/schemas.js';

const router = Router();

/** POST /api/auth/login */
router.post('/login', async (req, res, next) => {
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

/** GET /api/auth/me */
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
