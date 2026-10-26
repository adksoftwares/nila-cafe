import { Router } from 'express';
import { query, pool } from '../db.js';
import { demoShops } from '../state.js';
import { auth, roles } from '../middleware/auth.js';

const router = Router();

// Get Shop Details & Tax Configuration Settings
router.get('/settings', auth, async (req, res) => {
  try {
    if (pool) {
      const rows = await query(
        `SELECT id, name, email, phone, address, 
                service_charge_enabled, service_charge_rate, 
                sscl_enabled, sscl_rate, 
                vat_enabled, vat_rate, active 
         FROM shops WHERE id = $1`,
        [req.user.shop_id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Shop not found.' });
      return res.json({ shop: rows[0] });
    }

    const shop = demoShops.find(s => s.id === req.user.shop_id) || demoShops[0];
    res.json({ shop });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Shop Tax Configuration & Info
router.patch('/settings', auth, roles('owner', 'admin'), async (req, res) => {
  const {
    name,
    phone,
    address,
    service_charge_enabled,
    service_charge_rate,
    sscl_enabled,
    sscl_rate,
    vat_enabled,
    vat_rate
  } = req.body;

  try {
    if (pool) {
      const updates = [];
      const values = [];
      let idx = 1;

      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(String(name).trim());
      }
      if (phone !== undefined) {
        updates.push(`phone = $${idx++}`);
        values.push(String(phone).trim());
      }
      if (address !== undefined) {
        updates.push(`address = $${idx++}`);
        values.push(String(address).trim());
      }
      if (service_charge_enabled !== undefined) {
        updates.push(`service_charge_enabled = $${idx++}`);
        values.push(Boolean(service_charge_enabled));
      }
      if (service_charge_rate !== undefined) {
        updates.push(`service_charge_rate = $${idx++}`);
        values.push(Math.max(0, Number(service_charge_rate) || 0));
      }
      if (sscl_enabled !== undefined) {
        updates.push(`sscl_enabled = $${idx++}`);
        values.push(Boolean(sscl_enabled));
      }
      if (sscl_rate !== undefined) {
        updates.push(`sscl_rate = $${idx++}`);
        values.push(Math.max(0, Number(sscl_rate) || 0));
      }
      if (vat_enabled !== undefined) {
        updates.push(`vat_enabled = $${idx++}`);
        values.push(Boolean(vat_enabled));
      }
      if (vat_rate !== undefined) {
        updates.push(`vat_rate = $${idx++}`);
        values.push(Math.max(0, Number(vat_rate) || 0));
      }

      if (!updates.length) {
        return res.status(400).json({ error: 'No configuration fields provided for update.' });
      }

      values.push(req.user.shop_id);
      const rows = await query(
        `UPDATE shops SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (!rows.length) return res.status(404).json({ error: 'Shop not found.' });
      return res.json({ success: true, shop: rows[0] });
    }

    const shop = demoShops.find(s => s.id === req.user.shop_id) || demoShops[0];
    if (name !== undefined) shop.name = String(name).trim();
    if (phone !== undefined) shop.phone = String(phone).trim();
    if (address !== undefined) shop.address = String(address).trim();
    if (service_charge_enabled !== undefined) shop.service_charge_enabled = Boolean(service_charge_enabled);
    if (service_charge_rate !== undefined) shop.service_charge_rate = Math.max(0, Number(service_charge_rate) || 0);
    if (sscl_enabled !== undefined) shop.sscl_enabled = Boolean(sscl_enabled);
    if (sscl_rate !== undefined) shop.sscl_rate = Math.max(0, Number(sscl_rate) || 0);
    if (vat_enabled !== undefined) shop.vat_enabled = Boolean(vat_enabled);
    if (vat_rate !== undefined) shop.vat_rate = Math.max(0, Number(vat_rate) || 0);

    res.json({ success: true, shop });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
