import { Router } from 'express';
import crypto from 'node:crypto';
import { query, pool } from '../db.js';
import {
  demoTables,
  demoSales,
  demoProducts,
  demoIngredients,
  demoRecipes,
  demoIngredientMovements,
  demoCustomers,
  demoShops,
  broadcastKDS
} from '../state.js';
import { calculateBillTaxes } from '../utils/tax.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Tables: List All Tables with Active Running Order Details
router.get('/', auth, async (req, res) => {
  try {
    if (pool) {
      const rows = await query(
        `SELECT t.id, t.table_number, t.capacity, t.status, t.active_sale_id,
                s.bill_number, s.total, s.subtotal, s.discount, s.service_charge, s.sscl, s.vat,
                s.created_at AS order_started_at,
                c.name AS customer_name, c.phone AS customer_phone,
                COALESCE(json_agg(json_build_object(
                  'id', si.id,
                  'product_id', si.product_id,
                  'name', si.product_name,
                  'code', si.product_code,
                  'qty', si.quantity,
                  'price', si.unit_price,
                  'notes', si.notes,
                  'total', si.line_total
                )) FILTER (WHERE si.id IS NOT NULL), '[]') AS items
         FROM restaurant_tables t
         LEFT JOIN sales s ON s.id = t.active_sale_id AND s.status = 'open'
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         WHERE t.shop_id = $1
         GROUP BY t.id, s.bill_number, s.total, s.subtotal, s.discount, s.service_charge, s.sscl, s.vat, s.created_at, c.name, c.phone
         ORDER BY t.table_number ASC`,
        [req.user.shop_id],
        req.user
      );
      return res.json({ tables: rows });
    }

    // Demo Mode Tables
    const list = demoTables.map(t => {
      let activeSale = null;
      if (t.active_sale_id) {
        activeSale = demoSales.find(s => s.id === t.active_sale_id && s.status === 'open');
      }
      return {
        ...t,
        bill_number: activeSale?.bill_number || null,
        total: activeSale?.total || 0,
        subtotal: activeSale?.subtotal || 0,
        discount: activeSale?.discount || 0,
        service_charge: activeSale?.service_charge || 0,
        sscl: activeSale?.sscl || 0,
        vat: activeSale?.vat || 0,
        customer_name: activeSale?.customer_name || null,
        customer_phone: activeSale?.customer_phone || null,
        order_started_at: activeSale?.created_at || null,
        items: activeSale?.items || []
      };
    });

    res.json({ tables: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tables: Send to Kitchen & Hold Open Tab (Incremental KOT Firing)
router.post('/hold', auth, roles('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  const {
    tableNumber,
    items = [],
    discount = 0,
    customerId = null
  } = req.body;

  if (!tableNumber || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Valid table number and at least one item required.' });
  }

  try {
    if (!pool) {
      // Demo Mode Tab Hold
      let table = demoTables.find(t => t.table_number === tableNumber);
      if (!table) {
        table = {
          id: 'tab-' + Date.now(),
          shop_id: req.user.shop_id,
          table_number: tableNumber,
          capacity: 4,
          status: 'ordered',
          active_sale_id: null
        };
        demoTables.push(table);
      }

      const lines = [];
      let subtotal = 0;
      for (const item of items) {
        const p = demoProducts.find(x => x.id === item.productId) || {
          name: 'Menu Item',
          code: 'ITEM',
          takeaway_price: 500,
          normal_price: 550,
          stock: 50
        };
        const q = Math.max(1, Number(item.quantity) || 1);
        const basePrice = Number(p.normal_price);
        const itemModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
        const modsExtra = itemModifiers.reduce((acc, m) => acc + (Number(m.price) || 0), 0);
        const price = Math.round((basePrice + modsExtra) * 100) / 100;
        const lineSub = Math.round(price * q * 100) / 100;
        subtotal = Math.round((subtotal + lineSub) * 100) / 100;
        p.stock = Math.max(0, p.stock - q);

        // BOM auto-depletion (base product)
        const matchingRecipes = demoRecipes.filter(r => r.product_id === (p.id || item.productId));
        for (const rec of matchingRecipes) {
          const ing = demoIngredients.find(i => i.id === rec.ingredient_id);
          if (ing) {
            const needed = Math.round(rec.quantity_required * q * 100) / 100;
            ing.stock = Math.max(0, Math.round((Number(ing.stock) - needed) * 100) / 100);
            demoIngredientMovements.push({
              id: 'imov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              shop_id: req.user.shop_id,
              ingredient_id: ing.id,
              delta_qty: -needed,
              reason: 'sale_depletion',
              reference_id: tableNumber,
              created_at: new Date().toISOString()
            });
          }
        }

        // Modifiers BOM auto-depletion
        for (const mod of itemModifiers) {
          if (mod.ingredient_id && Number(mod.ingredient_qty) > 0) {
            const ing = demoIngredients.find(i => i.id === mod.ingredient_id);
            if (ing) {
              const needed = Math.round(Number(mod.ingredient_qty) * q * 100) / 100;
              ing.stock = Math.max(0, Math.round((Number(ing.stock) - needed) * 100) / 100);
              demoIngredientMovements.push({
                id: 'imov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                shop_id: req.user.shop_id,
                ingredient_id: ing.id,
                delta_qty: -needed,
                reason: 'sale_depletion',
                reference_id: tableNumber,
                created_at: new Date().toISOString()
              });
            }
          }
        }

        lines.push({
          name: p.name,
          code: p.code,
          quantity: q,
          price,
          discount: 0,
          notes: item.notes || '',
          modifiers: itemModifiers,
          total: lineSub
        });
      }

      const demoShop = demoShops[0] || {};
      const taxes = calculateBillTaxes({
        subtotal,
        discount: Number(discount) || 0,
        orderType: 'dining',
        taxConfig: demoShop
      });

      let customer = null;
      if (customerId) {
        customer = demoCustomers.find(c => c.id === customerId);
      }

      const bill = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

      const openSale = {
        id: 'sale-open-' + Date.now(),
        bill_number: bill,
        order_type: 'dining',
        table_number: tableNumber,
        kitchen_status: 'pending',
        status: 'open', // Held open tab
        subtotal,
        discount: Number(discount) || 0,
        service_charge: taxes.serviceCharge,
        sscl: taxes.sscl,
        vat: taxes.vat,
        total: taxes.grandTotal,
        customer_id: customer?.id || null,
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || null,
        points_earned: 0,
        points_redeemed: 0,
        promotion_code: null,
        payment_method: 'pending',
        amount_received: 0,
        payments: [],
        created_at: new Date().toISOString(),
        cashier_name: req.user.name || 'Server',
        items: lines
      };

      demoSales.unshift(openSale);
      table.status = 'ordered';
      table.active_sale_id = openSale.id;

      // Broadcast new KOT to Kitchen Displays
      broadcastKDS(req.user.shop_id, 'order:new', {
        id: openSale.id,
        bill_number: openSale.bill_number,
        order_type: 'dining',
        table_number: tableNumber,
        kitchen_status: 'pending',
        created_at: openSale.created_at,
        items: lines.map(l => ({
          name: l.name,
          code: l.code,
          qty: l.quantity,
          notes: l.notes
        }))
      });

      return res.status(201).json({
        success: true,
        message: `Fired KOT to kitchen. Table ${tableNumber} held as Open Tab.`,
        table,
        sale: openSale
      });
    }

    // PostgreSQL Pool Transaction for Tab Holding
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_shop_id', $1, true)", [req.user.shop_id]);

      // Ensure table exists in shop catalog
      let tableRows = (await client.query(
        'SELECT * FROM restaurant_tables WHERE shop_id = $1 AND table_number = $2 FOR UPDATE',
        [req.user.shop_id, tableNumber]
      )).rows;

      let tableId;
      if (!tableRows.length) {
        const createdTable = (await client.query(
          'INSERT INTO restaurant_tables(shop_id, table_number, status) VALUES($1, $2, $3) RETURNING *',
          [req.user.shop_id, tableNumber, 'ordered']
        )).rows[0];
        tableId = createdTable.id;
      } else {
        tableId = tableRows[0].id;
      }

      // Check unique product IDs
      const uniqueProductIds = [...new Set(items.map(i => i.productId))].sort();
      const lockedProducts = (await client.query(
        'SELECT * FROM products WHERE id = ANY($1::uuid[]) AND shop_id = $2 AND active = true ORDER BY id FOR UPDATE',
        [uniqueProductIds, req.user.shop_id]
      )).rows;

      const productMap = new Map(lockedProducts.map(p => [p.id, p]));
      for (const pid of uniqueProductIds) {
        if (!productMap.has(pid)) throw new Error(`Product ID ${pid} was not found or is inactive.`);
      }

      let subtotal = 0;
      const lines = [];
      for (const item of items) {
        const q = Number(item.quantity);
        const p = productMap.get(item.productId);
        if (p.stock < q) throw new Error(`Insufficient stock for "${p.name}". Available: ${p.stock}`);
        p.stock -= q;

        const basePrice = Number(p.normal_price);
        const itemModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
        const modsExtra = itemModifiers.reduce((acc, m) => acc + (Number(m.price) || 0), 0);
        const price = Math.round((basePrice + modsExtra) * 100) / 100;
        const lineSubtotal = Math.round(price * q * 100) / 100;
        subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
        lines.push({ p, q, price, total: lineSubtotal, notes: item.notes || null, modifiers: itemModifiers });
      }

      // Fetch shop tax configuration
      const shopRow = (await client.query(
        'SELECT service_charge_enabled, service_charge_rate, sscl_enabled, sscl_rate, vat_enabled, vat_rate FROM shops WHERE id = $1',
        [req.user.shop_id]
      )).rows;
      const shopTaxConfig = shopRow.length ? shopRow[0] : {};

      const taxes = calculateBillTaxes({
        subtotal,
        discount: Number(discount) || 0,
        orderType: 'dining',
        taxConfig: shopTaxConfig
      });

      const bill = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

      // Query active shift
      let activeShiftId = null;
      const shiftRow = (await client.query("SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1", [req.user.shop_id])).rows;
      if (shiftRow.length) activeShiftId = shiftRow[0].id;

      // Insert held sale with status = 'open'
      const sale = (await client.query(
        `INSERT INTO sales(shop_id, user_id, shift_id, customer_id, bill_number, order_type, table_number,
          subtotal, discount, service_charge, sscl, vat, total, points_earned, points_redeemed,
          payment_method, amount_received, status)
         VALUES($1, $2, $3, $4, $5, 'dining', $6, $7, $8, $9, $10, $11, $12, 0, 0, 'pending', 0, 'open')
         RETURNING *`,
        [
          req.user.shop_id,
          req.user.sub,
          activeShiftId,
          customerId || null,
          bill,
          tableNumber,
          subtotal,
          Number(discount) || 0,
          taxes.serviceCharge,
          taxes.sscl,
          taxes.vat,
          taxes.grandTotal
        ]
      )).rows[0];

      // Insert sale items and audit stock movements
      for (const l of lines) {
        await client.query(
          'INSERT INTO sale_items(sale_id, product_id, product_code, product_name, quantity, unit_price, discount, notes, line_total, modifiers) VALUES($1, $2, $3, $4, $5, $6, 0, $7, $8, $9)',
          [sale.id, l.p.id, l.p.code, l.p.name, l.q, l.price, l.notes, l.total, JSON.stringify(l.modifiers || [])]
        );
        await client.query(
          'INSERT INTO stock_movements(shop_id, product_id, delta_qty, reason, reference_id) VALUES($1, $2, $3, $4, $5)',
          [req.user.shop_id, l.p.id, -l.q, 'sale', sale.bill_number]
        );
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [l.q, l.p.id]
        );

        // 1. BOM raw ingredient auto-depletion (base product)
        const recipes = (await client.query(
          'SELECT ingredient_id, quantity_required FROM recipe_items WHERE product_id = $1 AND shop_id = $2',
          [l.p.id, req.user.shop_id]
        )).rows;

        for (const rec of recipes) {
          const ingQty = Math.round(Number(rec.quantity_required) * l.q * 100) / 100;
          await client.query(
            'UPDATE ingredients SET stock = stock - $1 WHERE id = $2 AND shop_id = $3',
            [ingQty, rec.ingredient_id, req.user.shop_id]
          );
          await client.query(
            'INSERT INTO ingredient_movements(shop_id, ingredient_id, delta_qty, reason, reference_id) VALUES($1, $2, $3, $4, $5)',
            [req.user.shop_id, rec.ingredient_id, -ingQty, 'sale_depletion', sale.bill_number]
          );
        }

        // 2. Modifiers BOM auto-depletion
        if (Array.isArray(l.modifiers)) {
          for (const mod of l.modifiers) {
            if (mod.ingredient_id && Number(mod.ingredient_qty) > 0) {
              const modIngQty = Math.round(Number(mod.ingredient_qty) * l.q * 100) / 100;
              await client.query(
                'UPDATE ingredients SET stock = stock - $1 WHERE id = $2 AND shop_id = $3',
                [modIngQty, mod.ingredient_id, req.user.shop_id]
              );
              await client.query(
                'INSERT INTO ingredient_movements(shop_id, ingredient_id, delta_qty, reason, reference_id) VALUES($1, $2, $3, $4, $5)',
                [req.user.shop_id, mod.ingredient_id, -modIngQty, 'sale_depletion', sale.bill_number]
              );
            }
          }
        }
      }

      // Link table to active held sale
      const updatedTable = (await client.query(
        "UPDATE restaurant_tables SET status = 'ordered', active_sale_id = $1 WHERE id = $2 RETURNING *",
        [sale.id, tableId]
      )).rows[0];

      await client.query('COMMIT');

      broadcastKDS(req.user.shop_id, 'order:new', {
        id: sale.id,
        bill_number: sale.bill_number,
        order_type: 'dining',
        table_number: tableNumber,
        kitchen_status: 'pending',
        created_at: sale.created_at,
        items: lines.map(l => ({
          name: l.p.name,
          code: l.p.code,
          qty: l.q,
          notes: l.notes
        }))
      });

      res.status(201).json({
        success: true,
        message: `Fired KOT to kitchen. Table ${tableNumber} held as Open Tab.`,
        table: updatedTable,
        sale
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tables: Update Table Status (e.g. print bill, seat guests, or free table)
router.patch('/:id/status', auth, roles('owner', 'manager', 'cashier', 'waiter'), async (req, res) => {
  const { status } = req.body;
  if (!['vacant', 'occupied', 'ordered', 'bill_printed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be vacant, occupied, ordered, or bill_printed.' });
  }

  try {
    if (pool) {
      const rows = await query(
        'UPDATE restaurant_tables SET status = $1 WHERE id = $2 AND shop_id = $3 RETURNING *',
        [status, req.params.id, req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.status(404).json({ error: 'Table not found.' });
      return res.json({ success: true, table: rows[0] });
    }

    const t = demoTables.find(x => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Table not found.' });
    t.status = status;
    res.json({ success: true, table: t });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
