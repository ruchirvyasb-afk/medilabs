/**
 * Role-based authorization middleware.
 * Usage: allow('admin', 'clinician')
 */
export function allow(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Insufficient role.' });
  };
}
