import { Router } from 'express';
import { pool, query } from '../db.js';
import { demoCustomers } from '../state.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Customers: Search & List
router.get('/', auth, async (req, res) => {
  const q = String(req.query.query || '').trim();
  try {
    if (pool) {
      let rows;
      if (q) {
        rows = await query(
          'SELECT * FROM customers WHERE shop_id = $1 AND (name ILIKE $2 OR phone ILIKE $2) ORDER BY total_spent DESC LIMIT 50',
          [req.user.shop_id, `%${q}%`],
          req.user
        );
      } else {
        rows = await query(
          'SELECT * FROM customers WHERE shop_id = $1 ORDER BY total_spent DESC LIMIT 100',
          [req.user.shop_id],
          req.user
        );
      }
      return res.json({ customers: rows });
    }

    let list = demoCustomers;
    if (q) {
      const lower = q.toLowerCase();
      list = demoCustomers.filter(c => c.name.toLowerCase().includes(lower) || c.phone.includes(q));
    }
    res.json({ customers: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Customers: Create New Customer
router.post('/', auth, roles('owner', 'manager', 'cashier'), async (req, res) => {
  const { name, phone, email = '' } = req.body;
  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase() || null;

  if (!cleanName || !cleanPhone) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }

  try {
    if (pool) {
      const existing = await query(
        'SELECT * FROM customers WHERE shop_id = $1 AND phone = $2',
        [req.user.shop_id, cleanPhone],
        req.user
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'A customer with this phone number already exists.', customer: existing[0] });
      }

      const rows = await query(
        'INSERT INTO customers(shop_id, name, phone, email) VALUES($1, $2, $3, $4) RETURNING *',
        [req.user.shop_id, cleanName, cleanPhone, cleanEmail],
        req.user
      );
      return res.status(201).json({ customer: rows[0] });
    }

    const existing = demoCustomers.find(c => c.phone === cleanPhone);
    if (existing) {
      return res.status(409).json({ error: 'A customer with this phone number already exists.', customer: existing });
    }

    const newCust = {
      id: 'cust-' + Date.now(),
      shop_id: req.user.shop_id,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      loyalty_points: 0,
      total_spent: 0,
      total_visits: 0,
      created_at: new Date().toISOString()
    };
    demoCustomers.unshift(newCust);
    res.status(201).json({ customer: newCust });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
