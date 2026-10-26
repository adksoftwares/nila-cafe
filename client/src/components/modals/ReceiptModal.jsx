import React, { useState } from 'react';
import { X, Printer, ChefHat, ReceiptText } from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function ReceiptModal({ receipt, shopName, onClose }) {
  const [ticketView, setTicketView] = useState('customer'); // 'customer' | 'kot'

  if (!receipt) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal receipt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-heading" style={{ marginBottom: '12px' }}>
          <div>
            <span className="eyebrow">SALE COMPLETED</span>
            <h2>{ticketView === 'customer' ? 'Customer Receipt' : 'Kitchen Order Ticket (KOT)'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
          <button
            type="button"
            onClick={() => setTicketView('customer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              border: ticketView === 'customer' ? '1px solid var(--blue)' : '1px solid var(--line)',
              background: ticketView === 'customer' ? '#eef2ff' : '#fff',
              color: ticketView === 'customer' ? 'var(--blue)' : '#64748b'
            }}
          >
            <ReceiptText size={15} /> Customer Receipt
          </button>
          <button
            type="button"
            onClick={() => setTicketView('kot')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 600,
              border: ticketView === 'kot' ? '1px solid #d97706' : '1px solid var(--line)',
              background: ticketView === 'kot' ? '#fffbeb' : '#fff',
              color: ticketView === 'kot' ? '#b45309' : '#64748b'
            }}
          >
            <ChefHat size={15} /> Kitchen Ticket (KOT)
          </button>
        </div>

        {ticketView === 'customer' ? (
          /* CUSTOMER RECEIPT */
          <div className="receipt" id="receipt">
            <div className="receipt-brand">{shopName}</div>
            <p>Colombo, Sri Lanka</p>
            <div className="receipt-line">Bill: {receipt.bill_number}</div>
            <div className="receipt-line">Date: {new Date(receipt.created_at).toLocaleString()}</div>
            <div className="receipt-line">
              Order Type: {receipt.order_type.toUpperCase()}
              {receipt.table_number ? ` (${receipt.table_number})` : ''}
            </div>
            {receipt.customer_name && (
              <div className="receipt-line">
                Customer: <strong>{receipt.customer_name}</strong> {receipt.customer_phone ? `(${receipt.customer_phone})` : ''}
              </div>
            )}
            <hr />
            {receipt.items.map((i, k) => (
              <div key={k} style={{ margin: '8px 0' }}>
                <div className="receipt-item" style={{ margin: 0 }}>
                  <span>{i.name} × {i.qty}</span>
                  <span>{money(i.total)}</span>
                </div>
                {i.notes && (
                  <div style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', paddingLeft: '8px' }}>
                    * Note: {i.notes}
                  </div>
                )}
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
            {receipt.promotion_code && (
              <div className="receipt-item" style={{ fontSize: '10px', color: '#059669', margin: '2px 0' }}>
                <span>Promo Code</span>
                <span>{receipt.promotion_code}</span>
              </div>
            )}
            {receipt.points_redeemed > 0 && (
              <div className="receipt-item" style={{ fontSize: '10px', color: '#b45309', margin: '2px 0' }}>
                <span>Points Redeemed</span>
                <span>−{receipt.points_redeemed} pts</span>
              </div>
            )}
            {receipt.points_earned > 0 && (
              <div className="receipt-item" style={{ fontSize: '10px', color: '#16a34a', margin: '2px 0' }}>
                <span>⭐ Points Earned</span>
                <span>+{receipt.points_earned} pts</span>
              </div>
            )}
            <hr />
            <div style={{ fontSize: '10px', color: '#475569', marginBottom: '4px' }}>
              <strong>PAYMENTS & TENDER:</strong>
            </div>
            {receipt.payments && receipt.payments.length > 0 ? (
              receipt.payments.map((p, idx) => (
                <div className="receipt-item" key={idx} style={{ margin: '3px 0', fontSize: '10px' }}>
                  <span>
                    {p.method.toUpperCase()}
                    {p.reference ? ` (${p.reference})` : ''}
                  </span>
                  <span>{money(p.amount)}</span>
                </div>
              ))
            ) : (
              <div className="receipt-item" style={{ margin: '3px 0', fontSize: '10px' }}>
                <span>{receipt.payment_method ? receipt.payment_method.toUpperCase() : 'CASH'}</span>
                <span>{money(receipt.total)}</span>
              </div>
            )}
            {receipt.amount_received > receipt.total && (
              <div className="receipt-item" style={{ margin: '3px 0', fontSize: '10px', color: '#16a34a' }}>
                <span>Change Returned</span>
                <span>{money(receipt.amount_received - receipt.total)}</span>
              </div>
            )}
            <p className="receipt-thanks">Thank you for visiting Nila Cafe. Come again!</p>
          </div>
        ) : (
          /* KITCHEN ORDER TICKET (KOT) */
          <div className="receipt" id="receipt" style={{ background: '#fffef9', border: '2px dashed #e2e8f0' }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', letterSpacing: '1px' }}>
              *** KITCHEN ORDER (KOT) ***
            </div>
            <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>
              {shopName} — Barista / Chef Slip
            </div>
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
              <span>BILL: {receipt.bill_number}</span>
              <span>{new Date(receipt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ fontSize: '12px', marginTop: '6px', fontWeight: 'bold', color: '#1e293b' }}>
              MODE: {receipt.order_type.toUpperCase()}
              {receipt.table_number && (
                <span style={{ marginLeft: '8px', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                  {receipt.table_number}
                </span>
              )}
            </div>
            <hr />
            <div style={{ margin: '10px 0' }}>
              {receipt.items.map((i, k) => (
                <div key={k} style={{ marginBottom: '12px', borderBottom: '1px dotted #e2e8f0', paddingBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      {i.qty} × {i.name}
                    </strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>[{i.code || 'ITEM'}]</span>
                  </div>
                  {i.notes && (
                    <div style={{ marginTop: '4px', background: '#fee2e2', color: '#991b1b', padding: '3px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                      ⚠️ PREP NOTE: {i.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>Status: [  ] PREPARED</span>
              <span>Chef / Barista Signature: ________</span>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>
            Close
          </button>
          <button className="primary-btn" onClick={() => window.print()}>
            <Printer size={16} /> {ticketView === 'customer' ? 'Print Receipt' : 'Print KOT Slip'}
          </button>
        </div>
      </div>
    </div>
  );
}
