import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool, query } from '../db.js';
import { kdsClients, broadcastKDS, demoSales } from '../state.js';
import { auth, roles, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// KDS: Real-time Server-Sent Events (SSE) Stream
router.get('/stream', (req, res) => {
  const token = req.query.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  let user = null;
  try {
    user = token ? jwt.verify(token, JWT_SECRET) : { role: 'owner', shop_id: 'shop-demo' };
  } catch {
    return res.status(401).json({ error: 'Authentication token required for KDS stream.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = crypto.randomUUID();
  kdsClients.set(clientId, {
    res,
    shopId: user.shop_id,
    isAdmin: user.role === 'admin'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected', shopId: user.shop_id })}\n\n`);

  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
    kdsClients.delete(clientId);
  });
});

// KDS: Get Active Kitchen Orders (pending, preparing, ready)
router.get('/orders', auth, async (req, res) => {
  try {
    if (pool) {
      const sales = await query(
        `SELECT s.id, s.bill_number, s.order_type, s.table_number, s.kitchen_status, s.created_at,
          COALESCE(json_agg(json_build_object(
            'id', si.id,
            'name', si.product_name,
            'code', si.product_code,
            'qty', si.quantity,
            'notes', si.notes
          )) FILTER (WHERE si.id IS NOT NULL), '[]') AS items
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.shop_id = $1 AND s.kitchen_status NOT IN ('served', 'voided') AND s.status != 'voided'
        GROUP BY s.id
        ORDER BY s.created_at ASC`,
        [req.user.shop_id],
        req.user
      );
      return res.json({ orders: sales });
    }

    // Demo Mode Orders
    const active = demoSales
      .filter(s => s.kitchen_status !== 'served' && s.kitchen_status !== 'voided' && s.status !== 'voided')
      .map(s => ({
        id: s.id,
        bill_number: s.bill_number,
        order_type: s.order_type,
        table_number: s.table_number,
        kitchen_status: s.kitchen_status || 'pending',
        created_at: s.created_at,
        items: s.items || []
      }));
    res.json({ orders: active });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// KDS: Update Kitchen Order Status (preparing -> ready -> served)
router.patch('/orders/:id/status', auth, roles('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  if (!['pending', 'preparing', 'ready', 'served'].includes(status)) {
    return res.status(400).json({ error: 'Status must be pending, preparing, ready, or served.' });
  }

  try {
    if (pool) {
      const updated = await query(
        'UPDATE sales SET kitchen_status = $1 WHERE id = $2 AND shop_id = $3 RETURNING id, bill_number, kitchen_status',
        [status, orderId, req.user.shop_id],
        req.user
      );
      if (!updated.length) return res.status(404).json({ error: 'Order not found.' });

      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: status
      });
      return res.json({ success: true, order: updated[0] });
    }

    const order = demoSales.find(s => String(s.id) === String(orderId));
    if (order) {
      order.kitchen_status = status;
      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: status
      });
      return res.json({ success: true, order });
    }
    res.status(404).json({ error: 'Order not found.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
