import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /categories
router.get('/', authenticateToken, async (req, res) => {
  const result = await query('SELECT * FROM categories ORDER BY name ASC');
  res.json({ categories: result.rows });
});

// POST /categories
router.post('/', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  try {
    const result = await query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /categories/:id
router.put('/:id', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const { name, description } = req.body;
  const result = await query(
    'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
    [name, description, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
  res.json({ category: result.rows[0] });
});

// DELETE /categories/:id
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
  res.json({ message: 'Category deleted' });
});

export default router;
