import { Router } from 'express';
import { pool, query } from '../db.js';
import { demoProducts } from '../state.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Products: List
router.get('/', auth, async (req, res) => {
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

// Products: Create
router.post('/', auth, roles('owner', 'admin', 'manager'), async (req, res) => {
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

export default router;
