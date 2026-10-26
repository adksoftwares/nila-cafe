import React from 'react';
import { X, Printer } from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function ReceiptModal({ receipt, shopName, onClose }) {
  if (!receipt) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal receipt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">SALE COMPLETED</span>
            <h2>Receipt Preview</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className="receipt" id="receipt">
          <div className="receipt-brand">{shopName}</div>
          <p>Colombo, Sri Lanka</p>
          <div className="receipt-line">Bill: {receipt.bill_number}</div>
          <div className="receipt-line">Date: {new Date(receipt.created_at).toLocaleString()}</div>
          <div className="receipt-line">Order Type: {receipt.order_type.toUpperCase()}</div>
          <hr />
          {receipt.items.map((i, k) => (
            <div className="receipt-item" key={k}>
              <span>{i.name} × {i.qty}</span>
              <span>{money(i.total)}</span>
            </div>
          ))}
          <hr />
          <div className="receipt-item">
            <span>Subtotal</span>
            <span>{money(receipt.subtotal)}</span>
          </div>
          <div className="receipt-item">
            <span>Discount</span>
            <span>−{money(receipt.discount)}</span>
          </div>
          <div className="receipt-item receipt-total">
            <strong>TOTAL</strong>
            <strong>{money(receipt.total)}</strong>
          </div>
          <p className="receipt-thanks">Thank you for visiting Nila Cafe. Come again!</p>
        </div>

        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>
            Close
          </button>
          <button className="primary-btn" onClick={() => window.print()}>
            <Printer size={16} /> Print receipt
          </button>
        </div>
      </div>
    </div>
  );
}
