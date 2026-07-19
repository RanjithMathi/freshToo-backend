import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /delivery-zones
router.get('/', authenticateToken, async (req, res) => {
  const result = await query('SELECT * FROM delivery_zones ORDER BY name ASC');
  res.json({ zones: result.rows });
});

// POST /delivery-zones
router.post('/', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, pincodes = [], delivery_charge = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Zone name is required' });

  const result = await query(
    'INSERT INTO delivery_zones (name, pincodes, delivery_charge) VALUES ($1, $2, $3) RETURNING *',
    [name, pincodes, delivery_charge]
  );
  res.status(201).json({ zone: result.rows[0] });
});

// PUT /delivery-zones/:id
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

// DELETE /delivery-zones/:id
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const result = await query('DELETE FROM delivery_zones WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Zone not found' });
  res.json({ message: 'Zone deleted' });
});

export default router;
