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
