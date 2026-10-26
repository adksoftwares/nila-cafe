import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';
import { demoShops } from '../state.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Admin: Get Shops
router.get('/shops', auth, roles('admin'), async (req, res) => {
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
router.post('/shops', auth, roles('admin'), async (req, res) => {
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

export default router;
