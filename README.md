# Chicken Delivery — Admin Backend

Express + Neon Postgres admin API: staff accounts with roles, products/categories,
customers, delivery zones & riders, orders with stock-aware transactions, and a
dashboard summary.

## Setup

```bash
npm install
```

`.env` is pre-filled with your Neon connection string. Before deploying anywhere real:
- Replace `JWT_SECRET` with a long random value (`openssl rand -hex 64`)
- Rotate the Neon DB password if it's ever been shared/pasted anywhere

Create the schema:

```bash
npm run db:init
```

Create your first super admin (only way in — there's no open self-registration):

```bash
# optional: override defaults via env vars first
# SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run db:seed
npm run db:seed
```

Start the server:

```bash
npm start
```

Log in with the seeded account at `POST /auth/login`, then use the returned
token (`Authorization: Bearer <token>`) to create other staff via `POST /auth/staff`.

## Roles

- **super_admin** — full access, including deleting records and managing other admins
- **manager** — create/update products, categories, orders, customers, riders; cannot delete or manage super admins
- **staff** — day-to-day ops: update stock, take manual orders, update order status

## Endpoints

### Auth (`/auth`)
| Method | Path | Access |
|---|---|---|
| POST | `/auth/login` | public |
| GET | `/auth/me` | any admin |
| POST | `/auth/staff` | super_admin, manager |
| GET | `/auth/staff` | super_admin, manager |
| PUT | `/auth/staff/:id/status` | super_admin |

### Categories (`/categories`)
CRUD — GET is any admin, write is manager+, delete is super_admin only.

### Products (`/products`)
- `GET /products` — filter by `category_id`, `is_active`, `search`
- `GET /products/low-stock`
- `GET /products/:id`
- `POST /products`, `PUT /products/:id` — manager+
- `PUT /products/:id/stock` — body `{ stock_quantity }` or `{ adjust_by }` — staff+
- `DELETE /products/:id` — super_admin

### Customers (`/customers`)
- `GET /customers` — filter by `search`, `status`
- `GET /customers/:id`
- `GET /customers/:id/orders`
- `GET /customers/:id/addresses`
- `PUT /customers/:id/status` — block/unblock, manager+

### Delivery zones (`/delivery-zones`)
CRUD, `pincodes` is a text array, `delivery_charge` used to compute order totals.

### Delivery partners (`/delivery-partners`)
- `GET /delivery-partners` — filter by `zone_id`, `is_available`
- `GET /delivery-partners/:id/orders` — current (non-final) assignments
- `POST /delivery-partners`, `PUT /delivery-partners/:id` — manager+
- `PUT /delivery-partners/:id/availability` — any admin
- `DELETE /delivery-partners/:id` — super_admin

### Orders (`/orders`)
- `GET /orders` — filter by `status`, `customer_id`, `from`, `to`
- `GET /orders/:id` — includes line items
- `POST /orders` — manual order creation (e.g. phone orders). Body:
  ```json
  {
    "customer_id": 1,
    "address_id": 2,
    "delivery_zone_id": 1,
    "payment_method": "cod",
    "items": [{ "product_id": 3, "quantity": 2 }]
  }
  ```
  Runs in a DB transaction: locks each product row, checks stock, decrements it,
  and computes subtotal/delivery charge/total.
- `PUT /orders/:id/status` — one of `pending, confirmed, preparing, out_for_delivery, delivered, cancelled`.
  Cancelling an order that wasn't already delivered/cancelled restocks its items automatically.
- `PUT /orders/:id/assign-delivery` — body `{ delivery_partner_id }`
- `POST /orders/:id/refund` — only for orders with `payment_status = 'paid'`

### Dashboard (`/dashboard`)
- `GET /dashboard/summary` — today's orders/revenue, active riders, pending orders, low-stock count, status breakdown
- `GET /dashboard/reports/sales?from=&to=` — daily order count + revenue
- `GET /dashboard/reports/top-products?limit=10`

## Not included yet (flagged for later)

These were in the original API list but need more product decisions before
building (payment gateway choice, storage for images, whether customers get
their own login, notification provider):

- Coupons/offers
- Payment gateway webhook + reconciliation
- Supplier / purchase order tracking
- Push/SMS notifications
- File upload endpoint for product images (currently just takes an `image_url` string)
- Customer-facing auth (this backend is admin-only; customers are currently
  created/managed by admins, not self-registering)

Happy to build any of these out next — let me know which matters most for your MVP.
