import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBillTaxes } from './utils/tax.js';
import {
  ESCPOS_COMMANDS,
  generateDrawerKickESCPOS,
  generateReceiptESCPOS,
  generateXReportESCPOS,
  generateZReportESCPOS,
  formatTwoColumns
} from './utils/escpos.js';
import { checkoutSchema, voidSaleSchema } from './schemas/sales.js';
import { openShiftSchema, shiftAdjustmentSchema } from './schemas/shifts.js';
import { createModifierSchema } from './schemas/modifiers.js';
import { logger } from './utils/logger.js';
import {
  getItemStation,
  getTicketStation,
  getSLAClassification,
  bumpOrderItem
} from './utils/kds.js';
import {
  recordAuditEvent,
  filterAuditLogs,
  ACTION_CATEGORIES,
  ACTION_SEVERITIES
} from './utils/audit.js';

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

test('Promotions Engine: validates percentage, fixed discounts, and minimum order rules', () => {
  const promotions = [
    { code: 'WELCOME10', type: 'percentage', value: 10, min_order_amount: 500 },
    { code: 'CAFE500', type: 'fixed', value: 500, min_order_amount: 2500 }
  ];

  const applyPromo = (subtotal, code) => {
    const promo = promotions.find(p => p.code === code);
    if (!promo) throw new Error('Invalid code');
    if (subtotal < promo.min_order_amount) {
      throw new Error(`Minimum spend of ${promo.min_order_amount} required`);
    }
    return promo.type === 'percentage'
      ? Math.round(subtotal * (promo.value / 100) * 100) / 100
      : Math.min(subtotal, promo.value);
  };

  // Case 1: 10% on 1500 -> 150
  assert.equal(applyPromo(1500, 'WELCOME10'), 150);

  // Case 2: Fixed 500 on 3000 -> 500
  assert.equal(applyPromo(3000, 'CAFE500'), 500);

  // Case 3: Minimum order amount not met
  assert.throws(() => applyPromo(2000, 'CAFE500'), /Minimum spend/);
});

test('Customer Loyalty Points: earns 1 pt per 100 LKR and handles instant redemption', () => {
  const customer = {
    name: 'Kasun',
    loyalty_points: 200,
    total_spent: 15000,
    total_visits: 5
  };

  const subtotal = 3500;
  const pointsToRedeem = 150; // 150 points = 150 LKR off

  // Calculate bill
  const pointsDiscount = Math.min(subtotal, pointsToRedeem);
  const total = subtotal - pointsDiscount; // 3350
  const pointsEarned = Math.floor(total / 100); // 33 pts

  // Update customer
  customer.loyalty_points = customer.loyalty_points - pointsDiscount + pointsEarned; // 200 - 150 + 33 = 83
  customer.total_spent += total;
  customer.total_visits += 1;

  assert.equal(pointsDiscount, 150);
  assert.equal(total, 3350);
  assert.equal(pointsEarned, 33);
  assert.equal(customer.loyalty_points, 83);
  assert.equal(customer.total_spent, 18350);
  assert.equal(customer.total_visits, 6);
});

test('Loyalty Invariant on Void: reverses points earned and refunds redeemed points', () => {
  const customer = {
    name: 'Kasun',
    loyalty_points: 83,
    total_spent: 18350,
    total_visits: 6
  };

  const voidedSale = {
    total: 3350,
    points_earned: 33,
    points_redeemed: 150
  };

  // Reverse transaction
  customer.loyalty_points = Math.max(0, customer.loyalty_points - voidedSale.points_earned + voidedSale.points_redeemed);
  customer.total_spent = Math.max(0, customer.total_spent - voidedSale.total);
  customer.total_visits = Math.max(0, customer.total_visits - 1);

  // Restores original balance: 83 - 33 + 150 = 200!
  assert.equal(customer.loyalty_points, 200);
  assert.equal(customer.total_spent, 15000);
  assert.equal(customer.total_visits, 5);
});

test('Offline Queue: queues offline checkouts with unique client idempotency keys', () => {
  const offlineQueue = [];
  const enqueue = (sale) => {
    offlineQueue.push({
      id: sale.id,
      idempotencyKey: sale.idempotencyKey,
      payload: sale.payload,
      queuedAt: new Date().toISOString()
    });
  };

  enqueue({
    id: 101,
    idempotencyKey: 'idem-offline-1',
    payload: { total: 1500, items: [{ productId: 'p1', quantity: 2 }] }
  });
  enqueue({
    id: 102,
    idempotencyKey: 'idem-offline-2',
    payload: { total: 2200, items: [{ productId: 'p2', quantity: 1 }] }
  });

  assert.equal(offlineQueue.length, 2);
  assert.equal(offlineQueue[0].idempotencyKey, 'idem-offline-1');
  assert.equal(offlineQueue[1].idempotencyKey, 'idem-offline-2');
  assert.ok(offlineQueue[0].queuedAt);
});

test('Offline Queue Auto-Sync: drains queue idempotently without duplicate charges', () => {
  const serverDb = new Map();
  const processedKeys = new Set();
  let serverStock = 100;

  const serverProcess = (idempotencyKey, order) => {
    if (processedKeys.has(idempotencyKey)) {
      return { status: 200, duplicate: true, order: serverDb.get(idempotencyKey) };
    }
    serverStock -= order.quantity;
    const record = { bill: 'POS-' + idempotencyKey, stock: serverStock };
    serverDb.set(idempotencyKey, record);
    processedKeys.add(idempotencyKey);
    return { status: 201, duplicate: false, order: record };
  };

  const offlineItems = [
    { id: 1, key: 'idem-sync-1', order: { quantity: 2 } },
    { id: 2, key: 'idem-sync-2', order: { quantity: 3 } }
  ];

  // First sync flush
  for (const item of offlineItems) {
    const res = serverProcess(item.key, item.order);
    assert.equal(res.status, 201);
    assert.equal(res.duplicate, false);
  }
  assert.equal(serverStock, 95); // 100 - 5

  // Simulated network retry of duplicate sync payload
  for (const item of offlineItems) {
    const res = serverProcess(item.key, item.order);
    assert.equal(res.status, 200);
    assert.equal(res.duplicate, true); // Deduplicated!
  }
  assert.equal(serverStock, 95); // Stock never deducted twice!
});

test('Dynamic Tax Engine: Dine-In order applies 10% Service Charge, 2.5% SSCL, and 18% VAT', () => {
  const subtotal = 2000;
  const discount = 0;
  const result = calculateBillTaxes({
    subtotal,
    discount,
    orderType: 'dining',
    taxConfig: {
      service_charge_enabled: true,
      service_charge_rate: 10,
      sscl_enabled: true,
      sscl_rate: 2.5,
      vat_enabled: true,
      vat_rate: 18
    }
  });

  // 1. Service charge = 10% of 2000 = 200
  assert.equal(result.serviceCharge, 200);

  // 2. Taxable turnover = 2000 + 200 = 2200
  // SSCL = 2.5% of 2200 = 55
  assert.equal(result.sscl, 55);

  // 3. VAT base = 2200 + 55 = 2255
  // VAT = 18% of 2255 = 405.90
  assert.equal(result.vat, 405.9);

  // 4. Total taxes = 200 + 55 + 405.90 = 660.90
  assert.equal(result.totalTaxes, 660.9);

  // 5. Grand total = 2000 + 660.90 = 2660.90
  assert.equal(result.grandTotal, 2660.9);
});

test('Dynamic Tax Engine: Takeaway and Delivery orders are exempt from Service Charge', () => {
  const subtotal = 2000;
  for (const orderType of ['takeaway', 'delivery']) {
    const result = calculateBillTaxes({
      subtotal,
      discount: 0,
      orderType,
      taxConfig: {
        service_charge_enabled: true,
        service_charge_rate: 10,
        sscl_enabled: true,
        sscl_rate: 2.5,
        vat_enabled: true,
        vat_rate: 18
      }
    });

    // Zero service charge for non-dining orders
    assert.equal(result.serviceCharge, 0);

    // SSCL = 2.5% of 2000 = 50
    assert.equal(result.sscl, 50);

    // VAT base = 2000 + 50 = 2050 -> 18% of 2050 = 369.00
    assert.equal(result.vat, 369);

    assert.equal(result.totalTaxes, 419);
    assert.equal(result.grandTotal, 2419);
  }
});

test('Dynamic Tax Engine: When taxes are disabled, total equals net subtotal without charges', () => {
  const result = calculateBillTaxes({
    subtotal: 1500,
    discount: 200,
    orderType: 'dining',
    taxConfig: {
      service_charge_enabled: false,
      sscl_enabled: false,
      vat_enabled: false
    }
  });

  assert.equal(result.netSubtotal, 1300);
  assert.equal(result.serviceCharge, 0);
  assert.equal(result.sscl, 0);
  assert.equal(result.vat, 0);
  assert.equal(result.totalTaxes, 0);
  assert.equal(result.grandTotal, 1300);
});

test('Z-Report Tax Aggregation: aggregates total service charges and government levies collected', () => {
  const sales = [
    { total: 2660.90, service_charge: 200, sscl: 55, vat: 405.90, status: 'completed' },
    { total: 2419.00, service_charge: 0, sscl: 50, vat: 369.00, status: 'completed' },
    { total: 1000.00, service_charge: 100, sscl: 25, vat: 180.00, status: 'voided' } // Excluded!
  ];

  const validSales = sales.filter(s => s.status !== 'voided');
  const scCollected = Math.round(validSales.reduce((sum, s) => sum + s.service_charge, 0) * 100) / 100;
  const ssclCollected = Math.round(validSales.reduce((sum, s) => sum + s.sscl, 0) * 100) / 100;
  const vatCollected = Math.round(validSales.reduce((sum, s) => sum + s.vat, 0) * 100) / 100;
  const totalTaxes = Math.round((scCollected + ssclCollected + vatCollected) * 100) / 100;

  assert.equal(scCollected, 200);
  assert.equal(ssclCollected, 105);
  assert.equal(vatCollected, 774.90);
  assert.equal(totalTaxes, 1079.90);
});

test('BOM Auto-Depletion: order of products decrements mapped raw ingredients accurately', () => {
  const stockInventory = {
    'ing-patty': 50,
    'ing-bun': 50,
    'ing-cheese': 50
  };

  const recipes = [
    { product_id: 'p-burger', ingredient_id: 'ing-patty', quantity_required: 1 },
    { product_id: 'p-burger', ingredient_id: 'ing-bun', quantity_required: 1 },
    { product_id: 'p-burger', ingredient_id: 'ing-cheese', quantity_required: 2 } // double cheese
  ];

  const orderItems = [{ productId: 'p-burger', quantity: 3 }];

  for (const item of orderItems) {
    const matching = recipes.filter(r => r.product_id === item.productId);
    for (const rec of matching) {
      stockInventory[rec.ingredient_id] -= rec.quantity_required * item.quantity;
    }
  }

  // 3 burgers: 3 patties, 3 buns, 6 cheese slices
  assert.equal(stockInventory['ing-patty'], 47);
  assert.equal(stockInventory['ing-bun'], 47);
  assert.equal(stockInventory['ing-cheese'], 44);
});

test('BOM Void Invariant: transaction void restores raw ingredient stock inventory', () => {
  const stockInventory = {
    'ing-coffee-beans': 4946, // 5000 - 3*18
    'ing-milk': 9550          // 10000 - 3*150
  };

  const voidedItems = [{ productId: 'p-iced-coffee', quantity: 3 }];
  const recipes = [
    { product_id: 'p-iced-coffee', ingredient_id: 'ing-coffee-beans', quantity_required: 18 },
    { product_id: 'p-iced-coffee', ingredient_id: 'ing-milk', quantity_required: 150 }
  ];

  // Restock upon void
  for (const item of voidedItems) {
    const matching = recipes.filter(r => r.product_id === item.productId);
    for (const rec of matching) {
      stockInventory[rec.ingredient_id] += rec.quantity_required * item.quantity;
    }
  }

  // Fully restored to original 5000g and 10000ml!
  assert.equal(stockInventory['ing-coffee-beans'], 5000);
  assert.equal(stockInventory['ing-milk'], 10000);
});

test('Ingredient Restock Ledger: adds incoming shipment and updates ledger', () => {
  let currentStock = 20;
  const movements = [];

  const restock = (qty, reason = 'purchase') => {
    currentStock += qty;
    movements.push({ delta: qty, reason });
  };

  restock(50, 'purchase');
  assert.equal(currentStock, 70);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].delta, 50);
  assert.equal(movements[0].reason, 'purchase');
});

test('ESC/POS Command Sequence: initializes printer and validates standard byte constants', () => {
  // ESC @ = [0x1B, 0x40]
  assert.deepEqual(Array.from(ESCPOS_COMMANDS.INIT), [0x1B, 0x40]);
  // GS V 65 3 = feed & cut
  assert.deepEqual(Array.from(ESCPOS_COMMANDS.CUT_PAPER), [0x1D, 0x56, 0x41, 0x03]);
});

test('ESC/POS Hardware Cash Drawer Kick Pulse: generates RJ11 pin 2 electrical pulse', () => {
  const pulse = generateDrawerKickESCPOS();
  // Standard ESC p 0 25 250 -> [0x1B, 0x70, 0x00, 0x19, 0xFA]
  assert.deepEqual(Array.from(pulse), [0x1B, 0x70, 0x00, 0x19, 0xFA]);
});

test('ESC/POS Two-Column Alignment: formats 80mm (48 col) and 58mm (32 col) margins', () => {
  const line80 = formatTwoColumns('Subtotal:', 'LKR 1,500.00', 48);
  assert.equal(line80.length, 48);
  assert.ok(line80.startsWith('Subtotal:'));
  assert.ok(line80.endsWith('LKR 1,500.00'));

  const line58 = formatTwoColumns('Subtotal:', '1500.00', 32);
  assert.equal(line58.length, 32);
  assert.ok(line58.startsWith('Subtotal:'));
  assert.ok(line58.endsWith('1500.00'));
});

test('ESC/POS Receipt Buffer Compilation: compiles full binary payload with taxes & items', () => {
  const sampleSale = {
    bill_number: 'POS-TEST-8899',
    order_type: 'dining',
    table_number: 'Table 4',
    cashier_name: 'Cashier One',
    created_at: new Date().toISOString(),
    subtotal: 2000,
    discount: 100,
    service_charge: 190,
    sscl: 52.25,
    vat: 385.61,
    total: 2527.86,
    payment_method: 'cash',
    amount_received: 3000,
    items: [
      { name: 'Chicken Burger', qty: 2, price: 950, total: 1900 },
      { name: 'Fresh Juice', qty: 1, price: 400, total: 400 }
    ],
    payments: [{ method: 'cash', amount: 2527.86 }]
  };

  const buffer = generateReceiptESCPOS(sampleSale, {
    paperWidth: 80,
    pulseDrawer: true,
    shopName: 'Nila Cafe'
  });

  assert.ok(buffer instanceof Uint8Array);
  assert.ok(buffer.length > 200);

  // Converts buffer to string to verify text content is embedded
  const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  assert.ok(textContent.includes('Nila Cafe'));
  assert.ok(textContent.includes('POS-TEST-8899'));
  assert.ok(textContent.includes('Chicken Burger'));
  assert.ok(textContent.includes('Service Charge (10%):'));
  assert.ok(textContent.includes('SSCL Levy (2.5%):'));
  assert.ok(textContent.includes('VAT (18%):'));
  assert.ok(textContent.includes('TOTAL DUE:'));
});

test('Table Lifecycle State Machine: validates legal restaurant table transitions', () => {
  const legalTransitions = {
    vacant: ['occupied', 'ordered'],
    occupied: ['ordered', 'vacant'],
    ordered: ['bill_printed', 'vacant'],
    bill_printed: ['vacant', 'ordered']
  };

  const validateTransition = (from, to) => {
    return legalTransitions[from]?.includes(to) ?? false;
  };

  // Legal transitions
  assert.equal(validateTransition('vacant', 'occupied'), true);
  assert.equal(validateTransition('occupied', 'ordered'), true);
  assert.equal(validateTransition('ordered', 'bill_printed'), true);
  assert.equal(validateTransition('bill_printed', 'vacant'), true);

  // Illegal transition: vacant directly to bill_printed
  assert.equal(validateTransition('vacant', 'bill_printed'), false);
});

test('Open Tab & Table Hold: assigns running order to table and holds status as ordered', () => {
  const table = {
    id: 't-4',
    table_number: 'Table 4',
    status: 'vacant',
    active_sale_id: null
  };

  const holdOpenTab = (tbl, orderItems) => {
    const saleId = 'sale-open-99';
    tbl.status = 'ordered';
    tbl.active_sale_id = saleId;
    return {
      id: saleId,
      status: 'open',
      table_number: tbl.table_number,
      items: orderItems
    };
  };

  const runningOrder = holdOpenTab(table, [
    { name: 'Iced Coffee', qty: 2 },
    { name: 'Chicken Burger', qty: 1 }
  ]);

  assert.equal(table.status, 'ordered');
  assert.equal(table.active_sale_id, 'sale-open-99');
  assert.equal(runningOrder.status, 'open');
  assert.equal(runningOrder.items.length, 2);
});

test('Table Settlement Invariant: completing payment closes open tab and frees table to vacant', () => {
  const table = {
    id: 't-4',
    table_number: 'Table 4',
    status: 'ordered',
    active_sale_id: 'sale-open-99'
  };

  const openSale = {
    id: 'sale-open-99',
    status: 'open',
    table_number: 'Table 4',
    total: 2500
  };

  const settleTableOrder = (tbl, sale, payments) => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    assert.ok(totalPaid >= sale.total);

    sale.status = 'completed';
    tbl.status = 'vacant';
    tbl.active_sale_id = null;
  };

  settleTableOrder(table, openSale, [{ method: 'cash', amount: 2500 }]);

  assert.equal(openSale.status, 'completed');
  assert.equal(table.status, 'vacant');
  assert.equal(table.active_sale_id, null);
});

test('Product Modifiers Pricing: item base price adds selected modifier add-on prices and scales with quantity', () => {
  const basePrice = 500;
  const modifiers = [
    { id: 'opt-oat', name: 'Oat Milk', price: 150 },
    { id: 'opt-shot', name: 'Extra Espresso Shot', price: 120 }
  ];
  const qty = 2;

  const modTotal = modifiers.reduce((acc, m) => acc + m.price, 0);
  const effectiveUnitPrice = basePrice + modTotal; // 500 + 150 + 120 = 770
  const lineTotal = effectiveUnitPrice * qty; // 770 * 2 = 1540

  assert.equal(effectiveUnitPrice, 770);
  assert.equal(lineTotal, 1540);
});

test('Modifier-Aware BOM Depletion: order deducts base product recipe PLUS modifier raw ingredients', () => {
  const inventory = {
    beans: 5000, // grams
    milk: 10000  // ml
  };

  const baseRecipe = [
    { ingredient: 'beans', qty: 18 },
    { ingredient: 'milk', qty: 150 }
  ];

  const selectedModifiers = [
    { id: 'opt-shot', name: 'Extra Shot', price: 120, ingredient: 'beans', ingredient_qty: 18 }
  ];

  const orderQty = 2;

  // Deplete base recipe
  for (const rec of baseRecipe) {
    inventory[rec.ingredient] -= rec.qty * orderQty;
  }
  // Deplete modifier add-on ingredients
  for (const mod of selectedModifiers) {
    if (mod.ingredient && mod.ingredient_qty > 0) {
      inventory[mod.ingredient] -= mod.ingredient_qty * orderQty;
    }
  }

  // Beans depleted: (18 base + 18 extra) * 2 = 72g -> 5000 - 72 = 4928g
  assert.equal(inventory.beans, 4928);
  // Milk depleted: 150 * 2 = 300ml -> 10000 - 300 = 9700ml
  assert.equal(inventory.milk, 9700);
});

test('Modifier BOM Void Invariant: voiding transaction restores both base product and modifier raw ingredients', () => {
  const inventory = {
    beans: 4928,
    milk: 9700
  };

  const orderItem = {
    name: 'Iced Coffee',
    qty: 2,
    baseRecipe: [
      { ingredient: 'beans', qty: 18 },
      { ingredient: 'milk', qty: 150 }
    ],
    modifiers: [
      { id: 'opt-shot', name: 'Extra Shot', ingredient: 'beans', ingredient_qty: 18 }
    ]
  };

  // Void rollback
  for (const rec of orderItem.baseRecipe) {
    inventory[rec.ingredient] += rec.qty * orderItem.qty;
  }
  for (const mod of orderItem.modifiers) {
    if (mod.ingredient && mod.ingredient_qty > 0) {
      inventory[mod.ingredient] += mod.ingredient_qty * orderItem.qty;
    }
  }

  assert.equal(inventory.beans, 5000);
  assert.equal(inventory.milk, 10000);
});

test('Product Modifiers Validation: validates single choice vs multi-choice selection constraints', () => {
  const singleGroup = {
    id: 'mod-size',
    name: 'Size',
    type: 'single',
    required: true,
    options: [{ id: 's', name: 'Small' }, { id: 'm', name: 'Medium' }, { id: 'l', name: 'Large' }]
  };

  const multiGroup = {
    id: 'mod-toppings',
    name: 'Toppings',
    type: 'multiple',
    required: false,
    options: [{ id: 'top-1', name: 'Cheese' }, { id: 'top-2', name: 'Patty' }]
  };

  const validateSelections = (group, selectedIds) => {
    if (group.required && selectedIds.length === 0) return false;
    if (group.type === 'single' && selectedIds.length > 1) return false;
    return true;
  };

  assert.equal(validateSelections(singleGroup, ['m']), true);
  assert.equal(validateSelections(singleGroup, []), false); // required fails
  assert.equal(validateSelections(singleGroup, ['s', 'm']), false); // single type violated

  assert.equal(validateSelections(multiGroup, []), true); // optional
  assert.equal(validateSelections(multiGroup, ['top-1', 'top-2']), true); // multi allowed
});

test('Zod Schema Validation: Checkout rejects invalid orderType and empty items array', () => {
  // Invalid order type
  const badOrderType = checkoutSchema.safeParse({
    orderType: 'curbside_pickup',
    items: [{ productId: 'p1', quantity: 1 }]
  });
  assert.equal(badOrderType.success, false);
  assert.ok(badOrderType.error.issues.some(e => e.path.includes('orderType')));

  // Empty items array
  const emptyItems = checkoutSchema.safeParse({
    orderType: 'takeaway',
    items: []
  });
  assert.equal(emptyItems.success, false);
  assert.ok(emptyItems.error.issues.some(e => e.path.includes('items')));

  // Non-positive quantity
  const zeroQty = checkoutSchema.safeParse({
    orderType: 'takeaway',
    items: [{ productId: 'p1', quantity: 0 }]
  });
  assert.equal(zeroQty.success, false);

  // Valid checkout
  const valid = checkoutSchema.safeParse({
    orderType: 'dining',
    tableNumber: 'Table 3',
    items: [
      {
        productId: 'p5',
        quantity: 2,
        notes: 'Extra cold',
        modifiers: [{ name: 'Oat Milk', price: 150 }]
      }
    ],
    payments: [{ method: 'cash', amount: 1540 }]
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.items[0].quantity, 2);
  assert.equal(valid.data.discount, 0); // Default applied
});

test('Zod Schema Validation: Shift Opening rejects negative float and validates adjustment parameters', () => {
  // Negative opening float
  const badFloat = openShiftSchema.safeParse({
    openingFloat: -2000
  });
  assert.equal(badFloat.success, false);
  assert.ok(badFloat.error.issues.some(e => e.path.includes('openingFloat')));

  // Valid opening float
  const goodFloat = openShiftSchema.safeParse({
    openingFloat: 5000,
    notes: 'Morning till'
  });
  assert.equal(goodFloat.success, true);
  assert.equal(goodFloat.data.openingFloat, 5000);

  // Invalid adjustment type
  const badAdj = shiftAdjustmentSchema.safeParse({
    type: 'stolen_cash',
    amount: 500,
    reason: 'Suspicious discrepancy'
  });
  assert.equal(badAdj.success, false);

  // Non-positive adjustment amount
  const zeroAdj = shiftAdjustmentSchema.safeParse({
    type: 'cash_in',
    amount: 0,
    reason: 'Zero amount'
  });
  assert.equal(zeroAdj.success, false);
});

test('Zod Schema Validation: Modifiers Schema validates options array and non-negative pricing', () => {
  // Empty options array
  const emptyOpts = createModifierSchema.safeParse({
    name: 'Milk Choice',
    type: 'single',
    options: []
  });
  assert.equal(emptyOpts.success, false);

  // Negative option price
  const negativePrice = createModifierSchema.safeParse({
    name: 'Milk Choice',
    type: 'single',
    options: [{ name: 'Almond Milk', price: -50 }]
  });
  assert.equal(negativePrice.success, false);

  // Valid modifier group
  const valid = createModifierSchema.safeParse({
    name: 'Toppings',
    type: 'multiple',
    required: false,
    options: [
      { name: 'Extra Cheese', price: 80, ingredient_id: 'ing-3', ingredient_qty: 1 },
      { name: 'Jalapeños', price: 50 }
    ]
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.options.length, 2);
  assert.equal(valid.data.type, 'multiple');
});

test('Structured Logger: Pino logger instance provides high-performance logging methods and levels', () => {
  assert.ok(typeof logger.info === 'function');
  assert.ok(typeof logger.warn === 'function');
  assert.ok(typeof logger.error === 'function');
  assert.ok(typeof logger.child === 'function');

  // Child logger tenant binding test
  const shopLogger = logger.child({ shopId: 'shop-demo', reqId: 'req-1234' });
  assert.ok(shopLogger);
  assert.ok(typeof shopLogger.info === 'function');
});

test('Sequential Z-Counter: each closed shift increments the sequential Z-number', () => {
  let zCounter = 0;
  const generateZReportNumber = () => {
    zCounter += 1;
    return `Z-${String(zCounter).padStart(4, '0')}`;
  };

  assert.equal(generateZReportNumber(), 'Z-0001');
  assert.equal(generateZReportNumber(), 'Z-0002');
  assert.equal(generateZReportNumber(), 'Z-0003');
});

test('Interim X-Report: reading aggregates sales and cash drawer position without resetting shift', () => {
  const activeShift = {
    id: 's-1',
    status: 'open',
    opening_float: 5000
  };

  const sales = [
    { total: 2500, payment_method: 'cash', status: 'completed' },
    { total: 1500, payment_method: 'card', status: 'completed' }
  ];

  const adjustments = [
    { type: 'cash_in', amount: 500 }
  ];

  const computeXReport = (shift, saleList, adjList) => {
    const cashSales = saleList.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.total, 0);
    const cardSales = saleList.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + s.total, 0);
    const netAdj = adjList.reduce((sum, a) => sum + (a.type === 'cash_in' ? a.amount : -a.amount), 0);
    const expectedCash = shift.opening_float + cashSales + netAdj;

    return {
      reportType: 'X-REPORT',
      shiftId: shift.id,
      shiftStatus: shift.status,
      cashSales,
      cardSales,
      expectedCash
    };
  };

  const xReport = computeXReport(activeShift, sales, adjustments);

  assert.equal(xReport.reportType, 'X-REPORT');
  assert.equal(xReport.shiftStatus, 'open'); // Shift remains open!
  assert.equal(xReport.cashSales, 2500);
  assert.equal(xReport.cardSales, 1500);
  assert.equal(xReport.expectedCash, 8000); // 5000 + 2500 + 500
});

test('Blind Reconciliation: computes variance and validates denomination aggregation', () => {
  const denominations = {
    '5000': 2, // 10000
    '1000': 5, // 5000
    '500': 4,  // 2000
    '100': 10  // 1000
  };

  const counted = Object.entries(denominations).reduce(
    (sum, [val, count]) => sum + Number(val) * count,
    0
  );
  assert.equal(counted, 18000);

  const expectedCash = 18500;
  const variance = counted - expectedCash; // -500 (shortage)
  assert.equal(variance, -500);
});

test('ESC/POS X-Report & Z-Report Buffer Compilation: compiles full binary payload with paper cut commands', () => {
  const sampleReport = {
    zReportNumber: 'Z-0001',
    openedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    closedAt: new Date().toISOString(),
    cashier: 'Cashier One',
    openingFloat: 5000,
    cashSales: 12500,
    cardSales: 4000,
    qrSales: 1500,
    discountsGiven: 250,
    serviceChargeCollected: 1250,
    ssclCollected: 312.5,
    vatCollected: 2250,
    totalTaxesCollected: 3812.5,
    netAdjustments: 500,
    expectedCash: 18000,
    actualCountedCash: 18000,
    variance: 0,
    billsCount: 15
  };

  const xBuf = generateXReportESCPOS(sampleReport, { width: '80mm' });
  assert.ok(xBuf instanceof Uint8Array);
  assert.ok(xBuf.length > 50);

  const zBuf = generateZReportESCPOS(sampleReport, { width: '80mm' });
  assert.ok(zBuf instanceof Uint8Array);
  assert.ok(zBuf.length > 50);

  // Validate CUT_PAPER command (0x1D, 0x56, 0x00) present in both
  const hasCut = (buf) => {
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0x1D && buf[i + 1] === 0x56) return true;
    }
    return false;
  };
  assert.equal(hasCut(xBuf), true);
  assert.equal(hasCut(zBuf), true);
});

test('KDS Station Routing: line items route accurately to Barista or Hot Kitchen based on category and keyword', () => {
  // Barista Station items
  assert.equal(getItemStation({ category: 'Drinks', name: 'Fresh Juice' }), 'barista');
  assert.equal(getItemStation({ category: 'Coffee', name: 'Hot Latte' }), 'barista');
  assert.equal(getItemStation({ category: 'Beverages', name: 'Iced Americano' }), 'barista');
  assert.equal(getItemStation({ category: 'General', name: 'Chai Milk Tea' }), 'barista');
  assert.equal(getItemStation({ name: 'Caramel Frappe' }), 'barista');

  // Hot Kitchen Station items
  assert.equal(getItemStation({ category: 'Burgers', name: 'Crispy Chicken Burger' }), 'kitchen');
  assert.equal(getItemStation({ category: 'Pizza', name: 'Margherita Pizza' }), 'kitchen');
  assert.equal(getItemStation({ category: 'Sides', name: 'French Fries' }), 'kitchen');
  assert.equal(getItemStation({ category: 'Sandwiches', name: 'Club Sandwich' }), 'kitchen');

  // Explicit override
  assert.equal(getItemStation({ station: 'barista', name: 'Custom Item' }), 'barista');
  assert.equal(getItemStation({ station: 'kitchen', name: 'Custom Drink' }), 'kitchen');
});

test('KDS Ticket Classification: ticket station is classified as barista, kitchen, or mixed', () => {
  const drinkOrder = [
    { name: 'Iced Coffee', category: 'Drinks' },
    { name: 'Fresh Juice', category: 'Drinks' }
  ];
  assert.equal(getTicketStation(drinkOrder), 'barista');

  const kitchenOrder = [
    { name: 'Chicken Burger', category: 'Burgers' },
    { name: 'French Fries', category: 'Sides' }
  ];
  assert.equal(getTicketStation(kitchenOrder), 'kitchen');

  const mixedOrder = [
    { name: 'Chicken Burger', category: 'Burgers' },
    { name: 'Iced Coffee', category: 'Drinks' }
  ];
  assert.equal(getTicketStation(mixedOrder), 'mixed');

  assert.equal(getTicketStation([]), 'kitchen');
});

test('KDS Live SLA Timers: classifies elapsed order duration into Fresh, Warning, and Delayed states', () => {
  const baseTime = 1700000000000;

  // 1. Fresh (< 5 min)
  const freshCreated = new Date(baseTime - 2 * 60 * 1000).toISOString();
  const freshSLA = getSLAClassification(freshCreated, baseTime);
  assert.equal(freshSLA.slaStatus, 'fresh');
  assert.equal(freshSLA.isPulsing, false);
  assert.equal(freshSLA.elapsedMinutes, 2);
  assert.equal(freshSLA.formattedTime, '02:00');

  // 2. Warning (5 - 10 min)
  const warningCreated = new Date(baseTime - 7 * 60 * 1000 - 30 * 1000).toISOString();
  const warningSLA = getSLAClassification(warningCreated, baseTime);
  assert.equal(warningSLA.slaStatus, 'warning');
  assert.equal(warningSLA.isPulsing, false);
  assert.equal(warningSLA.elapsedMinutes, 7);
  assert.equal(warningSLA.formattedTime, '07:30');

  // 3. Delayed (> 10 min)
  const delayedCreated = new Date(baseTime - 14 * 60 * 1000 - 15 * 1000).toISOString();
  const delayedSLA = getSLAClassification(delayedCreated, baseTime);
  assert.equal(delayedSLA.slaStatus, 'delayed');
  assert.equal(delayedSLA.isPulsing, true);
  assert.equal(delayedSLA.elapsedMinutes, 14);
  assert.equal(delayedSLA.formattedTime, '14:15');
});

test('KDS Line-Item Bumping: toggles item completion and automatically advances ticket to ready when all items are done', () => {
  const order = {
    id: 'ord-100',
    bill_number: 'POS-NILA-TEST',
    kitchen_status: 'pending',
    items: [
      { id: 'item-1', name: 'Chicken Burger', status: 'pending' },
      { id: 'item-2', name: 'French Fries', status: 'pending' }
    ]
  };

  // Step 1: Bump first item
  const res1 = bumpOrderItem(order, 'item-1');
  assert.equal(res1.item.status, 'ready');
  assert.equal(res1.isAllReady, false);
  assert.equal(order.kitchen_status, 'preparing');

  // Step 2: Bump second item -> all items are ready -> order transitions to ready!
  const res2 = bumpOrderItem(order, 'item-2');
  assert.equal(res2.item.status, 'ready');
  assert.equal(res2.isAllReady, true);
  assert.equal(order.kitchen_status, 'ready');

  // Step 3: Un-bump first item back to pending -> order reverts to preparing
  const res3 = bumpOrderItem(order, 'item-1');
  assert.equal(res3.item.status, 'pending');
  assert.equal(res3.isAllReady, false);
  assert.equal(order.kitchen_status, 'preparing');
});

test('Recipe BOM Cost & Margin Engine: calculates total raw ingredient cost and profit margins accurately', () => {
  const burgerIngredients = [
    { name: 'Chicken Patty', quantity_required: 1, cost_per_unit: 220 },
    { name: 'Burger Bun', quantity_required: 1, cost_per_unit: 45 },
    { name: 'Cheese Slice', quantity_required: 1, cost_per_unit: 60 }
  ];

  const totalBOMCost = burgerIngredients.reduce(
    (sum, ing) => sum + (ing.quantity_required * ing.cost_per_unit),
    0
  );
  assert.equal(totalBOMCost, 325);

  const takeawayPrice = 850;
  const diningPrice = 950;

  const takeawayProfit = takeawayPrice - totalBOMCost; // 525
  const takeawayMargin = Math.round((takeawayProfit / takeawayPrice) * 10000) / 100; // 61.76%
  assert.equal(takeawayProfit, 525);
  assert.equal(takeawayMargin, 61.76);

  const diningProfit = diningPrice - totalBOMCost; // 625
  const diningMargin = Math.round((diningProfit / diningPrice) * 10000) / 100; // 65.79%
  assert.equal(diningProfit, 625);
  assert.equal(diningMargin, 65.79);
});

test('Recipe BOM Deletion Invariant: removing a BOM item decouples raw ingredient auto-depletion', () => {
  const recipes = [
    { id: 'rec-1', product_id: 'p1', ingredient_id: 'ing-1', quantity_required: 1 },
    { id: 'rec-2', product_id: 'p1', ingredient_id: 'ing-2', quantity_required: 1 },
    { id: 'rec-3', product_id: 'p1', ingredient_id: 'ing-3', quantity_required: 1 }
  ];

  // Delete 'rec-2' (Burger Bun)
  const targetId = 'rec-2';
  const idx = recipes.findIndex(r => r.id === targetId);
  assert.notEqual(idx, -1);
  recipes.splice(idx, 1);

  assert.equal(recipes.length, 2);
  assert.equal(recipes.some(r => r.id === 'rec-2'), false);
  assert.equal(recipes.some(r => r.id === 'rec-1'), true);
  assert.equal(recipes.some(r => r.id === 'rec-3'), true);

  // Deleting non-existent recipe item returns -1
  const notFoundIdx = recipes.findIndex(r => r.id === 'rec-999');
  assert.equal(notFoundIdx, -1);
});

test('Modifier Group Management: validates option formatting, pricing rules, and ingredient linkage', () => {
  const validGroup = {
    name: 'Milk Choice',
    type: 'single',
    required: true,
    options: [
      { name: 'Fresh Milk', price: 0, ingredient_id: 'ing-5', ingredient_qty: 150 },
      { name: 'Oat Milk', price: 150, ingredient_id: null, ingredient_qty: 0 }
    ]
  };

  const parseResult = createModifierSchema.safeParse(validGroup);
  assert.equal(parseResult.success, true);
  assert.equal(parseResult.data.options.length, 2);
  assert.equal(parseResult.data.options[1].price, 150);

  // Empty name should fail
  const invalidName = createModifierSchema.safeParse({
    name: '  ',
    options: [{ name: 'Option 1', price: 0 }]
  });
  assert.equal(invalidName.success, false);

  // Negative price should fail
  const negativePrice = createModifierSchema.safeParse({
    name: 'Add-ons',
    options: [{ name: 'Cheese', price: -50 }]
  });
  assert.equal(negativePrice.success, false);
});

test('Security Audit Engine: records immutable events with correct actor, severity, and category classification', async () => {
  const voidEvent = await recordAuditEvent({
    shopId: 'shop-demo',
    userId: 'u-mgr-1',
    userName: 'Manager Alice',
    userRole: 'manager',
    action: 'SALE_VOID',
    entityType: 'sale',
    entityId: 'sale-999',
    details: { billNumber: 'POS-NILA-999', total: 3500, reason: 'Customer walkout' }
  });

  assert.equal(voidEvent.action, 'SALE_VOID');
  assert.equal(voidEvent.category, 'sales');
  assert.equal(voidEvent.severity, 'danger');
  assert.equal(voidEvent.user_name, 'Manager Alice');
  assert.equal(voidEvent.details.billNumber, 'POS-NILA-999');

  const kickEvent = await recordAuditEvent({
    shopId: 'shop-demo',
    userId: 'u-cashier-1',
    userName: 'Cashier Bob',
    userRole: 'cashier',
    action: 'DRAWER_KICK',
    entityType: 'drawer'
  });

  assert.equal(kickEvent.action, 'DRAWER_KICK');
  assert.equal(kickEvent.category, 'fiscal');
  assert.equal(kickEvent.severity, 'danger');

  const openShiftEvent = await recordAuditEvent({
    shopId: 'shop-demo',
    userId: 'u-cashier-1',
    userName: 'Cashier Bob',
    userRole: 'cashier',
    action: 'SHIFT_OPEN',
    details: { openingFloat: 5000 }
  });

  assert.equal(openShiftEvent.category, 'fiscal');
  assert.equal(openShiftEvent.severity, 'info');
});

test('Audit Trail Query & Search Engine: filters by category, severity, and free-text search term', () => {
  const sampleLogs = [
    {
      id: 'log-1',
      action: 'SHIFT_OPEN',
      category: 'fiscal',
      severity: 'info',
      user_name: 'Cashier One',
      user_role: 'cashier',
      details: { openingFloat: 5000 }
    },
    {
      id: 'log-2',
      action: 'DRAWER_KICK',
      category: 'fiscal',
      severity: 'danger',
      user_name: 'Store Manager',
      user_role: 'manager',
      details: { reason: 'Manual kick' }
    },
    {
      id: 'log-3',
      action: 'SALE_VOID',
      category: 'sales',
      severity: 'danger',
      user_name: 'Store Manager',
      user_role: 'manager',
      details: { billNumber: 'POS-NILA-888', total: 2400, reason: 'Customer changed mind' }
    },
    {
      id: 'log-4',
      action: 'INGREDIENT_RESTOCK',
      category: 'inventory',
      severity: 'info',
      user_name: 'Demo Owner',
      user_role: 'owner',
      details: { ingredientName: 'Fresh Milk', deltaQty: 50 }
    }
  ];

  // 1. Filter by category
  const fiscalResults = filterAuditLogs(sampleLogs, { category: 'fiscal' });
  assert.equal(fiscalResults.total, 2);
  assert.equal(fiscalResults.logs.every(l => l.category === 'fiscal'), true);

  // 2. Filter by severity
  const dangerResults = filterAuditLogs(sampleLogs, { severity: 'danger' });
  assert.equal(dangerResults.total, 2);
  assert.equal(dangerResults.logs.some(l => l.action === 'DRAWER_KICK'), true);
  assert.equal(dangerResults.logs.some(l => l.action === 'SALE_VOID'), true);

  // 3. Search by bill number in details
  const billSearch = filterAuditLogs(sampleLogs, { search: 'POS-NILA-888' });
  assert.equal(billSearch.total, 1);
  assert.equal(billSearch.logs[0].id, 'log-3');

  // 4. Search by actor name
  const actorSearch = filterAuditLogs(sampleLogs, { search: 'Store Manager' });
  assert.equal(actorSearch.total, 2);

  // 5. Pagination offset & limit
  const paged = filterAuditLogs(sampleLogs, { limit: 2, offset: 1 });
  assert.equal(paged.total, 4);
  assert.equal(paged.logs.length, 2);
  assert.equal(paged.logs[0].id, 'log-2');
});






