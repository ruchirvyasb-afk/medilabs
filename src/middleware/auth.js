import jwt from 'jsonwebtoken';
import config from '../config.js';

/**
 * Sign a JWT for a user. Returns a short-lived access token.
 */
export function sign(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.jwtSecret,
    { expiresIn: '15m', issuer: 'medlens', audience: 'medlens-web' },
  );
}

/**
 * Express middleware — verifies the Authorization: Bearer token
 * and attaches decoded payload to req.user.
 */
export function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error();
    req.user = jwt.verify(token, config.jwtSecret, {
      issuer: 'medlens',
      audience: 'medlens-web',
    });
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required.' });
  }
}
