import { Router } from 'express';
import { query, pool } from '../db.js';
import { demoSales, demoProducts } from '../state.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// Reports: Summary
router.get('/summary', auth, async (req, res) => {
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
          WHERE created_at >= date_trunc('day', NOW()) AND status != 'voided'
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
        WHERE shop_id = $1 AND created_at >= date_trunc('day', NOW()) AND status != 'voided'
      `, [targetShopId]);

      const p = await query('SELECT COUNT(*)::int AS products FROM products WHERE shop_id = $1 AND active = true', [targetShopId]);
      return res.json({ ...rows[0], products: p[0].products });
    }

    const validDemoSales = demoSales.filter(s => s.status !== 'voided');
    res.json({
      bills: validDemoSales.length,
      sales: validDemoSales.reduce((s, x) => s + x.total, 0),
      discounts: validDemoSales.reduce((s, x) => s + x.discount, 0),
      products: demoProducts.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
