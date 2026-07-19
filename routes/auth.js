import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(admin) {
  return jwt.sign(
    { adminId: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];

    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(admin);
    res.json({
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me
router.get('/me', authenticateToken, async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, is_active, created_at FROM admins WHERE id = $1',
    [req.admin.adminId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  res.json({ admin: result.rows[0] });
});

// POST /auth/staff  (super_admin and manager can create staff accounts)
router.post('/staff', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const allowedRoles = ['manager', 'staff'];
    const finalRole = allowedRoles.includes(role) ? role : 'staff';
    // Only a super_admin may create another super_admin
    if (role === 'super_admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super admin can create another super admin' });
    }

    const existing = await query('SELECT id FROM admins WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, role === 'super_admin' ? 'super_admin' : finalRole]
    );

    res.status(201).json({ admin: result.rows[0] });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/staff  (list admin/staff accounts)
router.get('/staff', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const result = await query(
    'SELECT id, name, email, role, is_active, created_at FROM admins ORDER BY created_at DESC'
  );
  res.json({ staff: result.rows });
});

// PUT /auth/staff/:id/status  (activate/deactivate)
router.put('/staff/:id/status', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const { is_active } = req.body;
  const result = await query(
    'UPDATE admins SET is_active = $1 WHERE id = $2 RETURNING id, name, email, role, is_active',
    [!!is_active, req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  res.json({ admin: result.rows[0] });
});

export default router;
