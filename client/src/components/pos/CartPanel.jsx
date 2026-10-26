import React, { useState } from 'react';
import {
  ShoppingBag,
  Truck,
  Utensils,
  ShoppingCart,
  Minus,
  Plus,
  X,
  ArrowDownRight,
  ShieldCheck,
  FileText,
  User,
  Star,
  Tag,
  Check
} from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function CartPanel({
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  cart,
  onChangeQty,
  onChangeNotes,
  onRemoveItem,
  discount,
  setDiscount,
  discountMode,
  setDiscountMode,
  customers = [],
  selectedCustomer,
  setSelectedCustomer,
  pointsToRedeem = 0,
  setPointsToRedeem,
  appliedPromotion,
  setAppliedPromotion,
  promotions = [],
  onOpenAddCustomer,
  onCheckout,
  checkoutSubmitting = false
}) {
  const [activeNoteItemId, setActiveNoteItemId] = useState(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');

  const unitPrice = p =>
    Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);

  const subtotal = cart.reduce((s, i) => s + unitPrice(i.product) * i.qty, 0);

  // 1. Manual Discount
  const manualDiscount = Math.min(
    subtotal,
    discountMode === 'percent'
      ? (subtotal * Math.max(0, Math.min(100, Number(discount) || 0))) / 100
      : Math.max(0, Number(discount) || 0)
  );

  // 2. Promotion Code Discount
  let promoDiscount = 0;
  if (appliedPromotion) {
    if (subtotal >= appliedPromotion.min_order_amount) {
      promoDiscount = appliedPromotion.type === 'percentage'
        ? Math.round(subtotal * (appliedPromotion.value / 100) * 100) / 100
        : Math.min(subtotal, appliedPromotion.value);
    }
  }

  // 3. Loyalty Points Discount
  const pointsDiscount = Math.min(
    Math.max(0, subtotal - manualDiscount - promoDiscount),
    Number(pointsToRedeem) || 0
  );

  const totalDiscount = Math.round(Math.min(subtotal, manualDiscount + promoDiscount + pointsDiscount) * 100) / 100;
  const total = Math.round(Math.max(0, subtotal - totalDiscount) * 100) / 100;
  const totalItemCount = cart.reduce((s, i) => s + i.qty, 0);
  const pointsToEarn = selectedCustomer ? Math.floor(total / 100) : 0;

  const orderTypes = [
    { id: 'takeaway', label: 'Takeaway', Icon: ShoppingBag },
    { id: 'delivery', label: 'Delivery', Icon: Truck },
    { id: 'dining', label: 'Dining', Icon: Utensils }
  ];

  const handleApplyPromo = () => {
    setPromoError('');
    const clean = promoInput.trim().toUpperCase();
    if (!clean) return;

    const promo = promotions.find(p => p.code === clean && p.active);
    if (!promo) {
      setPromoError(`Invalid or inactive promo code "${clean}"`);
      return;
    }

    if (subtotal < promo.min_order_amount) {
      setPromoError(`Minimum spend of LKR ${promo.min_order_amount} required`);
      return;
    }

    setAppliedPromotion(promo);
    setPromoInput('');
  };

  return (
    <aside className="cart-panel">
      <div className="cart-header">
        <div>
          <h2>Current Order</h2>
          <p>Build customer sale</p>
        </div>
        <span className="cart-count">{totalItemCount} items</span>
      </div>

      {/* Order Type Toggle */}
      <div className="order-types">
        {orderTypes.map(t => (
          <button
            key={t.id}
            className={orderType === t.id ? 'order-type selected' : 'order-type'}
            onClick={() => setOrderType(t.id)}
          >
            <t.Icon size={17} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Dining Table Selection */}
      {orderType === 'dining' && (
        <div style={{ padding: '8px 14px', background: '#f8fafd', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink)' }}>Table / Seat #:</label>
          <select
            value={tableNumber}
            onChange={e => setTableNumber(e.target.value)}
            style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'Balcony 1', 'Balcony 2', 'VIP Lounge'].map(num => (
              <option key={num} value={`Table ${num}`}>
                Table {num}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Customer Loyalty Attachment Bar */}
      <div style={{ padding: '8px 14px', background: selectedCustomer ? '#f0f9ff' : '#fafafa', borderBottom: '1px solid var(--line)', fontSize: '11px' }}>
        {selectedCustomer ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={13} color="#0284c7" />
              <strong>{selectedCustomer.name}</strong>
              <span style={{ color: '#64748b' }}>({selectedCustomer.phone})</span>
              <span className="pill" style={{ background: '#fef3c7', color: '#b45309', padding: '1px 6px', fontSize: '10px' }}>
                ⭐ {selectedCustomer.loyalty_points || 0} pts
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCustomer(null);
                setPointsToRedeem(0);
              }}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              title="Detach customer"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={13} color="#64748b" />
            <select
              value=""
              onChange={e => {
                const found = customers.find(c => c.id === e.target.value);
                if (found) {
                  setSelectedCustomer(found);
                  setPointsToRedeem(0);
                }
              }}
              style={{ flex: 1, fontSize: '11px', padding: '3px 6px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}
            >
              <option value="">Attach Customer (Loyalty Points)...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) — {c.loyalty_points || 0} pts
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenAddCustomer}
              style={{ fontSize: '10px', padding: '3px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
            >
              + New
            </button>
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="cart-list">
        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="empty-bag">
              <ShoppingCart size={24} />
            </div>
            <strong>Your order is empty</strong>
            <p>Select products from the catalog to get started.</p>
          </div>
        ) : (
          cart.map(i => (
            <div className="cart-item" key={i.product.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', width: '100%' }}>
                <div className="item-icon">{i.product.name[0]}</div>
                <div className="item-details">
                  <strong>{i.product.name}</strong>
                  <small>{money(unitPrice(i.product))} each</small>
                  <div className="qty-control">
                    <button onClick={() => onChangeQty(i.product.id, i.qty - 1)}>
                      <Minus size={12} />
                    </button>
                    <input
                      aria-label="Quantity"
                      type="number"
                      min="1"
                      value={i.qty}
                      onChange={e => onChangeQty(i.product.id, e.target.value)}
                    />
                    <button onClick={() => onChangeQty(i.product.id, i.qty + 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="item-right">
                  <strong>{money(unitPrice(i.product) * i.qty)}</strong>
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveItem(i.product.id)}
                    title="Remove item"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Kitchen Note / Modifier */}
              <div style={{ marginTop: '6px', paddingLeft: '43px' }}>
                {activeNoteItemId === i.product.id ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="e.g. Less sugar, Oat milk, Extra hot"
                      value={i.notes || ''}
                      onChange={e => onChangeNotes(i.product.id, e.target.value)}
                      style={{ fontSize: '10px', height: '24px', padding: '0 6px', border: '1px solid #cbd5e1', borderRadius: '4px', flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setActiveNoteItemId(null)}
                      style={{ fontSize: '9px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f1f5f9', padding: '3px 6px' }}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      onClick={() => setActiveNoteItemId(i.product.id)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: i.notes ? '#3b82f6' : '#94a3b8',
                        fontSize: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0
                      }}
                    >
                      <FileText size={11} />
                      {i.notes ? `Note: "${i.notes}"` : '+ Add kitchen note'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <>
          {/* Discounts & Promotions Section */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Manual Discount */}
            <div className="cart-discount" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>Bill Discount</label>
              <div className="discount-input">
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
                <select
                  value={discountMode}
                  onChange={e => setDiscountMode(e.target.value)}
                >
                  <option value="percent">%</option>
                  <option value="amount">LKR</option>
                </select>
              </div>
            </div>

            {/* Promo Code Input */}
            <div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  placeholder="Promo Code (e.g. WELCOME10)"
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value.toUpperCase())}
                  style={{ flex: 1, fontSize: '11px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  style={{ fontSize: '11px', padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                >
                  Apply
                </button>
              </div>
              {promoError && (
                <div style={{ fontSize: '10px', color: '#dc2626', marginTop: 3 }}>
                  {promoError}
                </div>
              )}
              {appliedPromotion && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '4px 8px', borderRadius: 4, fontSize: '11px', color: '#065f46' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Tag size={12} />
                    <span>Promo: <strong>{appliedPromotion.code}</strong> ({appliedPromotion.title})</span>
                  </span>
                  <button type="button" onClick={() => setAppliedPromotion(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#065f46', fontWeight: 'bold' }}>×</button>
                </div>
              )}
            </div>

            {/* Loyalty Points Redemption (If customer attached) */}
            {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#92400e' }}>
                    <input
                      type="checkbox"
                      checked={pointsToRedeem > 0}
                      onChange={e => {
                        if (e.target.checked) {
                          const maxRedeem = Math.min(selectedCustomer.loyalty_points, Math.max(0, subtotal - manualDiscount - promoDiscount));
                          setPointsToRedeem(maxRedeem);
                        } else {
                          setPointsToRedeem(0);
                        }
                      }}
                    />
                    <strong>Redeem Loyalty Points</strong>
                  </label>
                  <span style={{ fontSize: '11px', color: '#b45309' }}>
                    {selectedCustomer.loyalty_points} pts available
                  </span>
                </div>
                {pointsToRedeem > 0 && (
                  <div style={{ fontSize: '10px', color: '#16a34a', marginTop: 3, fontWeight: 600 }}>
                    ✓ Applied: −{money(pointsDiscount)} ({pointsToRedeem} points redeemed)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="cart-totals">
            <div>
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>

            {manualDiscount > 0 && (
              <div>
                <span>Manual Discount</span>
                <strong className="discount-text">−{money(manualDiscount)}</strong>
              </div>
            )}

            {promoDiscount > 0 && (
              <div>
                <span>Promo ({appliedPromotion?.code})</span>
                <strong className="discount-text">−{money(promoDiscount)}</strong>
              </div>
            )}

            {pointsDiscount > 0 && (
              <div>
                <span>Points Redeemed</span>
                <strong className="discount-text">−{money(pointsDiscount)}</strong>
              </div>
            )}

            <div className="grand-total">
              <div>
                <span>Total Due</span>
                {selectedCustomer && (
                  <small style={{ display: 'block', fontSize: 10, color: '#16a34a', fontWeight: 'normal' }}>
                    ⭐ +{pointsToEarn} pts will be earned
                  </small>
                )}
              </div>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <button
            className="checkout-btn"
            disabled={checkoutSubmitting}
            style={{ opacity: checkoutSubmitting ? 0.7 : 1, cursor: checkoutSubmitting ? 'not-allowed' : 'pointer' }}
            onClick={() => onCheckout({
              subtotal,
              billDiscount: totalDiscount,
              total,
              customerId: selectedCustomer ? selectedCustomer.id : null,
              customerName: selectedCustomer ? selectedCustomer.name : null,
              customerPhone: selectedCustomer ? selectedCustomer.phone : null,
              pointsEarned: pointsToEarn,
              pointsRedeemed: pointsDiscount,
              promotionCode: appliedPromotion ? appliedPromotion.code : null
            })}
          >
            {checkoutSubmitting ? 'Processing Order…' : `Charge ${money(total)}`} <ArrowDownRight size={17} />
          </button>

          <div className="secure-note">
            <ShieldCheck size={13} />
            Prices, discounts, and inventory verified automatically
          </div>
        </>
      )}
    </aside>
  );
}
