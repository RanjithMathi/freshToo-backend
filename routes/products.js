import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /products:
 *   get:
 *     summary: List products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive match on product name
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 */
router.get('/', authenticateToken, async (req, res) => {
  const { category_id, is_active, search } = req.query;
  const conditions = [];
  const params = [];

  if (category_id) {
    params.push(category_id);
    conditions.push(`category_id = $${params.length}`);
  }
  if (is_active !== undefined) {
    params.push(is_active === 'true');
    conditions.push(`is_active = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM products ${where} ORDER BY created_at DESC`,
    params
  );
  res.json({ products: result.rows });
});

/**
 * @openapi
 * /products/low-stock:
 *   get:
 *     summary: List active products at or below their low-stock threshold
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Low-stock products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 */
router.get('/low-stock', authenticateToken, async (req, res) => {
  const result = await query(
    'SELECT * FROM products WHERE stock_quantity <= low_stock_threshold AND is_active = true ORDER BY stock_quantity ASC'
  );
  res.json({ products: result.rows });
});

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Get a single product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { product: { $ref: '#/components/schemas/Product' } }
 *       404:
 *         description: Product not found
 */
router.get('/:id', authenticateToken, async (req, res) => {
  const result = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: result.rows[0] });
});

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Create a product (manager+)
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               category_id: { type: integer }
 *               name: { type: string, example: Chicken Breast Boneless }
 *               description: { type: string }
 *               unit_type: { type: string, enum: [piece, kg, combo], default: piece }
 *               price: { type: number, example: 249 }
 *               stock_quantity: { type: number, example: 50 }
 *               low_stock_threshold: { type: number, example: 5 }
 *               image_url: { type: string }
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { product: { $ref: '#/components/schemas/Product' } }
 *       400:
 *         description: Validation error
 */
router.post('/', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  try {
    const {
      category_id, name, description, unit_type = 'piece',
      price, stock_quantity = 0, low_stock_threshold = 5, image_url,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }
    if (price < 0) return res.status(400).json({ error: 'price cannot be negative' });

    const result = await query(
      `INSERT INTO products (category_id, name, description, unit_type, price, stock_quantity, low_stock_threshold, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [category_id || null, name, description || null, unit_type, price, stock_quantity, low_stock_threshold, image_url || null]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     summary: Update a product (manager+)
 *     tags: [Products]
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
 *               category_id: { type: integer }
 *               name: { type: string }
 *               description: { type: string }
 *               unit_type: { type: string, enum: [piece, kg, combo] }
 *               price: { type: number }
 *               low_stock_threshold: { type: number }
 *               image_url: { type: string }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated product
 *       404:
 *         description: Product not found
 */
router.put('/:id', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const {
    category_id, name, description, unit_type,
    price, low_stock_threshold, image_url, is_active,
  } = req.body;

  const result = await query(
    `UPDATE products SET
       category_id = COALESCE($1, category_id),
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       unit_type = COALESCE($4, unit_type),
       price = COALESCE($5, price),
       low_stock_threshold = COALESCE($6, low_stock_threshold),
       image_url = COALESCE($7, image_url),
       is_active = COALESCE($8, is_active),
       updated_at = now()
     WHERE id = $9 RETURNING *`,
    [category_id, name, description, unit_type, price, low_stock_threshold, image_url, is_active, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: result.rows[0] });
});

/**
 * @openapi
 * /products/{id}/stock:
 *   put:
 *     summary: Set or adjust a product's stock quantity (staff+)
 *     tags: [Products]
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
 *             description: Provide either stock_quantity (absolute) or adjust_by (relative, can be negative)
 *             properties:
 *               stock_quantity: { type: number, example: 40 }
 *               adjust_by: { type: number, example: -5 }
 *     responses:
 *       200:
 *         description: Updated product
 *       400:
 *         description: Must provide stock_quantity or adjust_by
 *       404:
 *         description: Product not found
 */
router.put('/:id/stock', authenticateToken, requireRole('super_admin', 'manager', 'staff'), async (req, res) => {
  const { stock_quantity, adjust_by } = req.body;

  let result;
  if (stock_quantity !== undefined) {
    result = await query(
      'UPDATE products SET stock_quantity = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [stock_quantity, req.params.id]
    );
  } else if (adjust_by !== undefined) {
    result = await query(
      'UPDATE products SET stock_quantity = GREATEST(stock_quantity + $1, 0), updated_at = now() WHERE id = $2 RETURNING *',
      [adjust_by, req.params.id]
    );
  } else {
    return res.status(400).json({ error: 'Provide stock_quantity or adjust_by' });
  }

  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: result.rows[0] });
});

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     summary: Delete a product (super_admin only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product deleted
 *       404:
 *         description: Product not found
 */
router.delete('/:id', authenticateToken, requireRole('super_admin'), async (req, res) => {
  const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

export default router;
