import { Router } from 'express';
import { query, pool } from '../db.js';
import { demoPromotions } from '../state.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Promotions: List Active Promotions
router.get('/', auth, async (req, res) => {
  try {
    if (pool) {
      const rows = await query(
        'SELECT * FROM promotions WHERE shop_id = $1 AND active = true ORDER BY created_at DESC',
        [req.user.shop_id],
        req.user
      );
      return res.json({ promotions: rows });
    }

    res.json({ promotions: demoPromotions.filter(p => p.active) });
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
      return res.status(201).json({ promotion: rows[0] });
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
    demoPromotions.push(newPromo);
    res.status(201).json({ promotion: newPromo });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505' ? 'A promotion with this code already exists.' : e.message
    });
  }
});

export default router;
