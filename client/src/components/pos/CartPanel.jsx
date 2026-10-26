import React from 'react';
import {
  ShoppingBag,
  Truck,
  Utensils,
  ShoppingCart,
  Minus,
  Plus,
  X,
  ArrowDownRight,
  ShieldCheck
} from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function CartPanel({
  orderType,
  setOrderType,
  cart,
  onChangeQty,
  onRemoveItem,
  discount,
  setDiscount,
  discountMode,
  setDiscountMode,
  onCheckout
}) {
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
            <div className="cart-item" key={i.product.id}>
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
            onClick={() => onCheckout({ subtotal, billDiscount, total })}
          >
            Charge {money(total)} <ArrowDownRight size={17} />
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
