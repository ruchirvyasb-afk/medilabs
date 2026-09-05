import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { allow } from '../middleware/authorize.js';
import { createUser } from '../validators/schemas.js';

const router = Router();

/** POST /api/users — admin only */
router.post('/', auth, allow('admin'), async (req, res, next) => {
  try {
    const input = createUser.parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const { rows } = await db.query(
      'INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role',
      [input.email.toLowerCase(), hash, input.role],
    );

    await db.query(
      'INSERT INTO audit_events (patient_id, actor_id, action, metadata) VALUES ($1,$2,$3,$4)',
      [null, req.user.sub, 'user.created', { role: input.role }],
    );

    res.status(201).json({ user: rows[0] });
  } catch (e) {
    next(e);
  }
});

export default router;
