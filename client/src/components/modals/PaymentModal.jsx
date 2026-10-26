import React, { useState } from 'react';
import { X, DollarSign, CreditCard, QrCode, Users, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function PaymentModal({ total, onConfirmPayment, onClose }) {
  const [payMode, setPayMode] = useState('single'); // 'single' | 'split' | 'custom'

  // Single Tender State
  const [singleMethod, setSingleMethod] = useState('cash'); // 'cash' | 'card' | 'qr'
  const [cashTendered, setCashTendered] = useState(String(total));
  const [cardRef, setCardRef] = useState('');

  // Equal Split State
  const [splitCount, setSplitCount] = useState(2);
  const splitAmountPerPerson = Math.round((total / splitCount) * 100) / 100;
  const [guestPayments, setGuestPayments] = useState(() =>
    Array.from({ length: 2 }, (_, i) => ({ guest: `Guest ${i + 1}`, method: 'cash', amount: splitAmountPerPerson }))
  );

  // Custom Mixed Tender State
  const [customPayments, setCustomPayments] = useState([
    { method: 'cash', amount: Math.floor(total / 2) },
    { method: 'card', amount: Math.ceil(total / 2), reference: '' }
  ]);

  const tenderedNum = Number(cashTendered) || 0;
  const changeDue = Math.max(0, Math.round((tenderedNum - total) * 100) / 100);

  const handleUpdateSplitCount = (count) => {
    const c = Math.max(2, Math.min(10, count));
    setSplitCount(c);
    const perPerson = Math.round((total / c) * 100) / 100;
    setGuestPayments(
      Array.from({ length: c }, (_, i) => ({
        guest: `Guest ${i + 1}`,
        method: i % 2 === 0 ? 'cash' : 'card',
        amount: perPerson
      }))
    );
  };

  const handleUpdateGuestMethod = (index, method) => {
    setGuestPayments(prev =>
      prev.map((g, i) => (i === index ? { ...g, method } : g))
    );
  };

  const handleCustomPaymentChange = (index, field, value) => {
    setCustomPayments(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleAddCustomRow = () => {
    const currentSum = customPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const rem = Math.max(0, Math.round((total - currentSum) * 100) / 100);
    setCustomPayments([...customPayments, { method: 'qr', amount: rem, reference: '' }]);
  };

  const handleRemoveCustomRow = (index) => {
    if (customPayments.length <= 1) return;
    setCustomPayments(customPayments.filter((_, i) => i !== index));
  };

  const customTotalPaid = customPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const customRemaining = Math.round((total - customTotalPaid) * 100) / 100;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (payMode === 'single') {
      onConfirmPayment({
        payments: [
          {
            method: singleMethod,
            amount: total,
            reference: singleMethod === 'card' ? cardRef || 'VISA/MC' : singleMethod === 'qr' ? 'LankaQR-TXN' : null
          }
        ],
        amountReceived: singleMethod === 'cash' ? tenderedNum : total,
        primaryMethod: singleMethod
      });
    } else if (payMode === 'split') {
      onConfirmPayment({
        payments: guestPayments.map(g => ({
          method: g.method,
          amount: g.amount,
          reference: `Split-${g.guest}`
        })),
        amountReceived: total,
        primaryMethod: 'split'
      });
    } else if (payMode === 'custom') {
      if (customRemaining > 0.05) {
        alert(`Total payments (LKR ${customTotalPaid}) do not settle the bill of LKR ${total}.`);
        return;
      }
      onConfirmPayment({
        payments: customPayments.map(p => ({
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference || null
        })),
        amountReceived: customTotalPaid,
        primaryMethod: 'mixed'
      });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(100%, 520px)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-heading" style={{ marginBottom: '10px' }}>
          <div>
            <span className="eyebrow">CHECKOUT & TENDER</span>
            <h2>Select Payment Method</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        {/* Bill Total Display */}
        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <small style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>TOTAL AMOUNT DUE</small>
            <strong style={{ fontSize: '22px', color: 'var(--ink)' }}>{money(total)}</strong>
          </div>
          <span style={{ fontSize: '11px', background: '#eef2ff', color: 'var(--blue)', padding: '5px 9px', borderRadius: '6px', fontWeight: 600 }}>
            Ready to Tender
          </span>
        </div>

        {/* Payment Flow Modes Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
          <button
            type="button"
            className={payMode === 'single' ? 'secondary-btn active' : 'secondary-btn'}
            style={{ fontSize: '11px', background: payMode === 'single' ? '#eff2ff' : '#fff', borderColor: payMode === 'single' ? 'var(--blue)' : 'var(--line)' }}
            onClick={() => setPayMode('single')}
          >
            Full Tender
          </button>
          <button
            type="button"
            className={payMode === 'split' ? 'secondary-btn active' : 'secondary-btn'}
            style={{ fontSize: '11px', background: payMode === 'split' ? '#eff2ff' : '#fff', borderColor: payMode === 'split' ? 'var(--blue)' : 'var(--line)' }}
            onClick={() => setPayMode('split')}
          >
            Equal Split (Group)
          </button>
          <button
            type="button"
            className={payMode === 'custom' ? 'secondary-btn active' : 'secondary-btn'}
            style={{ fontSize: '11px', background: payMode === 'custom' ? '#eff2ff' : '#fff', borderColor: payMode === 'custom' ? 'var(--blue)' : 'var(--line)' }}
            onClick={() => setPayMode('custom')}
          >
            Mixed Tender (Custom)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 1. SINGLE FULL TENDER */}
          {payMode === 'single' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setSingleMethod('cash')}
                  style={{
                    padding: '12px 6px',
                    borderRadius: '8px',
                    border: singleMethod === 'cash' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                    background: singleMethod === 'cash' ? '#f0fdf4' : '#fff',
                    color: singleMethod === 'cash' ? '#166534' : '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  <DollarSign size={20} /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => setSingleMethod('card')}
                  style={{
                    padding: '12px 6px',
                    borderRadius: '8px',
                    border: singleMethod === 'card' ? '2px solid var(--blue)' : '1px solid #e2e8f0',
                    background: singleMethod === 'card' ? '#eff2ff' : '#fff',
                    color: singleMethod === 'card' ? 'var(--blue)' : '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  <CreditCard size={20} /> Card
                </button>
                <button
                  type="button"
                  onClick={() => setSingleMethod('qr')}
                  style={{
                    padding: '12px 6px',
                    borderRadius: '8px',
                    border: singleMethod === 'qr' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                    background: singleMethod === 'qr' ? '#f5f3ff' : '#fff',
                    color: singleMethod === 'qr' ? '#6d28d9' : '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  <QrCode size={20} /> LankaQR
                </button>
              </div>

              {singleMethod === 'cash' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Cash Tendered by Customer (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={total}
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    style={{ fontSize: '14px', fontWeight: 'bold' }}
                    required
                  />

                  {/* Fast Tender Suggestions */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {[total, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, 5000].filter(n => n >= total).map((amt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCashTendered(String(amt))}
                        style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
                      >
                        {money(amt)}
                      </button>
                    ))}
                  </div>

                  {changeDue > 0 && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>Change Due to Customer:</span>
                      <strong style={{ fontSize: '15px', color: '#047857' }}>{money(changeDue)}</strong>
                    </div>
                  )}
                </div>
              )}

              {singleMethod === 'card' && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Card Transaction / Auth Ref (Optional)</label>
                  <input
                    type="text"
                    value={cardRef}
                    onChange={e => setCardRef(e.target.value)}
                    placeholder="e.g. Visa ending 4242 / Auth #8839"
                  />
                  <small style={{ color: '#64748b', fontSize: '10px', marginTop: '4px', display: 'block' }}>
                    Swipe/Tap customer card on POS terminal, then confirm.
                  </small>
                </div>
              )}

              {singleMethod === 'qr' && (
                <div style={{ background: '#faf5ff', padding: '16px', borderRadius: '8px', border: '1px solid #e9d5ff', textAlign: 'center', marginBottom: '14px' }}>
                  <QrCode size={40} color="#7c3aed" style={{ margin: '0 auto 8px' }} />
                  <strong style={{ fontSize: '13px', color: '#581c87', display: 'block' }}>Scan with any Banking App (LankaQR)</strong>
                  <p style={{ fontSize: '11px', color: '#7e22ce', margin: '4px 0 0' }}>
                    Prompt customer to scan static cafe QR counter stand for {money(total)}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. EQUAL SPLIT BILL (GROUP) */}
          {payMode === 'split' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users size={15} /> Number of Guests:
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleUpdateSplitCount(n)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: splitCount === n ? '2px solid var(--blue)' : '1px solid #cbd5e1',
                        background: splitCount === n ? '#eef2ff' : '#fff',
                        fontWeight: 'bold',
                        fontSize: '11px'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '14px' }}>
                {guestPayments.map((g, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{g.guest}</span>
                    <strong style={{ fontSize: '12px' }}>{money(g.amount)}</strong>
                    <select
                      value={g.method}
                      onChange={e => handleUpdateGuestMethod(idx, e.target.value)}
                      style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="qr">LankaQR</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. CUSTOM MIXED TENDER */}
          {payMode === 'custom' && (
            <div>
              <div style={{ maxHeight: '170px', overflowY: 'auto', marginBottom: '10px' }}>
                {customPayments.map((p, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 24px', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                    <select
                      value={p.method}
                      onChange={e => handleCustomPaymentChange(idx, 'method', e.target.value)}
                      style={{ fontSize: '11px', height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="qr">LankaQR</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={p.amount}
                      onChange={e => handleCustomPaymentChange(idx, 'amount', e.target.value)}
                      placeholder="Amount"
                      style={{ height: '34px', fontSize: '11px' }}
                      required
                    />
                    <input
                      type="text"
                      value={p.reference || ''}
                      onChange={e => handleCustomPaymentChange(idx, 'reference', e.target.value)}
                      placeholder="Ref / Notes"
                      style={{ height: '34px', fontSize: '10px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomRow(idx)}
                      style={{ border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={handleAddCustomRow}
                  style={{ border: '1px dashed #cbd5e1', background: '#fff', fontSize: '10px', padding: '5px 9px', borderRadius: '6px', color: 'var(--blue)', fontWeight: 600 }}
                >
                  + Add Payment Line
                </button>
                <div style={{ fontSize: '11px' }}>
                  Remaining: <strong style={{ color: customRemaining === 0 ? '#16a34a' : '#e11d48' }}>{money(customRemaining)}</strong>
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              Complete Payment ({money(total)}) <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
