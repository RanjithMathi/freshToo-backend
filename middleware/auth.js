import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    // payload = { adminId, email, role, iat, exp }
    req.admin = payload;
    next();
  });
}

// Usage: requireRole('super_admin', 'manager')
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}
