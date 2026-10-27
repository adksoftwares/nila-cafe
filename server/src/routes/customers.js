import { Router } from 'express';
import { pool, query } from '../db.js';
import { demoCustomers } from '../state.js';
import { auth, roles } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';

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
      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'CUSTOMER_CREATE',
        category: 'sales',
        severity: 'info',
        entityType: 'customer',
        entityId: rows[0].id,
        details: { name: cleanName, phone: cleanPhone }
      });
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

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CUSTOMER_CREATE',
      category: 'sales',
      severity: 'info',
      entityType: 'customer',
      entityId: newCust.id,
      details: { name: cleanName, phone: cleanPhone }
    });

    res.status(201).json({ customer: newCust });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Customers: Manual Loyalty Points Adjustment
router.patch('/:id/points', auth, roles('owner', 'manager'), async (req, res) => {
  const { id } = req.params;
  const { deltaPoints, reason = 'manual_adjustment' } = req.body;
  const delta = parseInt(deltaPoints, 10);

  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: 'Provide a non-zero integer point adjustment.' });
  }

  try {
    if (pool) {
      const rows = await query(
        `UPDATE customers
         SET loyalty_points = GREATEST(0, loyalty_points + $1)
         WHERE id = $2 AND shop_id = $3
         RETURNING *`,
        [delta, id, req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.status(404).json({ error: 'Customer not found.' });

      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'CUSTOMER_POINTS_ADJUST',
        category: 'sales',
        severity: 'warning',
        entityType: 'customer',
        entityId: id,
        details: { customerName: rows[0].name, deltaPoints: delta, newBalance: rows[0].loyalty_points, reason }
      });

      return res.json({ success: true, customer: rows[0] });
    }

    const cust = demoCustomers.find(c => c.id === id);
    if (!cust) return res.status(404).json({ error: 'Customer not found.' });

    cust.loyalty_points = Math.max(0, cust.loyalty_points + delta);

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CUSTOMER_POINTS_ADJUST',
      category: 'sales',
      severity: 'warning',
      entityType: 'customer',
      entityId: id,
      details: { customerName: cust.name, deltaPoints: delta, newBalance: cust.loyalty_points, reason }
    });

    res.json({ success: true, customer: cust });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Customers: Delete Customer
router.delete('/:id', auth, roles('owner', 'manager'), async (req, res) => {
  const { id } = req.params;

  try {
    if (pool) {
      const rows = await query(
        'DELETE FROM customers WHERE id = $1 AND shop_id = $2 RETURNING name',
        [id, req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.status(404).json({ error: 'Customer not found.' });

      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'CUSTOMER_DELETE',
        category: 'sales',
        severity: 'warning',
        entityType: 'customer',
        entityId: id,
        details: { customerName: rows[0].name }
      });

      return res.json({ success: true, message: 'Customer record deleted.' });
    }

    const idx = demoCustomers.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Customer not found.' });

    const removed = demoCustomers[idx];
    demoCustomers.splice(idx, 1);

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CUSTOMER_DELETE',
      category: 'sales',
      severity: 'warning',
      entityType: 'customer',
      entityId: id,
      details: { customerName: removed.name }
    });

    res.json({ success: true, message: 'Customer record deleted.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
