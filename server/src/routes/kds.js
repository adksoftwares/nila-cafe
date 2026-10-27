import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool, query } from '../db.js';
import { kdsClients, broadcastKDS, demoSales, demoProducts } from '../state.js';
import { auth, roles, JWT_SECRET } from '../middleware/auth.js';
import {
  getItemStation,
  getTicketStation,
  getSLAClassification,
  bumpOrderItem
} from '../utils/kds.js';

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

// Helper: Normalize item data with station & status
function enrichItem(item, idx, orderStatus) {
  const id = item.id || `item-${idx + 1}`;
  const name = item.name || item.product_name || 'Item';
  const code = item.code || item.product_code || 'CODE';
  const qty = item.qty || item.quantity || 1;
  const notes = item.notes || '';
  const modifiers = item.modifiers || [];

  // Match category from demoProducts if not present
  let category = item.category || '';
  if (!category) {
    const matched = demoProducts.find(p => p.code === code || p.name === name);
    if (matched) category = matched.category;
  }

  const station = getItemStation({ ...item, category, name, code });
  const status = item.status || (orderStatus === 'ready' || orderStatus === 'served' ? 'ready' : 'pending');

  return {
    ...item,
    id,
    name,
    code,
    qty,
    quantity: qty,
    notes,
    modifiers,
    category,
    station,
    status
  };
}

// KDS: Get Active Kitchen Orders with station filtering (?station=barista|kitchen|all)
router.get('/orders', auth, async (req, res) => {
  const stationFilter = req.query.station ? String(req.query.station).toLowerCase() : 'all';

  try {
    if (pool) {
      const sales = await query(
        `SELECT s.id, s.bill_number, s.order_type, s.table_number, s.kitchen_status, s.created_at,
          COALESCE(json_agg(json_build_object(
            'id', si.id,
            'name', si.product_name,
            'code', si.product_code,
            'qty', si.quantity,
            'notes', si.notes,
            'modifiers', COALESCE(si.modifiers, '[]'::jsonb),
            'category', p.category,
            'status', COALESCE(si.status, 'pending')
          )) FILTER (WHERE si.id IS NOT NULL), '[]') AS items
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE s.shop_id = $1 AND s.kitchen_status NOT IN ('served', 'voided') AND s.status != 'voided'
        GROUP BY s.id
        ORDER BY s.created_at ASC`,
        [req.user.shop_id],
        req.user
      );

      const enriched = sales.map(s => {
        const items = (s.items || []).map((it, idx) => enrichItem(it, idx, s.kitchen_status));
        return {
          id: s.id,
          bill_number: s.bill_number,
          order_type: s.order_type,
          table_number: s.table_number,
          kitchen_status: s.kitchen_status || 'pending',
          created_at: s.created_at,
          station: getTicketStation(items),
          sla: getSLAClassification(s.created_at),
          items
        };
      });

      const filtered = stationFilter === 'all'
        ? enriched
        : enriched.filter(o => o.items.some(i => i.station === stationFilter));

      return res.json({ orders: filtered });
    }

    // Demo Mode Orders
    const active = demoSales
      .filter(s => s.kitchen_status !== 'served' && s.kitchen_status !== 'voided' && s.status !== 'voided')
      .map(s => {
        const enrichedItems = (s.items || []).map((it, idx) => {
          const enriched = enrichItem(it, idx, s.kitchen_status);
          // Persist enriched id & status back to demoSale item
          it.id = enriched.id;
          it.status = enriched.status;
          it.station = enriched.station;
          it.category = enriched.category;
          return enriched;
        });

        return {
          id: s.id,
          bill_number: s.bill_number,
          order_type: s.order_type,
          table_number: s.table_number,
          kitchen_status: s.kitchen_status || 'pending',
          created_at: s.created_at,
          station: getTicketStation(enrichedItems),
          sla: getSLAClassification(s.created_at),
          items: enrichedItems
        };
      });

    const filtered = stationFilter === 'all'
      ? active
      : active.filter(o => o.items.some(i => i.station === stationFilter));

    res.json({ orders: filtered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// KDS: Update Overall Kitchen Order Status (pending -> preparing -> ready -> served)
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

      // Synchronize item status in DB
      if (status === 'ready' || status === 'served') {
        await query('UPDATE sale_items SET status = $1 WHERE sale_id = $2', ['ready', orderId], req.user);
      } else if (status === 'pending') {
        await query('UPDATE sale_items SET status = $1 WHERE sale_id = $2', ['pending', orderId], req.user);
      }

      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: status
      });
      return res.json({ success: true, order: updated[0] });
    }

    const order = demoSales.find(s => String(s.id) === String(orderId));
    if (order) {
      order.kitchen_status = status;

      // Update line items when order status advances
      if (Array.isArray(order.items)) {
        order.items.forEach(i => {
          if (status === 'ready' || status === 'served') {
            i.status = 'ready';
          } else if (status === 'pending') {
            i.status = 'pending';
          }
        });
      }

      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: status,
        items: order.items
      });
      return res.json({ success: true, order });
    }
    res.status(404).json({ error: 'Order not found.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// KDS: Item-Level Bumping (Toggle line item ready / pending)
router.patch('/orders/:orderId/items/:itemId/bump', auth, roles('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  const { orderId, itemId } = req.params;
  const { status: targetStatus } = req.body;

  try {
    if (pool) {
      // Find current item
      const itemRows = await query(
        'SELECT si.*, s.kitchen_status FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.id = $1 AND s.id = $2 AND s.shop_id = $3',
        [itemId, orderId, req.user.shop_id],
        req.user
      );
      if (!itemRows.length) return res.status(404).json({ error: 'Order item not found.' });

      const currentItem = itemRows[0];
      const nextStatus = targetStatus || (currentItem.status === 'ready' ? 'pending' : 'ready');

      await query('UPDATE sale_items SET status = $1 WHERE id = $2', [nextStatus, itemId], req.user);

      // Check all items for this sale
      const allItems = await query('SELECT id, status FROM sale_items WHERE sale_id = $1', [orderId], req.user);
      const allReady = allItems.length > 0 && allItems.every(i => i.status === 'ready');
      const anyReady = allItems.some(i => i.status === 'ready');

      let nextOrderStatus = currentItem.kitchen_status;
      if (allReady) {
        nextOrderStatus = 'ready';
      } else if (anyReady && currentItem.kitchen_status === 'pending') {
        nextOrderStatus = 'preparing';
      } else if (!allReady && currentItem.kitchen_status === 'ready') {
        nextOrderStatus = 'preparing';
      }

      if (nextOrderStatus !== currentItem.kitchen_status) {
        await query('UPDATE sales SET kitchen_status = $1 WHERE id = $2', [nextOrderStatus, orderId], req.user);
      }

      broadcastKDS(req.user.shop_id, 'order:item_status', {
        orderId,
        itemId,
        status: nextStatus,
        kitchen_status: nextOrderStatus
      });

      if (nextOrderStatus !== currentItem.kitchen_status) {
        broadcastKDS(req.user.shop_id, 'order:status', {
          orderId,
          kitchen_status: nextOrderStatus
        });
      }

      return res.json({
        success: true,
        orderId,
        itemId,
        status: nextStatus,
        kitchen_status: nextOrderStatus,
        allReady
      });
    }

    // Demo Mode Item Bumping
    const order = demoSales.find(s => String(s.id) === String(orderId));
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Ensure items have IDs
    if (Array.isArray(order.items)) {
      order.items.forEach((it, idx) => {
        if (!it.id) it.id = `item-${idx + 1}`;
        if (!it.status) it.status = order.kitchen_status === 'ready' ? 'ready' : 'pending';
      });
    }

    const previousOrderStatus = order.kitchen_status;
    const bumpResult = bumpOrderItem(order, itemId, targetStatus);

    broadcastKDS(req.user.shop_id, 'order:item_status', {
      orderId,
      itemId,
      status: bumpResult.item.status,
      kitchen_status: order.kitchen_status,
      items: order.items
    });

    if (order.kitchen_status !== previousOrderStatus) {
      broadcastKDS(req.user.shop_id, 'order:status', {
        orderId,
        kitchen_status: order.kitchen_status
      });
    }

    res.json({
      success: true,
      order,
      item: bumpResult.item,
      kitchen_status: order.kitchen_status,
      allReady: bumpResult.isAllReady
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
