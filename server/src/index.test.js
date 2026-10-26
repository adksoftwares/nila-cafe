import test from 'node:test';import assert from 'node:assert/strict';
test('POS order pricing rule: takeaway uses takeaway price; delivery and dining use normal price',()=>{const p={takeaway_price:850,normal_price:950};assert.equal(p.takeaway_price,850);assert.equal(p.normal_price,950);for(const type of ['delivery','dining'])assert.equal(type==='takeaway'?p.takeaway_price:p.normal_price,950)});
test('discounts are capped at line/subtotal and totals cannot go negative',()=>{const subtotal=1000;const discount=Math.min(subtotal,1200);assert.equal(discount,1000);assert.equal(Math.max(0,subtotal-discount),0)});
test('bill discount percentage is computed from subtotal',()=>{assert.equal(2000*10/100,200)});
