CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','owner','manager','cashier','waiter')),
  manager_pin_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((role='admin' AND shop_id IS NULL) OR (role IN ('owner','manager','cashier','waiter') AND shop_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  takeaway_price NUMERIC(12,2) NOT NULL CHECK(takeaway_price >= 0),
  normal_price NUMERIC(12,2) NOT NULL CHECK(normal_price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, code)
);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL CHECK(status IN ('open', 'closed')) DEFAULT 'open',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS shift_cash_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('cash_in', 'cash_out')),
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  user_id UUID NOT NULL REFERENCES users(id),
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  bill_number TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK(order_type IN ('takeaway','delivery','dining')),
  table_number TEXT,
  kitchen_status TEXT NOT NULL DEFAULT 'pending' CHECK(kitchen_status IN ('pending', 'preparing', 'ready', 'served', 'voided')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'voided')),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  void_authorized_by UUID REFERENCES users(id),
  subtotal NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  amount_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, bill_number)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  line_total NUMERIC(12,2) NOT NULL
);

-- Multi-tender Payments (Cash, Card, QR, Mixed Tender, Split Bills)
CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'qr')),
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency Keys table to prevent duplicate billing & race conditions
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  response_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shop_id, key)
);

-- Double-Entry Inventory Movement Ledger
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta_qty INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK(reason IN ('sale', 'restock', 'waste', 'spoilage', 'audit_correction', 'void_restock')),
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop_created ON sales(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop ON stock_movements(shop_id, created_at DESC);


-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR BULLETPROOF TENANT ISOLATION
-- ==============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Enforce RLS on table owner as well to avoid accidental bypass
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE sales FORCE ROW LEVEL SECURITY;
ALTER TABLE sale_items FORCE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;

-- Products Policy
DROP POLICY IF EXISTS products_tenant_isolation ON products;
CREATE POLICY products_tenant_isolation ON products
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );

-- Sales Policy
DROP POLICY IF EXISTS sales_tenant_isolation ON sales;
CREATE POLICY sales_tenant_isolation ON sales
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );

-- Sale Items Policy (Cascaded via Sales)
DROP POLICY IF EXISTS sale_items_tenant_isolation ON sale_items;
CREATE POLICY sale_items_tenant_isolation ON sale_items
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
      AND s.shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
      AND s.shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
    )
  );

-- Idempotency Keys Policy
DROP POLICY IF EXISTS idempotency_keys_tenant_isolation ON idempotency_keys;
CREATE POLICY idempotency_keys_tenant_isolation ON idempotency_keys
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );

-- Stock Movements Policy
DROP POLICY IF EXISTS stock_movements_tenant_isolation ON stock_movements;
CREATE POLICY stock_movements_tenant_isolation ON stock_movements
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );


ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shifts_tenant_isolation ON shifts;
CREATE POLICY shifts_tenant_isolation ON shifts
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );

ALTER TABLE shift_cash_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_cash_adjustments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shift_adjustments_tenant_isolation ON shift_cash_adjustments;
CREATE POLICY shift_adjustments_tenant_isolation ON shift_cash_adjustments
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );


ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sale_payments_tenant_isolation ON sale_payments;
CREATE POLICY sale_payments_tenant_isolation ON sale_payments
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR ALL
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR shop_id = NULLIF(current_setting('app.current_shop_id', true), '')::uuid
  );
