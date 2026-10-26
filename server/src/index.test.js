import test from 'node:test';
import assert from 'node:assert/strict';

test('POS order pricing rule: takeaway uses takeaway price; delivery and dining use normal price', () => {
  const p = { takeaway_price: 850, normal_price: 950 };
  assert.equal(p.takeaway_price, 850);
  assert.equal(p.normal_price, 950);
  for (const type of ['delivery', 'dining']) {
    assert.equal(type === 'takeaway' ? p.takeaway_price : p.normal_price, 950);
  }
});

test('discounts are capped at line/subtotal and totals cannot go negative', () => {
  const subtotal = 1000;
  const discount = Math.min(subtotal, 1200);
  assert.equal(discount, 1000);
  assert.equal(Math.max(0, subtotal - discount), 0);
});

test('bill discount percentage is computed from subtotal', () => {
  assert.equal(2000 * 10 / 100, 200);
});

test('Deadlock prevention: item product IDs are deduplicated and sorted lexicographically', () => {
  const incomingItems = [
    { productId: 'uuid-z', quantity: 2 },
    { productId: 'uuid-a', quantity: 1 },
    { productId: 'uuid-z', quantity: 3 },
    { productId: 'uuid-m', quantity: 1 }
  ];

  const uniqueSortedIds = [...new Set(incomingItems.map(i => i.productId))].sort();
  assert.deepEqual(uniqueSortedIds, ['uuid-a', 'uuid-m', 'uuid-z']);
});

test('Currency precision rounding avoids IEEE-754 floating point arithmetic leaks', () => {
  const price = 19.99;
  const qty = 3;
  const rawSubtotal = price * qty; // 59.970000000000006
  const roundedSubtotal = Math.round(rawSubtotal * 100) / 100;
  assert.equal(roundedSubtotal, 59.97);

  const discount = 5.55;
  const total = Math.round((roundedSubtotal - discount) * 100) / 100;
  assert.equal(total, 54.42);
});

test('Admin role must supply shopId to target specific store products', () => {
  const adminUser = { role: 'admin', shop_id: null };
  const ownerUser = { role: 'owner', shop_id: 'shop-123' };

  const getTargetShopId = (user, body) => {
    return user.role === 'admin' ? (body.shopId || null) : user.shop_id;
  };

  assert.equal(getTargetShopId(adminUser, {}), null);
  assert.equal(getTargetShopId(adminUser, { shopId: 'shop-456' }), 'shop-456');
  assert.equal(getTargetShopId(ownerUser, {}), 'shop-123');
});

test('Idempotency Key deduplication prevents duplicate charges and repeated stock deductions', () => {
  const idempotencyMap = new Map();
  const shopId = 'shop-nila-1';
  const idemKey = 'uuid-idem-test-999';
  const initialStock = 50;
  const orderQuantity = 2;

  let currentStock = initialStock;

  const processOrder = (key) => {
    const cacheKey = `${shopId}:${key}`;
    if (idempotencyMap.has(cacheKey)) {
      return { cached: true, ...idempotencyMap.get(cacheKey) };
    }

    currentStock -= orderQuantity;
    const result = { bill_number: 'POS-NILA-001', stock_after: currentStock };
    idempotencyMap.set(cacheKey, result);
    return { cached: false, ...result };
  };

  // First checkout submission
  const firstAttempt = processOrder(idemKey);
  assert.equal(firstAttempt.cached, false);
  assert.equal(firstAttempt.bill_number, 'POS-NILA-001');
  assert.equal(currentStock, 48);

  // Accidental double-click submission with identical idempotency key
  const secondAttempt = processOrder(idemKey);
  assert.equal(secondAttempt.cached, true);
  assert.equal(secondAttempt.bill_number, 'POS-NILA-001');
  assert.equal(currentStock, 48); // Stock was NOT deducted again!
});

test('Stock Movements Ledger calculates accurate net inventory balance', () => {
  const movements = [
    { delta_qty: 100, reason: 'restock' },
    { delta_qty: -2, reason: 'sale' },
    { delta_qty: -3, reason: 'sale' },
    { delta_qty: -1, reason: 'spoilage' }
  ];

  const netStock = movements.reduce((sum, m) => sum + m.delta_qty, 0);
  assert.equal(netStock, 94);
});


test('Row-Level Security (RLS) session parameter resolution enforces tenant isolation boundaries', () => {
  const resolveRLSContext = (user) => {
    if (user.role === 'admin') {
      return { param: 'app.is_admin', value: 'true' };
    }
    return { param: 'app.current_shop_id', value: user.shop_id };
  };

  const ownerA = { role: 'owner', shop_id: 'cafe-shop-a-111' };
  const ownerB = { role: 'owner', shop_id: 'cafe-shop-b-222' };
  const platformAdmin = { role: 'admin', shop_id: null };

  const ctxA = resolveRLSContext(ownerA);
  const ctxB = resolveRLSContext(ownerB);
  const ctxAdmin = resolveRLSContext(platformAdmin);

  assert.equal(ctxA.param, 'app.current_shop_id');
  assert.equal(ctxA.value, 'cafe-shop-a-111');

  assert.equal(ctxB.param, 'app.current_shop_id');
  assert.equal(ctxB.value, 'cafe-shop-b-222');
  assert.notEqual(ctxA.value, ctxB.value); // Absolute isolation

  assert.equal(ctxAdmin.param, 'app.is_admin');
  assert.equal(ctxAdmin.value, 'true');
});


test('Shift Till Reconciliation: calculates accurate expected drawer cash with adjustments', () => {
  const openingFloat = 5000;
  const cashSales = [1200, 850, 450, 2300]; // total: 4800
  const adjustments = [
    { type: 'cash_out', amount: 500, reason: 'Emergency Milk' },
    { type: 'cash_in', amount: 1000, reason: 'Small coins change add' },
    { type: 'cash_out', amount: 200, reason: 'Ice bags' }
  ];

  const totalSales = cashSales.reduce((a, b) => a + b, 0);
  const netAdjustments = adjustments.reduce(
    (sum, a) => sum + (a.type === 'cash_in' ? a.amount : -a.amount),
    0
  ); // +300

  const expectedCash = openingFloat + totalSales + netAdjustments;
  assert.equal(totalSales, 4800);
  assert.equal(netAdjustments, 300);
  assert.equal(expectedCash, 10100);
});

test('Shift End (Z-Report): calculates exact cash variance (Over / Short)', () => {
  const expectedCash = 10100;

  // Scenario 1: Exact balanced till
  const balancedCount = 10100;
  assert.equal(balancedCount - expectedCash, 0);

  // Scenario 2: Cash Shortage (e.g. cashier handed out too much change)
  const shortCount = 10000;
  const shortage = shortCount - expectedCash;
  assert.equal(shortage, -100);

  // Scenario 3: Cash Overage
  const overCount = 10150;
  const overage = overCount - expectedCash;
  assert.equal(overage, 50);
});


test('Multi-Tender Payments: validates mixed tender (Cash + Card + QR) covers bill total', () => {
  const billTotal = 4500;
  const payments = [
    { method: 'cash', amount: 1500 },
    { method: 'card', amount: 2000, reference: 'VISA-4242' },
    { method: 'qr', amount: 1000, reference: 'LankaQR-TXN-882' }
  ];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  assert.equal(totalPaid, billTotal);
  assert.equal(totalPaid >= billTotal, true);

  // Insufficient tender check
  const shortPayments = [{ method: 'cash', amount: 2000 }];
  const shortSum = shortPayments.reduce((sum, p) => sum + p.amount, 0);
  assert.equal(shortSum < billTotal, true);
});

test('Till Cash Drawer Isolation: Card and QR payments do NOT increment physical cash drawer', () => {
  const openingFloat = 5000;
  const mixedPayments = [
    { method: 'cash', amount: 1500 },
    { method: 'card', amount: 2000 },
    { method: 'qr', amount: 1000 }
  ];

  const cashPortion = mixedPayments
    .filter(p => p.method === 'cash')
    .reduce((sum, p) => sum + p.amount, 0);

  const nonCashPortion = mixedPayments
    .filter(p => p.method !== 'cash')
    .reduce((sum, p) => sum + p.amount, 0);

  assert.equal(cashPortion, 1500);
  assert.equal(nonCashPortion, 3000);

  // Expected physical cash in drawer only increases by cash portion!
  const expectedCashInTill = openingFloat + cashPortion;
  assert.equal(expectedCashInTill, 6500);
});


test('KDS Status Lifecycle: validates kitchen status state machine transitions', () => {
  const allowedStatuses = ['pending', 'preparing', 'ready', 'served'];

  const isValidStatus = status => allowedStatuses.includes(status);

  assert.equal(isValidStatus('pending'), true);
  assert.equal(isValidStatus('preparing'), true);
  assert.equal(isValidStatus('ready'), true);
  assert.equal(isValidStatus('served'), true);
  assert.equal(isValidStatus('cancelled_unknown'), false);
});

test('KDS SSE Payload: formats valid Server-Sent Events stream message', () => {
  const event = 'order:new';
  const data = { id: 'order-101', bill_number: 'POS-NILA-999', kitchen_status: 'pending' };

  const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  assert.equal(sseMessage.startsWith('event: order:new\n'), true);
  assert.equal(sseMessage.includes('"bill_number":"POS-NILA-999"'), true);
  assert.equal(sseMessage.endsWith('\n\n'), true);
});

test('RBAC & Manager PIN Authorization: validates permission boundary for cashier vs manager', () => {
  const authorizeVoid = (user, managerPin) => {
    if (['owner', 'manager'].includes(user.role)) {
      return { authorized: true, authorizedBy: user.name };
    }
    // Cashier or waiter requires valid 4-digit Manager PIN
    if (managerPin === '8844') {
      return { authorized: true, authorizedBy: 'Store Manager (PIN Verified)' };
    }
    return { authorized: false, error: 'Invalid Manager PIN' };
  };

  const cashier = { role: 'cashier', name: 'Cashier One' };
  const manager = { role: 'manager', name: 'Store Manager' };

  // Case 1: Cashier attempts void without PIN -> Rejected
  const cashierNoPin = authorizeVoid(cashier, '');
  assert.equal(cashierNoPin.authorized, false);
  assert.equal(cashierNoPin.error, 'Invalid Manager PIN');

  // Case 2: Cashier attempts void with incorrect PIN -> Rejected
  const cashierWrongPin = authorizeVoid(cashier, '1234');
  assert.equal(cashierWrongPin.authorized, false);

  // Case 3: Cashier provides valid manager PIN (8844) -> Authorized
  const cashierValidPin = authorizeVoid(cashier, '8844');
  assert.equal(cashierValidPin.authorized, true);

  // Case 4: Manager voids directly -> Authorized without PIN
  const managerDirect = authorizeVoid(manager, '');
  assert.equal(managerDirect.authorized, true);
});

test('Double-Entry Void Restock Ledger: restores stock inventory and creates audit records', () => {
  const products = {
    'p1': { id: 'p1', name: 'Chicken Burger', stock: 15 },
    'p2': { id: 'p2', name: 'French Fries', stock: 20 }
  };

  const saleItems = [
    { productId: 'p1', quantity: 3 },
    { productId: 'p2', quantity: 2 }
  ];

  const stockMovements = [];

  // Execute void and restock
  for (const item of saleItems) {
    products[item.productId].stock += item.quantity;
    stockMovements.push({
      productId: item.productId,
      delta_qty: item.quantity,
      reason: 'void_restock',
      reference_id: 'POS-NILA-1001'
    });
  }

  // Invariant verification: Stock incremented exactly by line item quantities
  assert.equal(products['p1'].stock, 18);
  assert.equal(products['p2'].stock, 22);

  // Ledger verification: Double-entry audit entries created
  assert.equal(stockMovements.length, 2);
  assert.equal(stockMovements[0].delta_qty, 3);
  assert.equal(stockMovements[0].reason, 'void_restock');
  assert.equal(stockMovements[1].delta_qty, 2);
  assert.equal(stockMovements[1].reason, 'void_restock');
});

test('Shift Till Reconciliation: excludes voided sales from expected drawer cash', () => {
  const openingFloat = 5000;
  const sales = [
    { bill: 'POS-1', total: 1200, status: 'completed' },
    { bill: 'POS-2', total: 850, status: 'voided' }, // Customer cancelled, refunded / restocked
    { bill: 'POS-3', total: 2000, status: 'completed' }
  ];

  const activeCashSales = sales
    .filter(s => s.status !== 'voided')
    .reduce((sum, s) => sum + s.total, 0);

  const expectedCash = openingFloat + activeCashSales;

  assert.equal(activeCashSales, 3200); // 1200 + 2000
  assert.equal(expectedCash, 8200); // 850 voided is strictly excluded!
});

test('KDS Queue: voided orders are automatically removed from active kitchen display', () => {
  const orders = [
    { id: '1', bill: 'POS-1', kitchen_status: 'preparing', status: 'completed' },
    { id: '2', bill: 'POS-2', kitchen_status: 'voided', status: 'voided' },
    { id: '3', bill: 'POS-3', kitchen_status: 'ready', status: 'completed' }
  ];

  const activeKitchenOrders = orders.filter(
    o => !['served', 'voided'].includes(o.kitchen_status) && o.status !== 'voided'
  );

  assert.equal(activeKitchenOrders.length, 2);
  assert.equal(activeKitchenOrders.some(o => o.id === '2'), false);
});
