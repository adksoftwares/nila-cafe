// KDS Station Routing, SLA Visual Timers & Item Bumping Engine

export const BARISTA_CATEGORIES = new Set([
  'drinks',
  'beverages',
  'coffee',
  'juices',
  'tea',
  'shakes',
  'smoothies'
]);

export const BARISTA_KEYWORDS = [
  'coffee',
  'tea',
  'juice',
  'latte',
  'cappuccino',
  'espresso',
  'mocha',
  'beverage',
  'drink',
  'shake',
  'smoothie',
  'frappe',
  'brew',
  'macchiato',
  'americano',
  'chai'
];

/**
 * Determine station routing for a line item ('barista' or 'kitchen')
 * @param {Object} item - Line item with category, name, code
 * @returns {'barista' | 'kitchen'}
 */
export function getItemStation(item) {
  if (!item) return 'kitchen';

  // 1. Check explicit station if already assigned
  if (item.station === 'barista' || item.station === 'kitchen') {
    return item.station;
  }

  // 2. Check category name
  const cat = String(item.category || '').trim().toLowerCase();
  if (BARISTA_CATEGORIES.has(cat)) {
    return 'barista';
  }

  // 3. Check item name or code for barista keywords
  const text = `${item.name || item.product_name || ''} ${item.code || item.product_code || ''}`.toLowerCase();
  for (const keyword of BARISTA_KEYWORDS) {
    if (text.includes(keyword)) {
      return 'barista';
    }
  }

  return 'kitchen';
}

/**
 * Determine overall ticket station type ('barista' | 'kitchen' | 'mixed')
 * @param {Array} items
 * @returns {'barista' | 'kitchen' | 'mixed'}
 */
export function getTicketStation(items = []) {
  if (!Array.isArray(items) || items.length === 0) return 'kitchen';

  let hasBarista = false;
  let hasKitchen = false;

  for (const item of items) {
    const st = getItemStation(item);
    if (st === 'barista') hasBarista = true;
    if (st === 'kitchen') hasKitchen = true;
  }

  if (hasBarista && hasKitchen) return 'mixed';
  if (hasBarista) return 'barista';
  return 'kitchen';
}

/**
 * Classify Order SLA timer into Fresh (<5m), Warning (5-10m), or Delayed (>10m)
 * @param {string|Date} createdAt - ISO timestamp of order creation
 * @param {number} [now] - Current timestamp in ms (default Date.now())
 */
export function getSLAClassification(createdAt, now = Date.now()) {
  const createdTime = new Date(createdAt).getTime();
  const elapsedMs = Math.max(0, (typeof now === 'number' ? now : Date.now()) - createdTime);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const ss = String(elapsedSeconds % 60).padStart(2, '0');
  const formattedTime = `${mm}:${ss}`;

  if (elapsedMinutes < 5) {
    return {
      elapsedMinutes,
      elapsedSeconds,
      formattedTime,
      slaStatus: 'fresh',
      badge: '🟢 Fresh (< 5m)',
      color: '#10b981',
      bg: '#ecfdf5',
      borderColor: '#10b981',
      isPulsing: false
    };
  }

  if (elapsedMinutes < 10) {
    return {
      elapsedMinutes,
      elapsedSeconds,
      formattedTime,
      slaStatus: 'warning',
      badge: '🟡 Warning (5-10m)',
      color: '#d97706',
      bg: '#fffbeb',
      borderColor: '#f59e0b',
      isPulsing: false
    };
  }

  return {
    elapsedMinutes,
    elapsedSeconds,
    formattedTime,
    slaStatus: 'delayed',
    badge: '🔴 Delayed (> 10m)',
    color: '#dc2626',
    bg: '#fef2f2',
    borderColor: '#ef4444',
    isPulsing: true
  };
}

/**
 * Bump an individual order item and update the overall order kitchen status
 * @param {Object} order - Order object containing items array
 * @param {string} itemId - Item ID to bump
 * @param {'pending' | 'ready' | null} targetStatus - Explicit status or toggle
 */
export function bumpOrderItem(order, itemId, targetStatus = null) {
  if (!order || !Array.isArray(order.items)) {
    throw new Error('Order must contain an items array.');
  }

  const item = order.items.find(i => String(i.id) === String(itemId));
  if (!item) {
    throw new Error(`Item with id "${itemId}" not found in order.`);
  }

  // Toggle or assign target status
  if (targetStatus && (targetStatus === 'pending' || targetStatus === 'ready')) {
    item.status = targetStatus;
  } else {
    item.status = item.status === 'ready' ? 'pending' : 'ready';
  }

  // Ensure all items have a status
  for (const it of order.items) {
    if (!it.status) it.status = 'pending';
  }

  const totalItems = order.items.length;
  const readyItems = order.items.filter(i => i.status === 'ready').length;

  // Advance order status accordingly
  if (readyItems === totalItems && totalItems > 0) {
    order.kitchen_status = 'ready';
  } else if (readyItems > 0) {
    // If some items are ready, ticket is in preparing
    if (order.kitchen_status === 'pending' || order.kitchen_status === 'ready') {
      order.kitchen_status = 'preparing';
    }
  } else if (readyItems === 0 && order.kitchen_status === 'ready') {
    order.kitchen_status = 'preparing';
  }

  return {
    item,
    order,
    readyCount: readyItems,
    totalCount: totalItems,
    isAllReady: readyItems === totalItems
  };
}
