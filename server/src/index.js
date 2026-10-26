import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

// Fail fast in production if default secret is used
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-change-me')) {
  console.error('FATAL: A secure JWT_SECRET must be configured in production!');
  process.exit(1);
}

// Security headers
app.use(helmet());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

app.use('/api/', apiLimiter);

// CORS and Body Parser
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

const demoProducts = [
  { id: 'p1', code: 'BUR001', name: 'Chicken Burger', category: 'Burgers', takeaway_price: 850, normal_price: 950, stock: 40, active: true },
  { id: 'p2', code: 'PIZ001', name: 'Classic Pizza', category: 'Pizza', takeaway_price: 1500, normal_price: 1650, stock: 18, active: true },
  { id: 'p3', code: 'JUI001', name: 'Fresh Juice', category: 'Drinks', takeaway_price: 350, normal_price: 400, stock: 60, active: true },
  { id: 'p4', code: 'FRI001', name: 'French Fries', category: 'Sides', takeaway_price: 450, normal_price: 500, stock: 35, active: true },
  { id: 'p5', code: 'COF001', name: 'Iced Coffee', category: 'Drinks', takeaway_price: 500, normal_price: 550, stock: 22, active: true },
  { id: 'p6', code: 'SAN001', name: 'Club Sandwich', category: 'Sandwiches', takeaway_price: 700, normal_price: 780, stock: 24, active: true }
];

let demoSales = [];
let demoUsers = [
  { id: 'u-admin', name: 'System Admin', email: 'admin@counterpoint.local', password: 'Admin123!', role: 'admin', shop_id: null, active: true },
  { id: 'u-owner', name: 'Demo Owner', email: 'owner@counterpoint.local', password: 'Owner123!', role: 'owner', shop_id: 'shop-demo', active: true }
];
let demoShops = [
  { id: 'shop-demo', name: 'The Daily Counter', email: 'owner@counterpoint.local', phone: '+94 77 123 4567', address: 'Colombo, Sri Lanka', active: true }
];
const demoMode = !pool;

const safeUser = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  shop_id: u.shop_id,
  active: u.active
});

function sign(u) {
  return jwt.sign(
    { sub: u.id, role: u.role, shop_id: u.shop_id },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    if (!h.startsWith('Bearer ')) throw Error();
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
}

function roles(...r) {
  return (req, res, next) => {
    if (r.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'You do not have permission to do this.' });
  };
}

async function query(sql, args = []) {
  if (!pool) throw new Error('Database is not configured');
  return (await pool.query(sql, args)).rows;
}

// ------------------- API ROUTES ------------------- //

// Health Check
app.get('/api/health', async (req, res) => {
  let database = 'demo-mode';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'disconnected';
    }
  }
  res.json({ status: 'ok', database, mode: demoMode ? 'demo' : 'database' });
});

// Auth Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    let u;
    if (pool) {
      const rows = await query('SELECT * FROM users WHERE lower(email) = lower($1) AND active = true', [email]);
      u = rows[0];
      if (u && !(await bcrypt.compare(password, u.password_hash))) {
        u = null;
      }
    } else {
      u = demoUsers.find(x => x.email.toLowerCase() === email && x.password === password && x.active);
    }

    if (!u) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ token: sign(u), user: safeUser(u) });
  } catch (e) {
    res.status(503).json({
      error: 'Login service unavailable. Check database configuration.',
      detail: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
  }
});

// Auth Current Session
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    let u;
    if (pool) {
      u = (await query('SELECT id, name, email, role, shop_id, active FROM users WHERE id = $1', [req.user.sub]))[0];
    } else {
      u = demoUsers.find(x => x.id === req.user.sub);
    }

    if (!u || !u.active) {
      return res.status(401).json({ error: 'Account is inactive.' });
    }

    res.json({ user: safeUser(u) });
  } catch {
    res.status(503).json({ error: 'Could not verify session.' });
  }
});

// Products: List
app.get('/api/products', auth, async (req, res) => {
  try {
    if (pool) {
      const targetShopId = req.user.role === 'admin' ? (req.query.shopId || null) : req.user.shop_id;

      if (req.user.role === 'admin' && !targetShopId) {
        const rows = await query(
          'SELECT p.*, s.name as shop_name FROM products p JOIN shops s ON s.id = p.shop_id ORDER BY s.name, p.name'
        );
        return res.json({ products: rows });
      }

      const rows = await query(
        'SELECT id, code, name, category, takeaway_price, normal_price, stock, active FROM products WHERE shop_id = $1 ORDER BY name',
        [targetShopId]
      );
      return res.json({ products: rows });
    }

    res.json({ products: demoProducts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Products: Create (Fixes Admin Bug)
app.post('/api/products', auth, roles('owner', 'admin'), async (req, res) => {
  const { code, name, category = 'General', takeaway_price, normal_price, stock = 0 } = req.body;
  const targetShopId = req.user.role === 'admin' ? (req.body.shopId || req.query.shopId) : req.user.shop_id;

  if (!targetShopId) {
    return res.status(400).json({ error: 'shopId is required for admin to create a product.' });
  }

  if (
    !code || !name ||
    !Number.isFinite(Number(takeaway_price)) || !Number.isFinite(Number(normal_price)) ||
    Number(takeaway_price) < 0 || Number(normal_price) < 0 ||
    !Number.isInteger(Number(stock)) || Number(stock) < 0
  ) {
    return res.status(400).json({ error: 'Enter valid product code, name, prices, and stock.' });
  }

  if (!pool) {
    return res.status(501).json({ error: 'Product editing requires PostgreSQL. Start the database and restart the server.' });
  }

  try {
    const rows = await query(
      'INSERT INTO products(shop_id, code, name, category, takeaway_price, normal_price, stock) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [targetShopId, code.trim(), name.trim(), category, Number(takeaway_price), Number(normal_price), Number(stock)]
    );
    res.status(201).json({ product: rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505' ? 'That product code already exists for this shop.' : 'Could not save product.'
    });
  }
});

// Reports: Summary
app.get('/api/reports/summary', auth, async (req, res) => {
  try {
    const targetShopId = req.user.role === 'admin' ? (req.query.shopId || null) : req.user.shop_id;

    if (pool) {
      if (req.user.role === 'admin' && !targetShopId) {
        const rows = await query(`
          SELECT 
            COUNT(*)::int AS bills,
            COALESCE(SUM(total), 0)::float AS sales,
            COALESCE(SUM(discount), 0)::float AS discounts 
          FROM sales 
          WHERE created_at >= date_trunc('day', NOW())
        `);
        const p = await query('SELECT COUNT(*)::int AS products FROM products WHERE active = true');
        return res.json({ ...rows[0], products: p[0].products });
      }

      const rows = await query(`
        SELECT 
          COUNT(*)::int AS bills,
          COALESCE(SUM(total), 0)::float AS sales,
          COALESCE(SUM(discount), 0)::float AS discounts 
        FROM sales 
        WHERE shop_id = $1 AND created_at >= date_trunc('day', NOW())
      `, [targetShopId]);

      const p = await query('SELECT COUNT(*)::int AS products FROM products WHERE shop_id = $1 AND active = true', [targetShopId]);
      return res.json({ ...rows[0], products: p[0].products });
    }

    res.json({
      bills: demoSales.length,
      sales: demoSales.reduce((s, x) => s + x.total, 0),
      discounts: demoSales.reduce((s, x) => s + x.discount, 0),
      products: demoProducts.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Get Shops
app.get('/api/admin/shops', auth, roles('admin'), async (req, res) => {
  try {
    if (pool) {
      return res.json({
        shops: await query('SELECT s.*, COUNT(u.id)::int AS owners FROM shops s LEFT JOIN users u ON u.shop_id = s.id GROUP BY s.id ORDER BY s.created_at DESC')
      });
    }
    res.json({ shops: demoShops });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: Create Shop
app.post('/api/admin/shops', auth, roles('admin'), async (req, res) => {
  const { name, email, password, ownerName, phone = '', address = '' } = req.body;

  if (!name || !email || !password || !ownerName || password.length < 8) {
    return res.status(400).json({ error: 'Shop, owner name, email, and password (8+ characters) are required.' });
  }

  if (!pool) {
    return res.status(501).json({ error: 'Creating accounts requires PostgreSQL. Configure the database first.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shop = (await client.query(
      'INSERT INTO shops(name, email, phone, address) VALUES($1, $2, $3, $4) RETURNING *',
      [name, email.toLowerCase(), phone, address]
    )).rows[0];

    const hash = await bcrypt.hash(password, 12);
    const user = (await client.query(
      "INSERT INTO users(shop_id, name, email, password_hash, role) VALUES($1, $2, $3, $4, 'owner') RETURNING id, name, email, role, shop_id, active",
      [shop.id, ownerName, email.toLowerCase(), hash]
    )).rows[0];

    await client.query('COMMIT');
    res.status(201).json({ shop, user });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505' ? 'Email already exists.' : 'Could not create shop.'
    });
  } finally {
    client.release();
  }
});

// Sales: Checkout & Inventory Management (Deadlock-Free Batch Query)
app.post('/api/sales', auth, roles('owner'), async (req, res) => {
  const {
    orderType,
    tableNumber = null,
    items = [],
    discount = 0,
    paymentMethod = 'cash',
    amountReceived = 0
  } = req.body;

  if (!['takeaway', 'delivery', 'dining'].includes(orderType) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Choose an order type and at least one product.' });
  }

  if (!pool) {
    return res.status(501).json({ error: 'Saving sales requires PostgreSQL. The demo screen does not save sales.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Collect & sort unique product IDs to prevent deadlocks across concurrent orders
    const uniqueProductIds = [...new Set(items.map(i => i.productId))].sort();

    // Step 2: Batch query and lock all items in deterministic order
    const lockedProducts = (await client.query(
      'SELECT * FROM products WHERE id = ANY($1::uuid[]) AND shop_id = $2 AND active = true ORDER BY id FOR UPDATE',
      [uniqueProductIds, req.user.shop_id]
    )).rows;

    const productMap = new Map(lockedProducts.map(p => [p.id, p]));

    for (const pid of uniqueProductIds) {
      if (!productMap.has(pid)) {
        throw new Error(`A selected product (ID: ${pid}) was not found or is inactive.`);
      }
    }

    // Step 3: Validate quantities, calculate line items and stock decrement
    let subtotal = 0;
    const lines = [];

    for (const item of items) {
      const q = Number(item.quantity);
      const d = Math.max(0, Number(item.discount) || 0);
      const notes = String(item.notes || '').trim() || null;

      if (!Number.isInteger(q) || q < 1) {
        throw new Error('Quantity must be a positive whole number.');
      }

      const p = productMap.get(item.productId);
      if (p.stock < q) {
        throw new Error(`Insufficient stock for "${p.name}". In stock: ${p.stock}, Requested: ${q}.`);
      }

      p.stock -= q; // Deduct in-memory for multiple items referencing same product

      const price = Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);
      const lineSubtotal = Math.round(price * q * 100) / 100;
      const lineDiscount = Math.round(Math.min(lineSubtotal, d) * 100) / 100;
      const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;

      subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
      lines.push({ p, q, price, lineDiscount, total: lineTotal, notes });
    }

    const billDiscount = Math.round(Math.min(subtotal, Number(discount) || 0) * 100) / 100;
    const total = Math.round(Math.max(0, subtotal - billDiscount) * 100) / 100;

    // Generate Bill Number
    const bill = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    // Insert Sale record
    const sale = (await client.query(
      'INSERT INTO sales(shop_id, user_id, bill_number, order_type, table_number, subtotal, discount, total, payment_method, amount_received) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        req.user.shop_id,
        req.user.sub,
        bill,
        orderType,
        orderType === 'dining' ? (tableNumber || 'Table 1') : null,
        subtotal,
        billDiscount,
        total,
        paymentMethod,
        Number(amountReceived) || 0
      ]
    )).rows[0];

    // Insert sale items and update database stock
    for (const l of lines) {
      await client.query(
        'INSERT INTO sale_items(sale_id, product_id, product_code, product_name, quantity, unit_price, discount, notes, line_total) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [sale.id, l.p.id, l.p.code, l.p.name, l.q, l.price, l.lineDiscount, l.notes, l.total]
      );
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [l.q, l.p.id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      sale,
      items: lines.map(l => ({
        name: l.p.name,
        code: l.p.code,
        quantity: l.q,
        price: l.price,
        discount: l.lineDiscount,
        notes: l.notes,
        total: l.total
      }))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// 404 Route
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Start server
app.listen(PORT, () => {
  console.log(`POS API listening on http://localhost:${PORT} (${demoMode ? 'demo mode' : 'PostgreSQL mode'})`);
});
