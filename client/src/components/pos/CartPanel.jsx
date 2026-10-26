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
  FileText
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
  onCheckout,
  checkoutSubmitting = false
}) {
  const [activeNoteItemId, setActiveNoteItemId] = useState(null);

  const unitPrice = p =>
    Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);

  const subtotal = cart.reduce((s, i) => s + unitPrice(i.product) * i.qty, 0);

  const billDiscount = Math.min(
    subtotal,
    discountMode === 'percent'
      ? (subtotal * Math.max(0, Math.min(100, Number(discount) || 0))) / 100
      : Math.max(0, Number(discount) || 0)
  );

  const total = Math.max(0, subtotal - billDiscount);
  const totalItemCount = cart.reduce((s, i) => s + i.qty, 0);

  const orderTypes = [
    { id: 'takeaway', label: 'Takeaway', Icon: ShoppingBag },
    { id: 'delivery', label: 'Delivery', Icon: Truck },
    { id: 'dining', label: 'Dining', Icon: Utensils }
  ];

  return (
    <aside className="cart-panel">
      <div className="cart-header">
        <div>
          <h2>Current Order</h2>
          <p>Build customer sale</p>
        </div>
        <span className="cart-count">{totalItemCount} items</span>
      </div>

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

      {orderType === 'dining' && (
        <div style={{ padding: '10px 16px', background: '#f8fafd', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

              {/* Note / Modifier Section */}
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
          <div className="cart-discount">
            <label>Bill Discount</label>
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

          <div className="cart-totals">
            <div>
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            {billDiscount > 0 && (
              <div>
                <span>Bill Discount</span>
                <strong className="discount-text">−{money(billDiscount)}</strong>
              </div>
            )}
            <div className="grand-total">
              <span>Total Due</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <button
            className="checkout-btn"
            disabled={checkoutSubmitting}
            style={{ opacity: checkoutSubmitting ? 0.7 : 1, cursor: checkoutSubmitting ? 'not-allowed' : 'pointer' }}
            onClick={() => onCheckout({ subtotal, billDiscount, total })}
          >
            {checkoutSubmitting ? 'Processing Order…' : `Charge ${money(total)}`} <ArrowDownRight size={17} />
          </button>

          <div className="secure-note">
            <ShieldCheck size={13} />
            Prices and inventory calculations verified automatically
          </div>
        </>
      )}
    </aside>
  );
}
