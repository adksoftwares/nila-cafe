CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS shops (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 phone TEXT, address TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
 name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','owner')), active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK ((role='admin' AND shop_id IS NULL) OR (role='owner' AND shop_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 code TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'General',
 takeaway_price NUMERIC(12,2) NOT NULL CHECK(takeaway_price>=0), normal_price NUMERIC(12,2) NOT NULL CHECK(normal_price>=0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(shop_id,code)
);
CREATE TABLE IF NOT EXISTS sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shop_id UUID NOT NULL REFERENCES shops(id), user_id UUID NOT NULL REFERENCES users(id),
 bill_number TEXT NOT NULL, order_type TEXT NOT NULL CHECK(order_type IN ('takeaway','delivery','dining')),
 table_number TEXT,
 subtotal NUMERIC(12,2) NOT NULL, discount NUMERIC(12,2) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL,
 payment_method TEXT NOT NULL DEFAULT 'cash', amount_received NUMERIC(12,2) NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(shop_id,bill_number)
);
CREATE TABLE IF NOT EXISTS sale_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), product_code TEXT NOT NULL, product_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0), unit_price NUMERIC(12,2) NOT NULL, discount NUMERIC(12,2) NOT NULL DEFAULT 0,
 notes TEXT, line_total NUMERIC(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 shop_id UUID REFERENCES shops(id) ON DELETE SET NULL, action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop_created ON sales(shop_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_shop ON users(shop_id);
