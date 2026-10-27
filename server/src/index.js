import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { pool, demoMode } from './db.js';
import { apiLimiter, JWT_SECRET } from './middleware/auth.js';
import { logger, httpLogger } from './utils/logger.js';

import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import shiftsRouter from './routes/shifts.js';
import kdsRouter from './routes/kds.js';
import customersRouter from './routes/customers.js';
import promotionsRouter from './routes/promotions.js';
import reportsRouter from './routes/reports.js';
import adminRouter from './routes/admin.js';
import salesRouter from './routes/sales.js';
import shopsRouter from './routes/shops.js';
import ingredientsRouter from './routes/ingredients.js';
import printerRouter from './routes/printer.js';
import tablesRouter from './routes/tables.js';
import modifiersRouter from './routes/modifiers.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Fail fast in production if default secret is used
if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET === 'dev-only-change-me')) {
  console.error('FATAL: A secure JWT_SECRET must be configured in production!');
  process.exit(1);
}

// Security headers & Rate limiting
app.use(helmet());
app.use('/api/', apiLimiter);

// CORS & Body parsing
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(httpLogger);

// ------------------- API ROUTES ------------------- //

// Health Check
app.get('/api/health', async (req, res) => {
  let database = 'demo-mode';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'disconnected';
    }
  }
  res.json({ status: 'ok', database, mode: demoMode ? 'demo' : 'database' });
});

// Domain Routers
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/kds', kdsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/sales', salesRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/printer', printerRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/modifiers', modifiersRouter);

// 404 Route
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Start server if executed directly
let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`POS API listening on http://localhost:${PORT} (${demoMode ? 'demo mode' : 'PostgreSQL mode'})`);
  });
}

export { app, server };
export default app;
