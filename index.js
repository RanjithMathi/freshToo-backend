import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Raw OpenAPI spec, used by the docs page below (and importable into Postman etc.)
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Swagger UI, loaded from a CDN rather than bundled static assets.
// This avoids "Unexpected token '<'" errors that show up when a reverse proxy
// or platform catch-all route intercepts requests for the bundled JS files
// and returns an HTML page instead.
app.get(['/api-docs', '/api-docs/'], (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html>
<head>
  <title>Chicken Delivery Admin API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api-docs.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
      });
    };
  </script>
</body>
</html>`);
});

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
