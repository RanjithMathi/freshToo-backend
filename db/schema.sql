-- Admin / staff accounts
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'manager', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product categories (Fresh Chicken, Marinated, Frozen, Cut Types, ...)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products (chicken cuts, combos, marinated items, etc.)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_type TEXT NOT NULL DEFAULT 'piece' CHECK (unit_type IN ('piece', 'kg', 'combo')),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers (created via storefront, managed here)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Serviceable delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pincodes TEXT[] NOT NULL DEFAULT '{}',
  delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery riders
CREATE TABLE IF NOT EXISTS delivery_partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  vehicle_type TEXT,
  zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  address_id INTEGER REFERENCES addresses(id),
  delivery_partner_id INTEGER REFERENCES delivery_partners(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')
  ),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (
    payment_status IN ('unpaid', 'paid', 'refunded', 'failed')
  ),
  payment_method TEXT DEFAULT 'cod' CHECK (payment_method IN ('cod', 'card', 'upi', 'wallet')),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  transaction_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);
