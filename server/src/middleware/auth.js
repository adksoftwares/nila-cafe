import 'dotenv/config';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

// Fail fast in production if default secret is used
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-only-change-me')) {
  console.error('FATAL: A secure JWT_SECRET must be configured in production!');
  process.exit(1);
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

export const safeUser = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  shop_id: u.shop_id,
  active: u.active
});

export function sign(u) {
  return jwt.sign(
    { sub: u.id, role: u.role, shop_id: u.shop_id },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    if (!h.startsWith('Bearer ')) throw Error();
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
}

export function roles(...r) {
  return (req, res, next) => {
    if (r.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'You do not have permission to do this.' });
  };
}
