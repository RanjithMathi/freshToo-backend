import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /delivery-zones:
 *   get:
 *     summary: List delivery zones
 *     tags: [Delivery Zones]
 *     responses:
 *       200:
 *         description: List of zones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 zones:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/DeliveryZone' }
 */
router.get('/', authenticateToken, async (req, res) => {
  const result = await query('SELECT * FROM delivery_zones ORDER BY name ASC');
  res.json({ zones: result.rows });
});

/**
 * @openapi
 * /delivery-zones:
 *   post:
 *     summary: Create a delivery zone (manager+)
 *     tags: [Delivery Zones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Zone A - Central }
 *               pincodes: { type: array, items: { type: string }, example: ["620001", "620002"] }
 *               delivery_charge: { type: number, example: 30 }
 *     responses:
 *       201:
 *         description: Zone created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { zone: { $ref: '#/components/schemas/DeliveryZone' } }
 */
router.post('/', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, pincodes = [], delivery_charge = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Zone name is required' });

  const result = await query(
    'INSERT INTO delivery_zones (name, pincodes, delivery_charge) VALUES ($1, $2, $3) RETURNING *',
    [name, pincodes, delivery_charge]
  );
  res.status(201).json({ zone: result.rows[0] });
});

/**
 * @openapi
 * /delivery-zones/{id}:
 *   put:
 *     summary: Update a delivery zone (manager+)
 *     tags: [Delivery Zones]
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
 *               pincodes: { type: array, items: { type: string } }
 *               delivery_charge: { type: number }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated zone
 *       404:
 *         description: Zone not found
 */
router.put('/:id', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, pincodes, delivery_charge, is_active } = req.body;
  const result = await query(
    `UPDATE delivery_zones SET
       name = COALESCE($1, name),
       pincodes = COALESCE($2, pincodes),
       delivery_charge = COALESCE($3, delivery_charge),
       is_active = COALESCE($4, is_active)
     WHERE id = $5 RETURNING *`,
    [name, pincodes, delivery_charge, is_active, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Zone not found' });
  res.json({ zone: result.rows[0] });
});

/**
 * @openapi
 * /delivery-zones/{id}:
 *   delete:
 *     summary: Delete a delivery zone (super_admin only)
 *     tags: [Delivery Zones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Zone deleted
 *       404:
 *         description: Zone not found
 */
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const result = await query('DELETE FROM delivery_zones WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Zone not found' });
  res.json({ message: 'Zone deleted' });
});

export default router;
