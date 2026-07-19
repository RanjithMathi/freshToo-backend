import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /customers?search=&status=
router.get('/', authenticateToken, async (req, res) => {
  const { search, status } = req.query;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT * FROM customers ${where} ORDER BY created_at DESC`, params);
  res.json({ customers: result.rows });
});

// GET /customers/:id
router.get('/:id', authenticateToken, async (req, res) => {
  const result = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer: result.rows[0] });
});

// GET /customers/:id/orders
router.get('/:id/orders', authenticateToken, async (req, res) => {
  const result = await query(
    'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json({ orders: result.rows });
});

// GET /customers/:id/addresses
router.get('/:id/addresses', authenticateToken, async (req, res) => {
  const result = await query(
    'SELECT * FROM addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
    [req.params.id]
  );
  res.json({ addresses: result.rows });
});

// PUT /customers/:id/status  (block/unblock)
router.put('/:id/status', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ error: "status must be 'active' or 'blocked'" });
  }
  const result = await query(
    'UPDATE customers SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer: result.rows[0] });
});

export default router;
