import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /customers:
 *   get:
 *     summary: List customers
 *     tags: [Customers]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches name, phone, or email
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, blocked] }
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customers:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Customer' }
 */
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

/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     summary: Get a single customer
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Customer found
 *       404:
 *         description: Customer not found
 */
router.get('/:id', authenticateToken, async (req, res) => {
  const result = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer: result.rows[0] });
});

/**
 * @openapi
 * /customers/{id}/orders:
 *   get:
 *     summary: Get a customer's order history
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 */
router.get('/:id/orders', authenticateToken, async (req, res) => {
  const result = await query(
    'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json({ orders: result.rows });
});

/**
 * @openapi
 * /customers/{id}/addresses:
 *   get:
 *     summary: Get a customer's saved addresses
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 addresses:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Address' }
 */
router.get('/:id/addresses', authenticateToken, async (req, res) => {
  const result = await query(
    'SELECT * FROM addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
    [req.params.id]
  );
  res.json({ addresses: result.rows });
});

/**
 * @openapi
 * /customers/{id}/status:
 *   put:
 *     summary: Block or unblock a customer (manager+)
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, blocked] }
 *     responses:
 *       200:
 *         description: Updated customer
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Customer not found
 */
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
