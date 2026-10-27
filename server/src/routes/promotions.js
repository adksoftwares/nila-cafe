import { Router } from 'express';
import { query, pool } from '../db.js';
import { demoPromotions } from '../state.js';
import { auth, roles } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = Router();

// Promotions: List Promotions (?all=true for full directory)
router.get('/', auth, async (req, res) => {
  const includeAll = req.query.all === 'true';

  try {
    if (pool) {
      const sql = includeAll
        ? 'SELECT * FROM promotions WHERE shop_id = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM promotions WHERE shop_id = $1 AND active = true ORDER BY created_at DESC';

      const rows = await query(sql, [req.user.shop_id], req.user);
      return res.json({ promotions: rows });
    }

    const list = includeAll ? demoPromotions : demoPromotions.filter(p => p.active);
    res.json({ promotions: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Promotions: Create Promotional Code
router.post('/', auth, roles('owner', 'manager'), async (req, res) => {
  const { code, title, type, value, minOrderAmount = 0 } = req.body;
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanTitle = String(title || '').trim();
  const val = Number(value);
  const minAmt = Math.max(0, Number(minOrderAmount) || 0);

  if (!cleanCode || !cleanTitle || !['percentage', 'fixed'].includes(type) || !Number.isFinite(val) || val <= 0) {
    return res.status(400).json({ error: 'Valid promo code, title, type (percentage/fixed), and positive value required.' });
  }
  if (type === 'percentage' && val > 100) {
    return res.status(400).json({ error: 'Percentage discount cannot exceed 100%.' });
  }

  try {
    if (pool) {
      const rows = await query(
        'INSERT INTO promotions(shop_id, code, title, type, value, min_order_amount) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.user.shop_id, cleanCode, cleanTitle, type, val, minAmt],
        req.user
      );
      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'PROMOTION_CREATE',
        category: 'sales',
        severity: 'info',
        entityType: 'promotion',
        entityId: rows[0].id,
        details: { code: cleanCode, title: cleanTitle, type, value: val, minOrderAmount: minAmt }
      });
      return res.status(201).json({ promotion: rows[0] });
    }

    const existing = demoPromotions.find(p => p.code === cleanCode);
    if (existing) {
      return res.status(409).json({ error: 'A promotion with this code already exists.' });
    }

    const newPromo = {
      id: 'promo-' + Date.now(),
      shop_id: req.user.shop_id,
      code: cleanCode,
      title: cleanTitle,
      type,
      value: val,
      min_order_amount: minAmt,
      active: true,
      created_at: new Date().toISOString()
    };
    demoPromotions.unshift(newPromo);

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'PROMOTION_CREATE',
      category: 'sales',
      severity: 'info',
      entityType: 'promotion',
      entityId: newPromo.id,
      details: { code: cleanCode, title: cleanTitle, type, value: val, minOrderAmount: minAmt }
    });

    res.status(201).json({ promotion: newPromo });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505' ? 'A promotion with this code already exists.' : e.message
    });
  }
});

// Promotions: Toggle Promotion Active Status
router.patch('/:id/status', auth, roles('owner', 'manager'), async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  try {
    if (pool) {
      const rows = await query(
        'UPDATE promotions SET active = $1 WHERE id = $2 AND shop_id = $3 RETURNING *',
        [Boolean(active), id, req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.status(404).json({ error: 'Promotion not found.' });

      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'PROMOTION_TOGGLE',
        category: 'sales',
        severity: 'info',
        entityType: 'promotion',
        entityId: id,
        details: { code: rows[0].code, active: Boolean(active) }
      });

      return res.json({ success: true, promotion: rows[0] });
    }

    const promo = demoPromotions.find(p => p.id === id);
    if (!promo) return res.status(404).json({ error: 'Promotion not found.' });

    promo.active = active !== undefined ? Boolean(active) : !promo.active;

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'PROMOTION_TOGGLE',
      category: 'sales',
      severity: 'info',
      entityType: 'promotion',
      entityId: id,
      details: { code: promo.code, active: promo.active }
    });

    res.json({ success: true, promotion: promo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Promotions: Delete Promotional Code
router.delete('/:id', auth, roles('owner', 'manager'), async (req, res) => {
  const { id } = req.params;

  try {
    if (pool) {
      const rows = await query(
        'DELETE FROM promotions WHERE id = $1 AND shop_id = $2 RETURNING code',
        [id, req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.status(404).json({ error: 'Promotion not found.' });

      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'PROMOTION_DELETE',
        category: 'sales',
        severity: 'warning',
        entityType: 'promotion',
        entityId: id,
        details: { code: rows[0].code }
      });

      return res.json({ success: true, message: 'Promotion deleted.' });
    }

    const idx = demoPromotions.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Promotion not found.' });

    const removed = demoPromotions[idx];
    demoPromotions.splice(idx, 1);

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'PROMOTION_DELETE',
      category: 'sales',
      severity: 'warning',
      entityType: 'promotion',
      entityId: id,
      details: { code: removed.code }
    });

    res.json({ success: true, message: 'Promotion deleted.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
