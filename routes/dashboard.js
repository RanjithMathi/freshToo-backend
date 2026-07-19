import { Router } from 'express';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     summary: Today's key metrics — orders, revenue, active riders, pending orders, low stock
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 today_orders: { type: integer }
 *                 today_revenue: { type: number }
 *                 active_riders: { type: integer }
 *                 pending_orders: { type: integer }
 *                 low_stock_products: { type: integer }
 *                 status_breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status: { type: string }
 *                       count: { type: integer }
 */
router.get('/summary', authenticateToken, async (req, res) => {
  const [todayOrders, todayRevenue, activeRiders, pendingOrders, lowStock] = await Promise.all([
    query(`SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE`),
    query(`SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders
           WHERE created_at::date = CURRENT_DATE AND status != 'cancelled'`),
    query(`SELECT COUNT(*) FROM delivery_partners WHERE is_available = true AND is_active = true`),
    query(`SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'confirmed', 'preparing')`),
    query(`SELECT COUNT(*) FROM products WHERE stock_quantity <= low_stock_threshold AND is_active = true`),
  ]);

  const statusBreakdown = await query(`
    SELECT status, COUNT(*) AS count FROM orders
    WHERE created_at::date = CURRENT_DATE
    GROUP BY status
  `);

  res.json({
    today_orders: Number(todayOrders.rows[0].count),
    today_revenue: Number(todayRevenue.rows[0].revenue),
    active_riders: Number(activeRiders.rows[0].count),
    pending_orders: Number(pendingOrders.rows[0].count),
    low_stock_products: Number(lowStock.rows[0].count),
    status_breakdown: statusBreakdown.rows,
  });
});

/**
 * @openapi
 * /dashboard/reports/sales:
 *   get:
 *     summary: Daily order count and revenue over a date range
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Daily sales breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sales:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day: { type: string, format: date }
 *                       orders: { type: integer }
 *                       revenue: { type: number }
 */
router.get('/reports/sales', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const conditions = ["status != 'cancelled'"];

  if (from) {
    params.push(from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`created_at <= $${params.length}`);
  }

  const result = await query(
    `SELECT created_at::date AS day, COUNT(*) AS orders, SUM(total_amount) AS revenue
     FROM orders WHERE ${conditions.join(' AND ')}
     GROUP BY day ORDER BY day DESC`,
    params
  );
  res.json({ sales: result.rows });
});

/**
 * @openapi
 * /dashboard/reports/top-products:
 *   get:
 *     summary: Best-selling products by revenue
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Top products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 top_products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       total_quantity: { type: number }
 *                       total_revenue: { type: number }
 */
router.get('/reports/top-products', authenticateToken, async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const result = await query(
    `SELECT p.id, p.name, SUM(oi.quantity) AS total_quantity, SUM(oi.subtotal) AS total_revenue
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.status != 'cancelled'
     GROUP BY p.id, p.name
     ORDER BY total_revenue DESC
     LIMIT $1`,
    [limit]
  );
  res.json({ top_products: result.rows });
});

export default router;
