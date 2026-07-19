import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /delivery-partners:
 *   get:
 *     summary: List delivery partners (riders)
 *     tags: [Delivery Partners]
 *     parameters:
 *       - in: query
 *         name: zone_id
 *         schema: { type: integer }
 *       - in: query
 *         name: is_available
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of delivery partners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 delivery_partners:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/DeliveryPartner' }
 */
router.get('/', authenticateToken, async (req, res) => {
  const { zone_id, is_available } = req.query;
  const conditions = [];
  const params = [];

  if (zone_id) {
    params.push(zone_id);
    conditions.push(`zone_id = $${params.length}`);
  }
  if (is_available !== undefined) {
    params.push(is_available === 'true');
    conditions.push(`is_available = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, name, phone, email, vehicle_type, zone_id, is_available, is_active, created_at
     FROM delivery_partners ${where} ORDER BY created_at DESC`,
    params
  );
  res.json({ delivery_partners: result.rows });
});

/**
 * @openapi
 * /delivery-partners/{id}/orders:
 *   get:
 *     summary: Get a delivery partner's current (non-final) order assignments
 *     tags: [Delivery Partners]
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
    `SELECT * FROM orders WHERE delivery_partner_id = $1
     AND status NOT IN ('delivered', 'cancelled') ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json({ orders: result.rows });
});

/**
 * @openapi
 * /delivery-partners:
 *   post:
 *     summary: Create a delivery partner (manager+)
 *     tags: [Delivery Partners]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, password]
 *             properties:
 *               name: { type: string, example: Suresh }
 *               phone: { type: string, example: "9876500000" }
 *               email: { type: string, example: suresh@example.com }
 *               password: { type: string, example: RiderPass123! }
 *               vehicle_type: { type: string, example: bike }
 *               zone_id: { type: integer }
 *     responses:
 *       201:
 *         description: Delivery partner created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { delivery_partner: { $ref: '#/components/schemas/DeliveryPartner' } }
 *       409:
 *         description: Phone number already registered
 */
router.post('/', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const { name, phone, email, password, vehicle_type, zone_id } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'name, phone and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO delivery_partners (name, phone, email, password_hash, vehicle_type, zone_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, phone, email, vehicle_type, zone_id, is_available, is_active, created_at`,
      [name, phone, email || null, passwordHash, vehicle_type || null, zone_id || null]
    );
    res.status(201).json({ delivery_partner: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    console.error('Create delivery partner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /delivery-partners/{id}:
 *   put:
 *     summary: Update a delivery partner (manager+)
 *     tags: [Delivery Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               vehicle_type: { type: string }
 *               zone_id: { type: integer }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated delivery partner
 *       404:
 *         description: Delivery partner not found
 */
router.put('/:id', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, email, vehicle_type, zone_id, is_active } = req.body;
  const result = await query(
    `UPDATE delivery_partners SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       vehicle_type = COALESCE($3, vehicle_type),
       zone_id = COALESCE($4, zone_id),
       is_active = COALESCE($5, is_active)
     WHERE id = $6
     RETURNING id, name, phone, email, vehicle_type, zone_id, is_available, is_active`,
    [name, email, vehicle_type, zone_id, is_active, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Delivery partner not found' });
  res.json({ delivery_partner: result.rows[0] });
});

/**
 * @openapi
 * /delivery-partners/{id}/availability:
 *   put:
 *     summary: Toggle a delivery partner's availability
 *     tags: [Delivery Partners]
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
 *             properties: { is_available: { type: boolean } }
 *     responses:
 *       200:
 *         description: Updated availability
 *       404:
 *         description: Delivery partner not found
 */
router.put('/:id/availability', authenticateToken, async (req, res) => {
  const { is_available } = req.body;
  const result = await query(
    'UPDATE delivery_partners SET is_available = $1 WHERE id = $2 RETURNING id, name, is_available',
    [!!is_available, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Delivery partner not found' });
  res.json({ delivery_partner: result.rows[0] });
});

/**
 * @openapi
 * /delivery-partners/{id}:
 *   delete:
 *     summary: Delete a delivery partner (super_admin only)
 *     tags: [Delivery Partners]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Delivery partner deleted
 *       404:
 *         description: Delivery partner not found
 */
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const result = await query('DELETE FROM delivery_partners WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Delivery partner not found' });
  res.json({ message: 'Delivery partner deleted' });
});

export default router;
