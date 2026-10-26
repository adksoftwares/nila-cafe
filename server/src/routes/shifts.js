import { Router } from 'express';
import { pool, query } from '../db.js';
import {
  demoShift,
  setDemoShift,
  demoShiftAdjustments,
  demoSales
} from '../state.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Shifts: Get Current Shift Status
router.get('/current', auth, async (req, res) => {
  try {
    if (pool) {
      const rows = await query(
        "SELECT * FROM shifts WHERE shop_id = $1 AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (!rows.length) return res.json({ shift: null, summary: null });
      const shift = rows[0];

      const salesAgg = await query(
        "SELECT COUNT(*)::int AS bills, COALESCE(SUM(total), 0)::float AS cash_sales, COALESCE(SUM(discount), 0)::float AS discounts, COALESCE(SUM(service_charge), 0)::float AS service_charge, COALESCE(SUM(sscl), 0)::float AS sscl, COALESCE(SUM(vat), 0)::float AS vat FROM sales WHERE shift_id = $1 AND status != 'voided'",
        [shift.id],
        req.user
      );

      const adjAgg = await query(
        "SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END), 0)::float AS net_adjustments FROM shift_cash_adjustments WHERE shift_id = $1",
        [shift.id],
        req.user
      );

      const cashSales = salesAgg[0]?.cash_sales || 0;
      const bills = salesAgg[0]?.bills || 0;
      const discounts = salesAgg[0]?.discounts || 0;
      const netAdjustments = adjAgg[0]?.net_adjustments || 0;
      const expectedCash = Math.round((Number(shift.opening_float) + cashSales + netAdjustments) * 100) / 100;

      return res.json({
        shift,
        summary: {
          bills,
          cashSales,
          discounts,
          netAdjustments,
          expectedCash,
          openingFloat: Number(shift.opening_float)
        }
      });
    }

    // Demo Mode Shift Status
    if (!demoShift || demoShift.status !== 'open') {
      return res.json({ shift: null, summary: null });
    }
    const validShiftSales = demoSales.filter(s => s.status !== 'voided');
    const cashSales = validShiftSales.reduce((sum, s) => sum + s.total, 0);
    const discounts = validShiftSales.reduce((sum, s) => sum + s.discount, 0);
    const netAdjustments = demoShiftAdjustments.reduce((sum, a) => sum + (a.type === 'cash_in' ? a.amount : -a.amount), 0);
    const expectedCash = Math.round((demoShift.opening_float + cashSales + netAdjustments) * 100) / 100;

    res.json({
      shift: demoShift,
      summary: {
        bills: validShiftSales.length,
        cashSales,
        discounts,
        netAdjustments,
        expectedCash,
        openingFloat: demoShift.opening_float
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shifts: Open Shift (Entering Opening Float)
router.post('/open', auth, roles('owner', 'manager', 'cashier'), async (req, res) => {
  const { openingFloat = 0, notes = '' } = req.body;
  const floatVal = Math.max(0, Number(openingFloat) || 0);

  try {
    if (pool) {
      const active = await query(
        "SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (active.length > 0) {
        return res.status(400).json({ error: 'A shift is already open. Close it before opening a new one.' });
      }

      const rows = await query(
        "INSERT INTO shifts(shop_id, user_id, opening_float, expected_cash, status, notes) VALUES($1, $2, $3, $4, 'open', $5) RETURNING *",
        [req.user.shop_id, req.user.sub, floatVal, floatVal, String(notes || '').trim()],
        req.user
      );
      return res.status(201).json({ shift: rows[0] });
    }

    if (demoShift && demoShift.status === 'open') {
      return res.status(400).json({ error: 'A shift is already open.' });
    }

    const newDemoShift = {
      id: 'shift-demo-' + Date.now(),
      shop_id: req.user.shop_id,
      user_id: req.user.sub,
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_float: floatVal,
      expected_cash: floatVal,
      actual_cash: null,
      difference: null,
      status: 'open',
      notes: String(notes || '').trim()
    };
    setDemoShift(newDemoShift);
    res.status(201).json({ shift: newDemoShift });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shifts: Petty Cash In / Out (Adjustments)
router.post('/adjustment', auth, roles('owner', 'manager'), async (req, res) => {
  const { type, amount, reason } = req.body;
  if (!['cash_in', 'cash_out'].includes(type) || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !reason) {
    return res.status(400).json({ error: 'Provide valid adjustment type, positive amount, and reason.' });
  }

  try {
    if (pool) {
      const active = await query(
        "SELECT id FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (!active.length) {
        return res.status(400).json({ error: 'No active shift found. Open a shift first.' });
      }

      const rows = await query(
        "INSERT INTO shift_cash_adjustments(shift_id, shop_id, user_id, type, amount, reason) VALUES($1, $2, $3, $4, $5, $6) RETURNING *",
        [active[0].id, req.user.shop_id, req.user.sub, type, Number(amount), reason.trim()],
        req.user
      );
      return res.status(201).json({ adjustment: rows[0] });
    }

    if (!demoShift || demoShift.status !== 'open') {
      return res.status(400).json({ error: 'No active shift in demo mode.' });
    }

    const adj = {
      id: 'adj-' + Date.now(),
      shift_id: demoShift.id,
      type,
      amount: Number(amount),
      reason: reason.trim(),
      created_at: new Date().toISOString()
    };
    demoShiftAdjustments.push(adj);
    res.status(201).json({ adjustment: adj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shifts: Close Shift & Generate Official Z-Report
router.post('/close', auth, roles('owner', 'manager', 'cashier'), async (req, res) => {
  const { actualCash = 0, notes = '' } = req.body;
  const counted = Math.max(0, Number(actualCash) || 0);

  try {
    if (pool) {
      const active = await query(
        "SELECT * FROM shifts WHERE shop_id = $1 AND status = 'open' LIMIT 1",
        [req.user.shop_id],
        req.user
      );
      if (!active.length) {
        return res.status(400).json({ error: 'No open shift to close.' });
      }
      const shift = active[0];

      const salesAgg = await query(
        "SELECT COUNT(*)::int AS bills, COALESCE(SUM(total), 0)::float AS cash_sales, COALESCE(SUM(discount), 0)::float AS discounts, COALESCE(SUM(service_charge), 0)::float AS service_charge, COALESCE(SUM(sscl), 0)::float AS sscl, COALESCE(SUM(vat), 0)::float AS vat FROM sales WHERE shift_id = $1 AND status != 'voided'",
        [shift.id],
        req.user
      );

      const adjAgg = await query(
        "SELECT COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE -amount END), 0)::float AS net_adjustments FROM shift_cash_adjustments WHERE shift_id = $1",
        [shift.id],
        req.user
      );

      const cashSales = salesAgg[0]?.cash_sales || 0;
      const bills = salesAgg[0]?.bills || 0;
      const discounts = salesAgg[0]?.discounts || 0;
      const netAdjustments = adjAgg[0]?.net_adjustments || 0;
      const expectedCash = Math.round((Number(shift.opening_float) + cashSales + netAdjustments) * 100) / 100;
      const difference = Math.round((counted - expectedCash) * 100) / 100;

      const updated = (await query(
        "UPDATE shifts SET closed_at = NOW(), actual_cash = $1, expected_cash = $2, difference = $3, status = 'closed', notes = $4 WHERE id = $5 RETURNING *",
        [counted, expectedCash, difference, String(notes || '').trim(), shift.id],
        req.user
      ))[0];

      const scCollected = salesAgg[0]?.service_charge || 0;
      const ssclCollected = salesAgg[0]?.sscl || 0;
      const vatCollected = salesAgg[0]?.vat || 0;

      const zReport = {
        zReportNumber: 'Z-' + Date.now().toString().slice(-6),
        shiftId: shift.id,
        openedAt: shift.opened_at,
        closedAt: updated.closed_at,
        cashier: req.user.name,
        openingFloat: Number(shift.opening_float),
        cashSales,
        discountsGiven: discounts,
        serviceChargeCollected: scCollected,
        ssclCollected: ssclCollected,
        vatCollected: vatCollected,
        totalTaxesCollected: Math.round((scCollected + ssclCollected + vatCollected) * 100) / 100,
        netAdjustments,
        expectedCash,
        actualCountedCash: counted,
        variance: difference,
        billsCount: bills
      };

      return res.json({ shift: updated, zReport });
    }

    // Demo Mode Z-Report
    if (!demoShift || demoShift.status !== 'open') {
      return res.status(400).json({ error: 'No open shift to close.' });
    }

    const validCloseSales = demoSales.filter(s => s.status !== 'voided');
    const cashSales = validCloseSales.reduce((sum, s) => sum + s.total, 0);
    const discounts = validCloseSales.reduce((sum, s) => sum + s.discount, 0);
    const scCollected = Math.round(validCloseSales.reduce((sum, s) => sum + (s.service_charge || 0), 0) * 100) / 100;
    const ssclCollected = Math.round(validCloseSales.reduce((sum, s) => sum + (s.sscl || 0), 0) * 100) / 100;
    const vatCollected = Math.round(validCloseSales.reduce((sum, s) => sum + (s.vat || 0), 0) * 100) / 100;
    const netAdjustments = demoShiftAdjustments.reduce((sum, a) => sum + (a.type === 'cash_in' ? a.amount : -a.amount), 0);
    const expectedCash = Math.round((demoShift.opening_float + cashSales + netAdjustments) * 100) / 100;
    const difference = Math.round((counted - expectedCash) * 100) / 100;

    const closedDemoShift = {
      ...demoShift,
      closed_at: new Date().toISOString(),
      actual_cash: counted,
      expected_cash: expectedCash,
      difference,
      status: 'closed',
      notes: String(notes || '').trim()
    };
    setDemoShift(closedDemoShift);

    const zReport = {
      zReportNumber: 'Z-' + Date.now().toString().slice(-6),
      shiftId: closedDemoShift.id,
      openedAt: closedDemoShift.opened_at,
      closedAt: closedDemoShift.closed_at,
      cashier: req.user.name || 'Demo Cashier',
      openingFloat: closedDemoShift.opening_float,
      cashSales,
      discountsGiven: discounts,
      serviceChargeCollected: scCollected,
      ssclCollected: ssclCollected,
      vatCollected: vatCollected,
      totalTaxesCollected: Math.round((scCollected + ssclCollected + vatCollected) * 100) / 100,
      netAdjustments,
      expectedCash,
      actualCountedCash: counted,
      variance: difference,
      billsCount: validCloseSales.length
    };

    res.json({ shift: closedDemoShift, zReport });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
