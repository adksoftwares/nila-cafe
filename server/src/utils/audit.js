import crypto from 'node:crypto';
import { pool, query } from '../db.js';
import { demoAuditLogs } from '../state.js';
import { logger } from './logger.js';

export const ACTION_CATEGORIES = {
  SHIFT_OPEN: 'fiscal',
  SHIFT_CLOSE: 'fiscal',
  SHIFT_ADJUSTMENT: 'fiscal',
  DRAWER_KICK: 'fiscal',
  SALE_COMPLETED: 'sales',
  SALE_VOID: 'sales',
  TABLE_HOLD: 'sales',
  TABLE_SETTLED: 'sales',
  INGREDIENT_RESTOCK: 'inventory',
  RECIPE_BOM_ADD: 'inventory',
  RECIPE_BOM_DELETE: 'inventory',
  MODIFIER_GROUP_CREATE: 'menu',
  MODIFIER_GROUP_UPDATE: 'menu',
  MODIFIER_GROUP_DELETE: 'menu',
  PRODUCT_CREATE: 'menu',
  PRODUCT_UPDATE: 'menu',
  PRODUCT_PRICE_CHANGE: 'menu',
  USER_LOGIN: 'security',
  MANAGER_PIN_VERIFIED: 'security',
  MANAGER_PIN_FAILED: 'security'
};

export const ACTION_SEVERITIES = {
  SALE_VOID: 'danger',
  MANAGER_PIN_FAILED: 'danger',
  DRAWER_KICK: 'danger',
  SHIFT_ADJUSTMENT: 'warning',
  RECIPE_BOM_DELETE: 'warning',
  MODIFIER_GROUP_DELETE: 'warning',
  PRODUCT_PRICE_CHANGE: 'warning'
};

/**
 * Record an immutable security or fiscal audit log entry.
 * Supported across both PostgreSQL transactions and demo in-memory storage.
 */
export async function recordAuditEvent({
  shopId,
  userId = null,
  userName = 'System',
  userRole = 'system',
  action,
  entityType = null,
  entityId = null,
  details = {},
  category = null,
  severity = null
}) {
  const finalCategory = category || ACTION_CATEGORIES[action] || 'general';
  const finalSeverity = severity || ACTION_SEVERITIES[action] || 'info';
  const timestamp = new Date().toISOString();

  const auditDetails = {
    ...details,
    userName,
    userRole,
    category: finalCategory,
    severity: finalSeverity,
    entityType,
    entityId
  };

  logger.info({
    audit: {
      action,
      shopId,
      userId,
      userRole,
      entityType,
      entityId,
      severity: finalSeverity
    }
  }, `Audit event recorded: ${action}`);

  if (pool) {
    try {
      const rows = await query(
        `INSERT INTO audit_logs(shop_id, user_id, action, details, created_at)
         VALUES($1, $2, $3, $4, $5)
         RETURNING *`,
        [shopId || null, userId || null, action, JSON.stringify(auditDetails), timestamp]
      );
      return rows[0];
    } catch (err) {
      logger.error({ err: err.message, action }, 'Failed to write audit_log row to database.');
    }
  }

  // Demo In-Memory Store
  const logEntry = {
    id: 'audit-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    shop_id: shopId || 'shop-demo',
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    action,
    category: finalCategory,
    severity: finalSeverity,
    entity_type: entityType,
    entity_id: entityId,
    details: auditDetails,
    created_at: timestamp
  };

  demoAuditLogs.unshift(logEntry);
  if (demoAuditLogs.length > 500) {
    demoAuditLogs.length = 500;
  }

  return logEntry;
}

/**
 * Filter and search audit logs with pagination
 */
export function filterAuditLogs(logs = [], {
  category = 'all',
  severity = 'all',
  search = '',
  limit = 50,
  offset = 0
} = {}) {
  let filtered = [...logs];

  if (category && category !== 'all') {
    filtered = filtered.filter(l => (l.category || l.details?.category) === category);
  }

  if (severity && severity !== 'all') {
    filtered = filtered.filter(l => (l.severity || l.details?.severity) === severity);
  }

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    filtered = filtered.filter(l => {
      const actor = `${l.user_name || l.details?.userName || ''} ${l.user_role || l.details?.userRole || ''}`.toLowerCase();
      const action = String(l.action || '').toLowerCase();
      const detailsStr = JSON.stringify(l.details || {}).toLowerCase();
      return actor.includes(term) || action.includes(term) || detailsStr.includes(term);
    });
  }

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  return {
    total,
    logs: paged
  };
}
