import { Router } from 'express';
import { pool, query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

// GET /orders?status=&customer_id=&from=&to=
router.get('/', authenticateToken, async (req, res) => {
  const { status, customer_id, from, to } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (customer_id) {
    params.push(customer_id);
    conditions.push(`customer_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);
  res.json({ orders: result.rows });
});

// GET /orders/:id  (with items)
router.get('/:id', authenticateToken, async (req, res) => {
  const orderResult = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

  const itemsResult = await query(
    `SELECT oi.*, p.name AS product_name
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [req.params.id]
  );

  res.json({ order: orderResult.rows[0], items: itemsResult.rows });
});

// POST /orders  (manual order creation, e.g. phone orders taken by admin)
// body: { customer_id, address_id, delivery_zone_id, payment_method, items: [{ product_id, quantity }] }
router.post('/', authenticateToken, requireRole('super_admin', 'manager', 'staff'), async (req, res) => {
  const { customer_id, address_id, delivery_zone_id, payment_method = 'cod', items, notes } = req.body;

  if (!customer_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customer_id and a non-empty items array are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
      const product = productResult.rows[0];

      if (!product) throw { status: 400, message: `Product ${item.product_id} not found` };
      if (!product.is_active) throw { status: 400, message: `Product ${product.name} is not available` };
      if (product.stock_quantity < item.quantity) {
        throw { status: 400, message: `Insufficient stock for ${product.name}` };
      }

      const lineSubtotal = Number(product.price) * Number(item.quantity);
      subtotal += lineSubtotal;
      lineItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: lineSubtotal,
      });

      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [
        item.quantity,
        product.id,
      ]);
    }

    let deliveryCharge = 0;
    if (delivery_zone_id) {
      const zoneResult = await client.query('SELECT delivery_charge FROM delivery_zones WHERE id = $1', [delivery_zone_id]);
      deliveryCharge = Number(zoneResult.rows[0]?.delivery_charge || 0);
    }

    const totalAmount = subtotal + deliveryCharge;

    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, address_id, payment_method, subtotal, delivery_charge, total_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [customer_id, address_id || null, payment_method, subtotal, deliveryCharge, totalAmount, notes || null]
    );
    const order = orderResult.rows[0];

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, li.product_id, li.quantity, li.unit_price, li.subtotal]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order, items: lineItems });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /orders/:id/status
router.put('/:id/status', authenticateToken, requireRole('super_admin', 'manager', 'staff'), async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    // If cancelling an order that hadn't already been cancelled/delivered, restock items
    if (status === 'cancelled' && !['cancelled', 'delivered'].includes(current.rows[0].status)) {
      const items = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [req.params.id]);
      for (const item of items.rows) {
        await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [
          item.quantity,
          item.product_id,
        ]);
      }
    }

    const result = await client.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ order: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /orders/:id/assign-delivery
router.put('/:id/assign-delivery', authenticateToken, requireRole('super_admin', 'manager', 'staff'), async (req, res) => {
  const { delivery_partner_id } = req.body;
  if (!delivery_partner_id) return res.status(400).json({ error: 'delivery_partner_id is required' });

  const partner = await query('SELECT id, is_active FROM delivery_partners WHERE id = $1', [delivery_partner_id]);
  if (partner.rows.length === 0) return res.status(404).json({ error: 'Delivery partner not found' });
  if (!partner.rows[0].is_active) return res.status(400).json({ error: 'Delivery partner is not active' });

  const result = await query(
    'UPDATE orders SET delivery_partner_id = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [delivery_partner_id, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: result.rows[0] });
});

// POST /orders/:id/refund
router.post('/:id/refund', authenticateToken, requireRole('super_admin', 'manager'), async (req, res) => {
  const order = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  if (order.rows[0].payment_status !== 'paid') {
    return res.status(400).json({ error: 'Only paid orders can be refunded' });
  }

  await query(
    `INSERT INTO payments (order_id, amount, method, status, transaction_ref)
     VALUES ($1, $2, $3, 'refunded', $4)`,
    [req.params.id, order.rows[0].total_amount, order.rows[0].payment_method, req.body.transaction_ref || null]
  );

  const result = await query(
    "UPDATE orders SET payment_status = 'refunded', updated_at = now() WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  res.json({ order: result.rows[0] });
});

export default router;
