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
    const newProduct = {
      id: 'p' + Date.now(),
      code: code.trim(),
      name: name.trim(),
      category: category ? category.trim() : 'General',
      takeaway_price: Number(takeaway_price),
      normal_price: Number(normal_price),
      stock: Number(stock),
      active: true
    };
    demoProducts.unshift(newProduct);
    return res.status(201).json({ product: newProduct });
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

// Products: Update / Edit
router.put('/:id', auth, roles('owner', 'admin', 'manager'), async (req, res) => {
  const { id } = req.params;
  const { code, name, category, takeaway_price, normal_price, stock, active } = req.body;

  if (!pool) {
    const idx = demoProducts.findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    demoProducts[idx] = {
      ...demoProducts[idx],
      ...(code !== undefined && { code: code.trim() }),
      ...(name !== undefined && { name: name.trim() }),
      ...(category !== undefined && { category: category.trim() }),
      ...(takeaway_price !== undefined && { takeaway_price: Number(takeaway_price) }),
      ...(normal_price !== undefined && { normal_price: Number(normal_price) }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(active !== undefined && { active: Boolean(active) })
    };
    return res.json({ product: demoProducts[idx] });
  }

  try {
    const rows = await query(
      `UPDATE products
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           category = COALESCE($3, category),
           takeaway_price = COALESCE($4, takeaway_price),
           normal_price = COALESCE($5, normal_price),
           stock = COALESCE($6, stock),
           active = COALESCE($7, active)
       WHERE id = $8
       RETURNING *`,
      [
        code ? code.trim() : null,
        name ? name.trim() : null,
        category ? category.trim() : null,
        takeaway_price !== undefined ? Number(takeaway_price) : null,
        normal_price !== undefined ? Number(normal_price) : null,
        stock !== undefined ? Number(stock) : null,
        active !== undefined ? Boolean(active) : null,
        id
      ],
      req.user
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ product: rows[0] });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505' ? 'That product code already exists for this shop.' : 'Could not update product.'
    });
  }
});

// Products: Delete (Soft Delete or Purge)
router.delete('/:id', auth, roles('owner', 'admin', 'manager'), async (req, res) => {
  const { id } = req.params;

  if (!pool) {
    const idx = demoProducts.findIndex(p => p.id === id);
    if (idx !== -1) {
      demoProducts.splice(idx, 1);
    }
    return res.json({ success: true, message: 'Product deleted successfully.' });
  }

  try {
    try {
      await query('DELETE FROM products WHERE id = $1', [id], req.user);
    } catch {
      // If linked by foreign keys in sales/orders, soft-delete by deactivating
      await query('UPDATE products SET active = FALSE WHERE id = $1', [id], req.user);
    }
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Could not delete product.' });
  }
});

export default router;
