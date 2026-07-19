import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { pool } from './db/pool.js';
import { swaggerSpec } from './swagger.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import deliveryZoneRoutes from './routes/deliveryZones.js';
import deliveryPartnerRoutes from './routes/deliveryPartners.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Chicken Delivery Admin API Docs',
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check — verifies the server and DB connection are alive
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server and DB are healthy
 *       500:
 *         description: DB connection failed
 */
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', dbTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/products', productRoutes);
app.use('/customers', customerRoutes);
app.use('/delivery-zones', deliveryZoneRoutes);
app.use('/delivery-partners', deliveryPartnerRoutes);
app.use('/orders', orderRoutes);
app.use('/dashboard', dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Basic centralized error handler as a safety net
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🐔 Chicken delivery admin API running on http://localhost:${PORT}`);
});
