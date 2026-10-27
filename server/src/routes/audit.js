import { Router } from 'express';
import { pool, query } from '../db.js';
import { demoAuditLogs } from '../state.js';
import { auth, roles } from '../middleware/auth.js';
import { filterAuditLogs, ACTION_CATEGORIES, ACTION_SEVERITIES } from '../utils/audit.js';

const router = Router();

// GET /api/audit-logs: Retrieve Paginated Audit Logs
router.get('/', auth, roles('admin', 'owner', 'manager'), async (req, res) => {
  const {
    category = 'all',
    severity = 'all',
    search = '',
    limit = 50,
    offset = 0
  } = req.query;

  const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

  try {
    if (pool) {
      let sql = `
        SELECT a.id, a.user_id, a.shop_id, a.action, a.details, a.created_at,
               u.name AS user_name, u.role AS user_role
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE (a.shop_id = $1 OR current_setting('app.is_admin', true) = 'true')
      `;
      const params = [req.user.shop_id];

      sql += ` ORDER BY a.created_at DESC LIMIT 500`;

      const rows = await query(sql, params, req.user);

      // Normalize Postgres rows
      const formatted = rows.map(r => {
        const details = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
        const cat = details.category || ACTION_CATEGORIES[r.action] || 'general';
        const sev = details.severity || ACTION_SEVERITIES[r.action] || 'info';

        return {
          id: r.id,
          shop_id: r.shop_id,
          user_id: r.user_id,
          user_name: details.userName || r.user_name || 'System',
          user_role: details.userRole || r.user_role || 'system',
          action: r.action,
          category: cat,
          severity: sev,
          entity_type: details.entityType || null,
          entity_id: details.entityId || null,
          details,
          created_at: r.created_at
        };
      });

      const filtered = filterAuditLogs(formatted, {
        category,
        severity,
        search,
        limit: parsedLimit,
        offset: parsedOffset
      });

      return res.json({
        logs: filtered.logs,
        totalCount: filtered.total,
        limit: parsedLimit,
        offset: parsedOffset
      });
    }

    // Demo Mode In-Memory Store
    const filtered = filterAuditLogs(demoAuditLogs, {
      category,
      severity,
      search,
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.json({
      logs: filtered.logs,
      totalCount: filtered.total,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit-logs/stats: Summary Statistics for Security Dashboard
router.get('/stats', auth, roles('admin', 'owner', 'manager'), async (req, res) => {
  try {
    let allLogs = [];

    if (pool) {
      const rows = await query(
        `SELECT a.action, a.details FROM audit_logs a
         WHERE a.shop_id = $1 OR current_setting('app.is_admin', true) = 'true'`,
        [req.user.shop_id],
        req.user
      );
      allLogs = rows.map(r => ({
        action: r.action,
        severity: (r.details?.severity) || ACTION_SEVERITIES[r.action] || 'info'
      }));
    } else {
      allLogs = demoAuditLogs;
    }

    const totalEvents = allLogs.length;
    const voidsCount = allLogs.filter(l => l.action === 'SALE_VOID').length;
    const drawerKicksCount = allLogs.filter(l => l.action === 'DRAWER_KICK').length;
    const adjustmentsCount = allLogs.filter(l => l.action === 'SHIFT_ADJUSTMENT').length;
    const dangerCount = allLogs.filter(l => l.severity === 'danger' || (l.details?.severity === 'danger')).length;

    res.json({
      totalEvents,
      voidsCount,
      drawerKicksCount,
      adjustmentsCount,
      dangerCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
