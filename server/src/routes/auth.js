import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import { demoUsers } from '../state.js';
import { auth, authLimiter, safeUser, sign } from '../middleware/auth.js';

const router = Router();

// Auth Login
router.post('/login', authLimiter, async (req, res) => {
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
router.get('/me', auth, async (req, res) => {
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

export default router;
