import express from 'express';
import { pool } from '../db.js';
import { demoModifiers } from '../state.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/modifiers
 * Lists modifiers for the authenticated user's shop.
 * Optional query: ?productId=xxx
 */
router.get('/', async (req, res) => {
  try {
    const { productId } = req.query;

    if (!pool) {
      let list = demoModifiers.filter(m => m.active !== false && (!m.shop_id || m.shop_id === req.user.shop_id));
      if (productId) {
        list = list.filter(m => !m.product_id || m.product_id === productId);
      }
      return res.json({ modifiers: list });
    }

    let queryText = 'SELECT * FROM product_modifiers WHERE shop_id = $1 AND active = true';
    const params = [req.user.shop_id];

    if (productId) {
      queryText += ' AND (product_id = $2 OR product_id IS NULL)';
      params.push(productId);
    }

    queryText += ' ORDER BY created_at ASC';
    const rows = (await pool.query(queryText, params)).rows;
    res.json({ modifiers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/modifiers
 * Creates a modifier group for a product (or category/shop)
 */
router.post('/', async (req, res) => {
  try {
    const { productId, name, type = 'single', required = false, options = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Modifier group name is required.' });
    }
    if (!['single', 'multiple'].includes(type)) {
      return res.status(400).json({ error: "Modifier type must be either 'single' or 'multiple'." });
    }
    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'At least one modifier option is required.' });
    }

    // Format and sanitize options
    const formattedOptions = options.map((opt, idx) => ({
      id: opt.id || 'opt-' + Date.now() + '-' + idx,
      name: String(opt.name || '').trim(),
      price: Math.max(0, Math.round(Number(opt.price || 0) * 100) / 100),
      ingredient_id: opt.ingredient_id || null,
      ingredient_qty: Math.max(0, Number(opt.ingredient_qty || 0))
    }));

    if (!pool) {
      const newMod = {
        id: 'mod-' + Date.now(),
        shop_id: req.user.shop_id,
        product_id: productId || null,
        name: name.trim(),
        type,
        required: Boolean(required),
        options: formattedOptions,
        active: true,
        created_at: new Date().toISOString()
      };
      demoModifiers.push(newMod);
      return res.status(201).json({ success: true, modifier: newMod });
    }

    const row = (await pool.query(
      `INSERT INTO product_modifiers(shop_id, product_id, name, type, required, options)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.shop_id, productId || null, name.trim(), type, Boolean(required), JSON.stringify(formattedOptions)]
    )).rows[0];

    res.status(201).json({ success: true, modifier: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/modifiers/:id
 * Updates an existing modifier group
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, required, options, active } = req.body;

    if (!pool) {
      const found = demoModifiers.find(m => m.id === id && m.shop_id === req.user.shop_id);
      if (!found) return res.status(404).json({ error: 'Modifier not found.' });
      if (name) found.name = name.trim();
      if (type) found.type = type;
      if (required !== undefined) found.required = Boolean(required);
      if (active !== undefined) found.active = Boolean(active);
      if (Array.isArray(options)) {
        found.options = options.map((opt, idx) => ({
          id: opt.id || 'opt-' + Date.now() + '-' + idx,
          name: String(opt.name || '').trim(),
          price: Math.max(0, Math.round(Number(opt.price || 0) * 100) / 100),
          ingredient_id: opt.ingredient_id || null,
          ingredient_qty: Math.max(0, Number(opt.ingredient_qty || 0))
        }));
      }
      return res.json({ success: true, modifier: found });
    }

    const existing = (await pool.query(
      'SELECT * FROM product_modifiers WHERE id = $1 AND shop_id = $2',
      [id, req.user.shop_id]
    )).rows[0];

    if (!existing) {
      return res.status(404).json({ error: 'Modifier not found.' });
    }

    const updated = (await pool.query(
      `UPDATE product_modifiers 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           required = COALESCE($3, required),
           options = COALESCE($4, options),
           active = COALESCE($5, active)
       WHERE id = $6 AND shop_id = $7
       RETURNING *`,
      [
        name ? name.trim() : null,
        type || null,
        required !== undefined ? Boolean(required) : null,
        Array.isArray(options) ? JSON.stringify(options) : null,
        active !== undefined ? Boolean(active) : null,
        id,
        req.user.shop_id
      ]
    )).rows[0];

    res.json({ success: true, modifier: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/modifiers/:id
 * Soft deletes / removes modifier group
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!pool) {
      const idx = demoModifiers.findIndex(m => m.id === id && m.shop_id === req.user.shop_id);
      if (idx === -1) return res.status(404).json({ error: 'Modifier not found.' });
      demoModifiers.splice(idx, 1);
      return res.json({ success: true, message: 'Modifier deleted.' });
    }

    const result = await pool.query(
      'DELETE FROM product_modifiers WHERE id = $1 AND shop_id = $2',
      [id, req.user.shop_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Modifier not found.' });
    }

    res.json({ success: true, message: 'Modifier deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
