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
const demoIdempotencyCache = new Map();
let demoShift = {
  id: 'shift-demo-1',
  shop_id: 'shop-demo',
  user_id: 'u-owner',
  opened_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  closed_at: null,
  opening_float: 5000,
  expected_cash: 5000,
  actual_cash: null,
  difference: null,
  status: 'open',
  notes: 'Morning shift opening float'
};
let demoShiftAdjustments = [];
const kdsClients = new Map();

function broadcastKDS(shopId, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [clientId, client] of kdsClients.entries()) {
    if (client.shopId === shopId || client.isAdmin) {
      try {
        client.res.write(payload);
      } catch {
        kdsClients.delete(clientId);
      }
    }
  }
}

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

async function query(sql, args = [], user = null) {
  if (!pool) throw new Error('Database is not configured');
  if (!user) {
    return (await pool.query(sql, args)).rows;
  }

  // Scoped query with PostgreSQL Row-Level Security (RLS) session parameters
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (user.role === 'admin') {
      await client.query("SELECT set_config('app.is_admin', 'true', true)");
    } else if (user.shop_id) {
      await client.query("SELECT set_config('app.current_shop_id', $1, true)", [user.shop_id]);
    }
    const res = await client.query(sql, args);
    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
        [targetShopId],
        req.user
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
      [targetShopId, code.trim(), name.trim(), category, Number(takeaway_price), Number(normal_price), Number(stock)],
      req.user
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

// ------------------- SHIFT & TILL MANAGEMENT ------------------- //

// Shifts: Get Current Shift Status
app.get('/api/shifts/current', auth, async (req, res) => {
  try {
    if (pool) {
      const rows = await query(
        "SELECT * FROM shifts WHERE shop_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.json({ shift: null, summary: null });
      const shift = rows[0];

      const salesAgg = await query(
        "SELECT COUNT(*)::int AS bills, COALESCE(SUM(total), 0)::float AS cash_sales, COALESCE(SUM(discount), 0)::float AS discounts FROM sales WHERE shift_id = $1",
        [shift.id],
        req.user
      );

      const adjAgg = await query(
        "SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END), 0)::float AS net_adjustments FROM shift_cash_adjustments WHERE shift_id = $1",
        [shift.id],
        req.user
      );

      const cashSales = salesAgg[0]?.cash_sales || 0;
      const bills = salesAgg[0]?.bills || 0;
      const discounts = salesAgg[0]?.discounts || 0;
      const netAdjustments = adjAgg[0]?.net_adjustments || 0;
      const expectedCash = Math.round((Number(shift.opening_float) + cashSales + netAdjustments) * 100) / 100;

      return res.json({
        shift,
        summary: {
          bills,
          cashSales,
          discounts,
          netAdjustments,
          expectedCash,
          openingFloat: Number(shift.opening_float)
        }
      });
    }

    // Demo Mode Shift Status
    if (!demoShift || demoShift.status !== 'open') {
      return res.json({ shift: null, summary: null });
    }
    const cashSales = demoSales.reduce((sum, s) => sum + s.total, 0);
    const discounts = demoSales.reduce((sum, s) => sum + s.discount, 0);
    const netAdjustments = demoShiftAdjustments.reduce((sum, a) => sum + (a.type === 'cash_in' ? a.amount : -a.amount), 0);
    const expectedCash = Math.round((demoShift.opening_float + cashSales + netAdjustments) * 100) / 100;

    res.json({
      shift: demoShift,
      summary: {
        bills: demoSales.length,
        cashSales,
        discounts,
        netAdjustments,
        expectedCash,
        openingFloat: demoShift.opening_float
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shifts: Open Shift (Entering Opening Float)
app.post('/api/shifts/open', auth, roles('owner'), async (req, res) => {
  const { openingFloat = 0, notes = '' } = req.body;
  const floatVal = Math.max(0, Number(openingFloat) || 0);

  try {
    if (pool) {
      const active = await query(
        "SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (active.length > 0) {
        return res.status(400).json({ error: 'A shift is already open. Close it before opening a new one.' });
      }

      const rows = await query(
        "INSERT INTO shifts(shop_id, user_id, opening_float, expected_cash, status, notes) VALUES($1, $2, $3, $4, 'open', $5) RETURNING *",
        [req.user.shop_id, req.user.sub, floatVal, floatVal, String(notes || '').trim()],
        req.user
      );
      return res.status(201).json({ shift: rows[0] });
    }

    if (demoShift && demoShift.status === 'open') {
      return res.status(400).json({ error: 'A shift is already open.' });
    }

    demoShift = {
      id: 'shift-demo-' + Date.now(),
      shop_id: req.user.shop_id,
      user_id: req.user.sub,
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_float: floatVal,
      expected_cash: floatVal,
      actual_cash: null,
      difference: null,
      status: 'open',
      notes: String(notes || '').trim()
    };
    demoShiftAdjustments = [];
    res.status(201).json({ shift: demoShift });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shifts: Petty Cash In / Out (Adjustments)
app.post('/api/shifts/adjustment', auth, roles('owner'), async (req, res) => {
  const { type, amount, reason } = req.body;
  if (!['cash_in', 'cash_out'].includes(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !reason) {
    return res.status(400).json({ error: 'Provide valid adjustment type, positive amount, and reason.' });
  }

  try {
    if (pool) {
      const active = await query(
        "SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (!active.length) {
        return res.status(400).json({ error: 'No active shift found. Open a shift first.' });
      }

      const rows = await query(
        "INSERT INTO shift_cash_adjustments(shift_id, shop_id, user_id, type, amount, reason) VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
        [active[0].id, req.user.shop_id, req.user.sub, type, Number(amount), reason.trim()],
        req.user
      );
      return res.status(201).json({ adjustment: rows[0] });
    }

    if (!demoShift || demoShift.status !== 'open') {
      return res.status(400).json({ error: 'No active shift in demo mode.' });
    }

    const adj = {
      id: 'adj-' + Date.now(),
      shift_id: demoShift.id,
      type,
      amount: Number(amount),
      reason: reason.trim(),
      created_at: new Date().toISOString()
    };
    demoShiftAdjustments.push(adj);
    res.status(201).json({ adjustment: adj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shifts: Close Shift & Generate Official Z-Report
app.post('/api/shifts/close', auth, roles('owner'), async (req, res) => {
  const { actualCash = 0, notes = '' } = req.body;
  const counted = Math.max(0, Number(actualCash) || 0);

  try {
    if (pool) {
      const active = await query(
        "SELECT * FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (!active.length) {
        return res.status(400).json({ error: 'No open shift to close.' });
      }
      const shift = active[0];

      const salesAgg = await query(
        "SELECT COUNT(*)::int AS bills, COALESCE(SUM(total), 0)::float AS cash_sales, COALESCE(SUM(discount), 0)::float AS discounts FROM sales WHERE shift_id = $1",
        [shift.id],
        req.user
      );

      const adjAgg = await query(
        "SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END), 0)::float AS net_adjustments FROM shift_cash_adjustments WHERE shift_id = $1",
        [shift.id],
        req.user
      );

      const cashSales = salesAgg[0]?.cash_sales || 0;
      const bills = salesAgg[0]?.bills || 0;
      const discounts = salesAgg[0]?.discounts || 0;
      const netAdjustments = adjAgg[0]?.net_adjustments || 0;
      const expectedCash = Math.round((Number(shift.opening_float) + cashSales + netAdjustments) * 100) / 100;
      const difference = Math.round((counted - expectedCash) * 100) / 100;

      const updated = (await query(
        "UPDATE shifts SET closed_at = NOW(), actual_cash = $1, expected_cash = $2, difference = $3, status = 'closed', notes = $4 WHERE id = $5 RETURNING *",
        [counted, expectedCash, difference, String(notes || '').trim(), shift.id],
        req.user
      ))[0];

      const zReport = {
        zReportNumber: 'Z-' + Date.now().toString().slice(-6),
        shiftId: shift.id,
        openedAt: shift.opened_at,
        closedAt: updated.closed_at,
        cashier: req.user.name,
        openingFloat: Number(shift.opening_float),
        cashSales,
        discountsGiven: discounts,
        netAdjustments,
        expectedCash,
        actualCountedCash: counted,
        variance: difference,
        billsCount: bills
      };

      return res.json({ shift: updated, zReport });
    }

    // Demo Mode Z-Report
    if (!demoShift || demoShift.status !== 'open') {
      return res.status(400).json({ error: 'No open shift to close.' });
    }

    const cashSales = demoSales.reduce((sum, s) => sum + s.total, 0);
    const discounts = demoSales.reduce((sum, s) => sum + s.discount, 0);
    const netAdjustments = demoShiftAdjustments.reduce((sum, a) => sum + (a.type === 'cash_in' ? a.amount : -a.amount), 0);
    const expectedCash = Math.round((demoShift.opening_float + cashSales + netAdjustments) * 100) / 100;
    const difference = Math.round((counted - expectedCash) * 100) / 100;

    demoShift = {
      ...demoShift,
      closed_at: new Date().toISOString(),
      actual_cash: counted,
      expected_cash: expectedCash,
      difference,
      status: 'closed',
      notes: String(notes || '').trim()
    };

    const zReport = {
      zReportNumber: 'Z-' + Date.now().toString().slice(-6),
      shiftId: demoShift.id,
      openedAt: demoShift.opened_at,
      closedAt: demoShift.closed_at,
      cashier: req.user.name || 'Demo Cashier',
      openingFloat: demoShift.opening_float,
      cashSales,
      discountsGiven: discounts,
      netAdjustments,
      expectedCash,
      actualCountedCash: counted,
      variance: difference,
      billsCount: demoSales.length
    };

    res.json({ shift: demoShift, zReport });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------- REAL-TIME KITCHEN DISPLAY SYSTEM (KDS) ------------------- //

// KDS: Real-time Server-Sent Events (SSE) Stream
app.get('/api/kds/stream', (req, res) => {
  const token = req.query.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  let user = null;
  try {
    user = token ? jwt.verify(token, JWT_SECRET) : { role: 'owner', shop_id: 'shop-demo' };
  } catch {
    return res.status(401).json({ error: 'Authentication token required for KDS stream.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = crypto.randomUUID();
  kdsClients.set(clientId, {
    res,
    shopId: user.shop_id,
    isAdmin: user.role === 'admin'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected', shopId: user.shop_id })}\n\n`);

  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    kdsClients.delete(clientId);
  });
});

// KDS: Get Active Kitchen Orders (pending, preparing, ready)
app.get('/api/kds/orders', auth, async (req, res) => {
  try {
    if (pool) {
      const sales = await query(
        `SELECT s.id, s.bill_number, s.order_type, s.table_number, s.kitchen_status, s.created_at,
          COALESCE(json_agg(json_build_object(
            'id', si.id,
            'name', si.product_name,
            'code', si.product_code,
            'qty', si.quantity,
            'notes', si.notes
          )) FILTER (WHERE si.id IS NOT NULL), '[]') AS items
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.shop_id = $1 AND s.kitchen_status != 'served'
        GROUP BY s.id
        ORDER BY s.created_at ASC`,
        [req.user.shop_id],
        req.user
      );
      return res.json({ orders: sales });
    }

    // Demo Mode Orders
    const active = demoSales
      .filter(s => s.kitchen_status !== 'served')
      .map(s => ({
        id: s.id,
        bill_number: s.bill_number,
        order_type: s.order_type,
        table_number: s.table_number,
        kitchen_status: s.kitchen_status || 'pending',
        created_at: s.created_at,
        items: s.items || []
      }));
    res.json({ orders: active });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// KDS: Update Kitchen Order Status (preparing -> ready -> served)
app.patch('/api/kds/orders/:id/status', auth, roles('owner'), async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  if (!['pending', 'preparing', 'ready', 'served'].includes(status)) {
    return res.status(400).json({ error: 'Status must be pending, preparing, ready, or served.' });
  }

  try {
    if (pool) {
      const updated = await query(
        'UPDATE sales SET kitchen_status = $1 WHERE id = $2 AND shop_id = $3 RETURNING id, bill_number, kitchen_status',
        [status, orderId, req.user.shop_id],
        req.user
      );
      if (!updated.length) return res.status(404).json({ error: 'Order not found.' });

      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: status
      });
      return res.json({ success: true, order: updated[0] });
    }

    const order = demoSales.find(s => String(s.id) === String(orderId));
    if (order) {
      order.kitchen_status = status;
      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: status
      });
      return res.json({ success: true, order });
    }
    res.status(404).json({ error: 'Order not found.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sales: Checkout & Inventory Management (Deadlock-Free Batch Query, Idempotent, Multi-Payment & Split Bill)
app.post('/api/sales', auth, roles('owner'), async (req, res) => {
  const {
    orderType,
    tableNumber = null,
    items = [],
    discount = 0,
    payments = null, // Array of { method: 'cash'|'card'|'qr', amount, reference }
    paymentMethod = 'cash',
    amountReceived = 0
  } = req.body;

  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

  if (!['takeaway', 'delivery', 'dining'].includes(orderType) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Choose an order type and at least one product.' });
  }

  // Idempotency check: Return existing result if duplicate request is received
  if (idempotencyKey) {
    if (pool) {
      try {
        const existing = await query(
          'SELECT response_code, response_body FROM idempotency_keys WHERE shop_id = $1 AND key = $2',
          [req.user.shop_id, idempotencyKey]
        );
        if (existing.length > 0) {
          return res.status(existing[0].response_code).json(existing[0].response_body);
        }
      } catch (err) {
        console.error('Idempotency lookup warning:', err.message);
      }
    } else {
      const cacheKey = `${req.user.shop_id}:${idempotencyKey}`;
      if (demoIdempotencyCache.has(cacheKey)) {
        const cached = demoIdempotencyCache.get(cacheKey);
        return res.status(cached.code).json(cached.body);
      }
    }
  }

  if (!pool) {
    return res.status(501).json({ error: 'Saving sales requires PostgreSQL. The demo screen does not save sales.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enforce PostgreSQL Row-Level Security tenant parameter
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [req.user.shop_id]);

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

    // Step 4: Validate and prepare payments (Single, Mixed Tender, or Split Bill)
    let paymentList = [];
    if (Array.isArray(payments) && payments.length > 0) {
      let paidSum = 0;
      for (const pay of payments) {
        const amt = Math.round(Number(pay.amount) * 100) / 100;
        const method = String(pay.method || 'cash').toLowerCase();
        if (!['cash', 'card', 'qr'].includes(method) || amt <= 0) {
          throw new Error('Invalid payment method or amount.');
        }
        paidSum = Math.round((paidSum + amt) * 100) / 100;
        paymentList.push({
          method,
          amount: amt,
          reference: pay.reference ? String(pay.reference).trim() : null
        });
      }
      if (paidSum < total - 0.05) {
        throw new Error(`Total payments (LKR ${paidSum}) do not cover the bill total (LKR ${total}).`);
      }
    } else {
      paymentList.push({
        method: ['cash', 'card', 'qr'].includes(paymentMethod) ? paymentMethod : 'cash',
        amount: total,
        reference: null
      });
    }

    const primaryPaymentMethod = paymentList.length === 1 ? paymentList[0].method : 'mixed';
    const totalCashAmount = paymentList
      .filter(p => p.method === 'cash')
      .reduce((sum, p) => sum + p.amount, 0);

    // Generate Bill Number
    const bill = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    // Query active shift if any
    let activeShiftId = null;
    const shiftRow = (await client.query(
      "SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
      [req.user.shop_id]
    )).rows;
    if (shiftRow.length) activeShiftId = shiftRow[0].id;

    // Insert Sale record
    const sale = (await client.query(
      'INSERT INTO sales(shop_id, user_id, shift_id, bill_number, order_type, table_number, subtotal, discount, total, payment_method, amount_received) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [
        req.user.shop_id,
        req.user.sub,
        activeShiftId,
        bill,
        orderType,
        orderType === 'dining' ? (tableNumber || 'Table 1') : null,
        subtotal,
        billDiscount,
        total,
        primaryPaymentMethod,
        Number(amountReceived) || totalCashAmount || total
      ]
    )).rows[0];

    // Insert individual payments breakdown (for multi-tender & split bills)
    const recordedPayments = [];
    for (const p of paymentList) {
      const pRow = (await client.query(
        'INSERT INTO sale_payments(sale_id, shop_id, payment_method, amount, reference) VALUES($1, $2, $3, $4, $5) RETURNING *',
        [sale.id, req.user.shop_id, p.method, p.amount, p.reference]
      )).rows[0];
      recordedPayments.push(pRow);
    }

    // Insert sale items, audit stock movement ledger, and update database stock
    for (const l of lines) {
      await client.query(
        'INSERT INTO sale_items(sale_id, product_id, product_code, product_name, quantity, unit_price, discount, notes, line_total) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [sale.id, l.p.id, l.p.code, l.p.name, l.q, l.price, l.lineDiscount, l.notes, l.total]
      );

      // Double-entry stock ledger
      await client.query(
        'INSERT INTO stock_movements(shop_id, product_id, delta_qty, reason, reference_id) VALUES($1, $2, $3, $4, $5)',
        [req.user.shop_id, l.p.id, -l.q, 'sale', sale.bill_number]
      );

      // Decrement current stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [l.q, l.p.id]
      );
    }

    const responsePayload = {
      sale,
      items: lines.map(l => ({
        name: l.p.name,
        code: l.p.code,
        quantity: l.q,
        price: l.price,
        discount: l.lineDiscount,
        notes: l.notes,
        total: l.total
      })),
      payments: recordedPayments.map(p => ({
        method: p.payment_method,
        amount: Number(p.amount),
        reference: p.reference
      }))
    };

    // Store Idempotency key atomically within transaction
    if (idempotencyKey) {
      await client.query(
        'INSERT INTO idempotency_keys(key, shop_id, response_code, response_body) VALUES($1, $2, $3, $4) ON CONFLICT (shop_id, key) DO NOTHING',
        [idempotencyKey, req.user.shop_id, 201, JSON.stringify(responsePayload)]
      );
    }

    await client.query('COMMIT');

    // Broadcast new order to connected Kitchen Display System (KDS) screens
    broadcastKDS(req.user.shop_id, 'order:new', {
      id: sale.id,
      bill_number: sale.bill_number,
      order_type: sale.order_type,
      table_number: sale.table_number,
      kitchen_status: 'pending',
      created_at: sale.created_at,
      items: lines.map(l => ({
        name: l.p.name,
        code: l.p.code,
        qty: l.q,
        notes: l.notes
      }))
    });

    res.status(201).json(responsePayload);
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
