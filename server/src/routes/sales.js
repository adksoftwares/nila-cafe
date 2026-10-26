import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';
import {
  demoProducts,
  demoSales,
  demoShops,
  demoCustomers,
  demoPromotions,
  demoIdempotencyCache,
  broadcastKDS
} from '../state.js';
import { calculateBillTaxes } from '../utils/tax.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Sales: Checkout & Inventory Management (Deadlock-Free Batch Query, Idempotent, Multi-Payment, Loyalty Points & Promotions)
router.post('/', auth, roles('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  const {
    orderType,
    tableNumber = null,
    items = [],
    discount = 0,
    customerId = null,
    pointsRedeemed = 0,
    promotionCode = null,
    payments = null, // Array of { method: 'cash'|'card'|'qr', amount, reference }
    paymentMethod = 'cash',
    amountReceived = 0
  } = req.body;

  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;

  if (!['takeaway', 'delivery', 'dining'].includes(orderType) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Choose an order type and at least one product.' });
  }

  // Idempotency check: Return existing result if duplicate request is received
  if (idempotencyKey) {
    if (pool) {
      try {
        const existing = await query(
          'SELECT response_code, response_body FROM idempotency_keys WHERE shop_id = $1 AND key = $2',
          [req.user.shop_id, idempotencyKey]
        );
        if (existing.length > 0) {
          return res.status(existing[0].response_code).json(existing[0].response_body);
        }
      } catch (err) {
        console.error('Idempotency lookup warning:', err.message);
      }
    } else {
      const cacheKey = `${req.user.shop_id}:${idempotencyKey}`;
      if (demoIdempotencyCache.has(cacheKey)) {
        const cached = demoIdempotencyCache.get(cacheKey);
        return res.status(cached.code).json(cached.body);
      }
    }
  }

  if (!pool) {
    // Process demo checkout in-memory
    const lines = [];
    let subtotal = 0;
    for (const item of items) {
      const p = demoProducts.find(x => x.id === item.productId) || {
        name: 'Custom Product',
        code: 'CUST',
        takeaway_price: 500,
        normal_price: 550,
        stock: 50
      };
      const q = Math.max(1, Number(item.quantity) || 1);
      const price = Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);
      const lineSub = Math.round(price * q * 100) / 100;
      subtotal = Math.round((subtotal + lineSub) * 100) / 100;
      p.stock = Math.max(0, p.stock - q);
      lines.push({
        name: p.name,
        code: p.code,
        quantity: q,
        price,
        discount: 0,
        notes: item.notes || '',
        total: lineSub
      });
    }

    // Check Promotion Code
    let promoDiscount = 0;
    let appliedPromoCode = null;
    if (promotionCode) {
      const cleanCode = String(promotionCode).trim().toUpperCase();
      const promo = demoPromotions.find(p => p.code === cleanCode && p.active);
      if (!promo) {
        return res.status(400).json({ error: `Promotional code "${promotionCode}" is invalid or expired.` });
      }
      if (subtotal < promo.min_order_amount) {
        return res.status(400).json({
          error: `Order minimum of LKR ${promo.min_order_amount} required to use promo code "${promotionCode}".`
        });
      }
      appliedPromoCode = cleanCode;
      promoDiscount = promo.type === 'percentage'
        ? Math.round(subtotal * (promo.value / 100) * 100) / 100
        : Math.min(subtotal, promo.value);
    }

    // Check Customer & Loyalty Points
    let pointsDiscount = 0;
    let pointsEarned = 0;
    let demoCustomer = null;
    const ptsToRedeem = Math.max(0, parseInt(pointsRedeemed, 10) || 0);
    if (customerId) {
      demoCustomer = demoCustomers.find(c => c.id === customerId);
      if (demoCustomer && ptsToRedeem > 0) {
        if (demoCustomer.loyalty_points < ptsToRedeem) {
          return res.status(400).json({
            error: `Customer only has ${demoCustomer.loyalty_points} loyalty points available.`
          });
        }
        pointsDiscount = Math.min(Math.max(0, subtotal - promoDiscount), ptsToRedeem);
      }
    }

    const manualDiscount = Math.round(Math.min(subtotal, Number(discount) || 0) * 100) / 100;
    const totalDiscount = Math.round(Math.min(subtotal, manualDiscount + promoDiscount + pointsDiscount) * 100) / 100;

    // Calculate dynamic taxes (Service Charge 10% on Dine-In, SSCL 2.5%, VAT 18%)
    const demoShop = demoShops.find(s => s.id === req.user.shop_id) || demoShops[0] || {};
    const taxBreakdown = calculateBillTaxes({
      subtotal,
      discount: totalDiscount,
      orderType,
      taxConfig: demoShop
    });
    const total = taxBreakdown.grandTotal;

    if (demoCustomer) {
      pointsEarned = Math.floor(total / 100);
      demoCustomer.loyalty_points = demoCustomer.loyalty_points - pointsDiscount + pointsEarned;
      demoCustomer.total_spent = Math.round((demoCustomer.total_spent + total) * 100) / 100;
      demoCustomer.total_visits += 1;
    }

    const paymentList = Array.isArray(payments) && payments.length > 0
      ? payments.map(p => ({ method: p.method || 'cash', amount: Number(p.amount), reference: p.reference || null }))
      : [{ method: paymentMethod || 'cash', amount: total, reference: null }];

    const bill = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    const demoSale = {
      id: 'sale-demo-' + Date.now(),
      bill_number: bill,
      order_type: orderType,
      table_number: orderType === 'dining' ? (tableNumber || 'Table 1') : null,
      kitchen_status: 'pending',
      status: 'completed',
      subtotal,
      discount: totalDiscount,
      service_charge: taxBreakdown.serviceCharge,
      sscl: taxBreakdown.sscl,
      vat: taxBreakdown.vat,
      total,
      customer_id: demoCustomer ? demoCustomer.id : null,
      customer_name: demoCustomer ? demoCustomer.name : null,
      customer_phone: demoCustomer ? demoCustomer.phone : null,
      points_earned: pointsEarned,
      points_redeemed: pointsDiscount,
      promotion_code: appliedPromoCode,
      payment_method: paymentList.length > 1 ? 'mixed' : paymentList[0].method,
      amount_received: Number(amountReceived) || total,
      payments: paymentList,
      created_at: new Date().toISOString(),
      cashier_name: req.user.name || 'Demo Cashier',
      items: lines
    };

    demoSales.unshift(demoSale);

    broadcastKDS(req.user.shop_id, 'order:new', {
      id: demoSale.id,
      bill_number: demoSale.bill_number,
      order_type: demoSale.order_type,
      table_number: demoSale.table_number,
      kitchen_status: 'pending',
      created_at: demoSale.created_at,
      items: lines.map(l => ({
        name: l.name,
        code: l.code,
        qty: l.quantity,
        notes: l.notes
      }))
    });

    const responsePayload = {
      sale: demoSale,
      items: lines,
      payments: paymentList
    };

    if (idempotencyKey) {
      demoIdempotencyCache.set(`${req.user.shop_id}:${idempotencyKey}`, {
        code: 201,
        body: responsePayload
      });
    }

    return res.status(201).json(responsePayload);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enforce PostgreSQL Row-Level Security tenant parameter
    await client.query("SELECT set_config('app.current_shop_id', $1, true)", [req.user.shop_id]);

    // Step 1: Collect & sort unique product IDs to prevent deadlocks across concurrent orders
    const uniqueProductIds = [...new Set(items.map(i => i.productId))].sort();

    // Step 2: Batch query and lock all items in deterministic order
    const lockedProducts = (await client.query(
      'SELECT * FROM products WHERE id = ANY($1::uuid[]) AND shop_id = $2 AND active = true ORDER BY id FOR UPDATE',
      [uniqueProductIds, req.user.shop_id]
    )).rows;

    const productMap = new Map(lockedProducts.map(p => [p.id, p]));

    for (const pid of uniqueProductIds) {
      if (!productMap.has(pid)) {
        throw new Error(`A selected product (ID: ${pid}) was not found or is inactive.`);
      }
    }

    // Step 3: Validate quantities, calculate line items and stock decrement
    let subtotal = 0;
    const lines = [];

    for (const item of items) {
      const q = Number(item.quantity);
      const d = Math.max(0, Number(item.discount) || 0);
      const notes = String(item.notes || '').trim() || null;

      if (!Number.isInteger(q) || q < 1) {
        throw new Error('Quantity must be a positive whole number.');
      }

      const p = productMap.get(item.productId);
      if (p.stock < q) {
        throw new Error(`Insufficient stock for "${p.name}". In stock: ${p.stock}, Requested: ${q}.`);
      }

      p.stock -= q; // Deduct in-memory for multiple items referencing same product

      const price = Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);
      const lineSubtotal = Math.round(price * q * 100) / 100;
      const lineDiscount = Math.round(Math.min(lineSubtotal, d) * 100) / 100;
      const lineTotal = Math.round((lineSubtotal - lineDiscount) * 100) / 100;

      subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
      lines.push({ p, q, price, lineDiscount, total: lineTotal, notes });
    }

    // Step 4: Check Promotion Code
    let promoDiscount = 0;
    let appliedPromoCode = null;
    if (promotionCode) {
      const cleanCode = String(promotionCode).trim().toUpperCase();
      const pRows = (await client.query(
        'SELECT * FROM promotions WHERE shop_id = $1 AND code = $2 AND active = true',
        [req.user.shop_id, cleanCode]
      )).rows;
      if (!pRows.length) {
        throw new Error(`Promotional code "${promotionCode}" is invalid or expired.`);
      }
      const promo = pRows[0];
      if (subtotal < Number(promo.min_order_amount)) {
        throw new Error(`Order minimum of LKR ${promo.min_order_amount} required to use promo code "${promotionCode}".`);
      }
      appliedPromoCode = cleanCode;
      promoDiscount = promo.type === 'percentage'
        ? Math.round(subtotal * (Number(promo.value) / 100) * 100) / 100
        : Math.min(subtotal, Number(promo.value));
    }

    // Step 5: Check Customer & Loyalty Points
    let pointsDiscount = 0;
    let targetCustomer = null;
    const ptsToRedeem = Math.max(0, parseInt(pointsRedeemed, 10) || 0);
    if (customerId) {
      const cRows = (await client.query(
        'SELECT * FROM customers WHERE id = $1 AND shop_id = $2 FOR UPDATE',
        [customerId, req.user.shop_id]
      )).rows;
      if (cRows.length) {
        targetCustomer = cRows[0];
        if (ptsToRedeem > 0) {
          if (targetCustomer.loyalty_points < ptsToRedeem) {
            throw new Error(`Customer only has ${targetCustomer.loyalty_points} loyalty points available.`);
          }
          pointsDiscount = Math.min(Math.max(0, subtotal - promoDiscount), ptsToRedeem);
        }
      }
    }

    const manualDiscount = Math.round(Math.min(subtotal, Number(discount) || 0) * 100) / 100;
    const totalDiscount = Math.round(Math.min(subtotal, manualDiscount + promoDiscount + pointsDiscount) * 100) / 100;

    // Fetch shop tax settings & calculate dynamic taxes (Service Charge 10% on Dine-In, SSCL 2.5%, VAT 18%)
    const shopRow = (await client.query(
      'SELECT service_charge_enabled, service_charge_rate, sscl_enabled, sscl_rate, vat_enabled, vat_rate FROM shops WHERE id = $1',
      [req.user.shop_id]
    )).rows;
    const shopTaxConfig = shopRow.length ? shopRow[0] : {};

    const taxBreakdown = calculateBillTaxes({
      subtotal,
      discount: totalDiscount,
      orderType,
      taxConfig: shopTaxConfig
    });
    const total = taxBreakdown.grandTotal;
    const pointsEarned = targetCustomer ? Math.floor(total / 100) : 0;

    // Step 6: Validate and prepare payments (Single, Mixed Tender, or Split Bill)
    let paymentList = [];
    if (Array.isArray(payments) && payments.length > 0) {
      let paidSum = 0;
      for (const pay of payments) {
        const amt = Math.round(Number(pay.amount) * 100) / 100;
        const method = String(pay.method || 'cash').toLowerCase();
        if (!['cash', 'card', 'qr'].includes(method) || amt <= 0) {
          throw new Error('Invalid payment method or amount.');
        }
        paidSum = Math.round((paidSum + amt) * 100) / 100;
        paymentList.push({
          method,
          amount: amt,
          reference: pay.reference ? String(pay.reference).trim() : null
        });
      }
      if (paidSum < total - 0.05) {
        throw new Error(`Total payments (LKR ${paidSum}) do not cover the bill total (LKR ${total}).`);
      }
    } else {
      paymentList.push({
        method: ['cash', 'card', 'qr'].includes(paymentMethod) ? paymentMethod : 'cash',
        amount: total,
        reference: null
      });
    }

    const primaryPaymentMethod = paymentList.length === 1 ? paymentList[0].method : 'mixed';
    const totalCashAmount = paymentList
      .filter(p => p.method === 'cash')
      .reduce((sum, p) => sum + p.amount, 0);

    // Generate Bill Number
    const bill = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

    // Query active shift if any
    let activeShiftId = null;
    const shiftRow = (await client.query(
      "SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
      [req.user.shop_id]
    )).rows;
    if (shiftRow.length) activeShiftId = shiftRow[0].id;

    // Insert Sale record
    const sale = (await client.query(
      `INSERT INTO sales(shop_id, user_id, shift_id, customer_id, bill_number, order_type, table_number,
        subtotal, discount, service_charge, sscl, vat, total, points_earned, points_redeemed, promotion_code, payment_method, amount_received)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        req.user.shop_id,
        req.user.sub,
        activeShiftId,
        targetCustomer ? targetCustomer.id : null,
        bill,
        orderType,
        orderType === 'dining' ? (tableNumber || 'Table 1') : null,
        subtotal,
        totalDiscount,
        taxBreakdown.serviceCharge,
        taxBreakdown.sscl,
        taxBreakdown.vat,
        total,
        pointsEarned,
        pointsDiscount,
        appliedPromoCode,
        primaryPaymentMethod,
        Number(amountReceived) || totalCashAmount || total
      ]
    )).rows[0];

    // Update customer loyalty points and lifetime spend
    if (targetCustomer) {
      await client.query(
        'UPDATE customers SET loyalty_points = loyalty_points - $1 + $2, total_spent = total_spent + $3, total_visits = total_visits + 1 WHERE id = $4',
        [pointsDiscount, pointsEarned, total, targetCustomer.id]
      );
    }

    // Insert individual payments breakdown (for multi-tender & split bills)
    const recordedPayments = [];
    for (const p of paymentList) {
      const pRow = (await client.query(
        'INSERT INTO sale_payments(sale_id, shop_id, payment_method, amount, reference) VALUES($1, $2, $3, $4, $5) RETURNING *',
        [sale.id, req.user.shop_id, p.method, p.amount, p.reference]
      )).rows[0];
      recordedPayments.push(pRow);
    }

    // Insert sale items, audit stock movement ledger, and update database stock
    for (const l of lines) {
      await client.query(
        'INSERT INTO sale_items(sale_id, product_id, product_code, product_name, quantity, unit_price, discount, notes, line_total) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [sale.id, l.p.id, l.p.code, l.p.name, l.q, l.price, l.lineDiscount, l.notes, l.total]
      );

      // Double-entry stock ledger
      await client.query(
        'INSERT INTO stock_movements(shop_id, product_id, delta_qty, reason, reference_id) VALUES($1, $2, $3, $4, $5)',
        [req.user.shop_id, l.p.id, -l.q, 'sale', sale.bill_number]
      );

      // Decrement current stock
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [l.q, l.p.id]
      );
    }

    const responsePayload = {
      sale,
      items: lines.map(l => ({
        name: l.p.name,
        code: l.p.code,
        quantity: l.q,
        price: l.price,
        discount: l.lineDiscount,
        notes: l.notes,
        total: l.total
      })),
      payments: recordedPayments.map(p => ({
        method: p.payment_method,
        amount: Number(p.amount),
        reference: p.reference
      }))
    };

    // Store Idempotency key atomically within transaction
    if (idempotencyKey) {
      await client.query(
        'INSERT INTO idempotency_keys(key, shop_id, response_code, response_body) VALUES($1, $2, $3, $4) ON CONFLICT (shop_id, key) DO NOTHING',
        [idempotencyKey, req.user.shop_id, 201, JSON.stringify(responsePayload)]
      );
    }

    await client.query('COMMIT');

    // Broadcast new order to connected Kitchen Display System (KDS) screens
    broadcastKDS(req.user.shop_id, 'order:new', {
      id: sale.id,
      bill_number: sale.bill_number,
      order_type: sale.order_type,
      table_number: sale.table_number,
      kitchen_status: 'pending',
      created_at: sale.created_at,
      items: lines.map(l => ({
        name: l.p.name,
        code: l.p.code,
        qty: l.q,
        notes: l.notes
      }))
    });

    res.status(201).json(responsePayload);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Sales: List Order History (with void status, cashier, and line items)
router.get('/', auth, roles('admin', 'owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  try {
    if (pool) {
      const targetShopId = req.user.role === 'admin' ? (req.query.shopId || null) : req.user.shop_id;
      const args = targetShopId ? [targetShopId] : [];
      const shopFilter = targetShopId ? 'WHERE s.shop_id = $1' : '';

      const rows = await query(
        `SELECT s.id, s.bill_number, s.order_type, s.table_number, s.kitchen_status, s.status,
                s.subtotal, s.discount, s.service_charge, s.sscl, s.vat, s.total,
                s.payment_method, s.amount_received,
                s.points_earned, s.points_redeemed, s.promotion_code,
                s.voided_at, s.void_reason, s.created_at,
                u.name AS cashier_name,
                mgr.name AS void_authorized_by_name,
                c.name AS customer_name,
                c.phone AS customer_phone,
                COALESCE(json_agg(json_build_object(
                  'id', si.id,
                  'name', si.product_name,
                  'code', si.product_code,
                  'qty', si.quantity,
                  'price', si.unit_price,
                  'discount', si.discount,
                  'notes', si.notes,
                  'total', si.line_total
                )) FILTER (WHERE si.id IS NOT NULL), '[]') AS items
         FROM sales s
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN users mgr ON mgr.id = s.void_authorized_by
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         ${shopFilter}
         GROUP BY s.id, u.name, mgr.name, c.name, c.phone
         ORDER BY s.created_at DESC
         LIMIT 100`,
        args,
        req.user
      );
      return res.json({ sales: rows });
    }

    res.json({ sales: demoSales });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sales: Manager Void Authorization & Inventory Restock
router.post('/:id/void', auth, roles('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  const saleId = req.params.id;
  const { reason, managerPin } = req.body;

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'A reason for voiding this transaction is required.' });
  }

  const cleanReason = String(reason).trim();
  const isDirectManager = ['owner', 'manager'].includes(req.user.role);

  // If cashier or waiter, verify manager security PIN
  let authorizer = null;
  if (!isDirectManager) {
    const providedPin = String(managerPin || '').trim();
    if (!providedPin) {
      return res.status(403).json({ error: 'Manager Security PIN is required to authorize void.' });
    }

    if (pool) {
      const managers = await query(
        "SELECT id, name, manager_pin_hash FROM users WHERE shop_id = $1 AND role IN ('owner', 'manager') AND active = true",
        [req.user.shop_id]
      );
      let pinValid = false;
      for (const m of managers) {
        if (m.manager_pin_hash) {
          if (await bcrypt.compare(providedPin, m.manager_pin_hash)) {
            pinValid = true;
            authorizer = m;
            break;
          }
        } else if (providedPin === '8844') {
          pinValid = true;
          authorizer = m;
          break;
        }
      }
      if (!pinValid) {
        return res.status(403).json({ error: 'Invalid Manager PIN. Authorization rejected.' });
      }
    } else {
      if (providedPin !== '8844') {
        return res.status(403).json({ error: 'Invalid Manager PIN. Use default PIN 8844.' });
      }
      authorizer = { id: 'u-manager', name: 'Store Manager' };
    }
  } else {
    authorizer = { id: req.user.sub, name: req.user.name };
  }

  try {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_shop_id', $1, true)", [req.user.shop_id]);

        const saleRows = (await client.query(
          'SELECT * FROM sales WHERE id = $1 AND shop_id = $2 FOR UPDATE',
          [saleId, req.user.shop_id]
        )).rows;

        if (!saleRows.length) {
          throw new Error('Transaction not found.');
        }

        const sale = saleRows[0];
        if (sale.status === 'voided') {
          throw new Error('Transaction has already been voided.');
        }

        const updatedSale = (await client.query(
          `UPDATE sales 
           SET status = 'voided', 
               kitchen_status = 'voided',
               voided_at = NOW(), 
               void_reason = $1, 
               void_authorized_by = $2 
           WHERE id = $3 
           RETURNING *`,
          [cleanReason, authorizer?.id || req.user.sub, sale.id]
        )).rows[0];

        const saleItems = (await client.query(
          'SELECT * FROM sale_items WHERE sale_id = $1',
          [sale.id]
        )).rows;

        for (const item of saleItems) {
          await client.query(
            'INSERT INTO stock_movements(shop_id, product_id, delta_qty, reason, reference_id) VALUES($1, $2, $3, $4, $5)',
            [req.user.shop_id, item.product_id, item.quantity, 'void_restock', sale.bill_number]
          );

          await client.query(
            'UPDATE products SET stock = stock + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }

        // Reverse customer loyalty points and visits
        if (sale.customer_id) {
          await client.query(
            `UPDATE customers 
             SET loyalty_points = GREATEST(0, loyalty_points - $1 + $2), 
                 total_spent = GREATEST(0, total_spent - $3), 
                 total_visits = GREATEST(0, total_visits - 1) 
             WHERE id = $4`,
            [sale.points_earned || 0, sale.points_redeemed || 0, sale.total, sale.customer_id]
          );
        }

        await client.query(
          `INSERT INTO audit_logs(user_id, shop_id, action, details) 
           VALUES($1, $2, 'SALE_VOID', $3)`,
          [
            req.user.sub,
            req.user.shop_id,
            JSON.stringify({
              saleId: sale.id,
              billNumber: sale.bill_number,
              total: sale.total,
              reason: cleanReason,
              authorizedById: authorizer?.id,
              authorizedByName: authorizer?.name,
              initiatedByRole: req.user.role
            })
          ]
        );

        await client.query('COMMIT');

        broadcastKDS(req.user.shop_id, 'order:status', {
          orderId: sale.id,
          kitchen_status: 'voided'
        });

        return res.json({
          success: true,
          message: 'Sale voided successfully. Stock restored.',
          sale: updatedSale
        });
      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: err.message });
      } finally {
        client.release();
      }
    }

    // Demo Mode Void
    const sale = demoSales.find(s => String(s.id) === String(saleId) || s.bill_number === saleId);
    if (!sale) {
      return res.status(404).json({ error: 'Transaction not found in records.' });
    }
    if (sale.status === 'voided') {
      return res.status(400).json({ error: 'Transaction has already been voided.' });
    }

    sale.status = 'voided';
    sale.kitchen_status = 'voided';
    sale.voided_at = new Date().toISOString();
    sale.void_reason = cleanReason;
    sale.void_authorized_by_name = authorizer?.name || 'Manager';

    if (Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const prod = demoProducts.find(p => p.name === item.name || p.code === item.code || p.id === item.id);
        if (prod) {
          prod.stock += (item.qty || item.quantity || 1);
        }
      }
    }

    if (sale.customer_id) {
      const c = demoCustomers.find(x => x.id === sale.customer_id);
      if (c) {
        c.loyalty_points = Math.max(0, c.loyalty_points - (sale.points_earned || 0) + (sale.points_redeemed || 0));
        c.total_spent = Math.max(0, c.total_spent - sale.total);
        c.total_visits = Math.max(0, c.total_visits - 1);
      }
    }

    broadcastKDS(req.user.shop_id, 'order:status', {
      orderId: sale.id,
      kitchen_status: 'voided'
    });

    res.json({
      success: true,
      message: 'Sale voided successfully. Stock restored.',
      sale
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
