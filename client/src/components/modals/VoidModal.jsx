import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, KeyRound } from 'lucide-react';
import { money } from '../../utils/formatters.js';

const COMMON_REASONS = [
  'Customer cancelled before preparation',
  'Cashier input mistake / wrong items',
  'Customer payment failure / declined',
  'Food quality issue / return',
  'Duplicate bill entry',
  'Other (specify below)'
];

export default function VoidModal({ sale, user, onConfirmVoid, onClose }) {
  const [reasonCategory, setReasonCategory] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!sale) return null;

  const isManager = ['owner', 'manager', 'admin'].includes(user?.role);
  const finalReason = reasonCategory === 'Other (specify below)' ? customReason.trim() : reasonCategory;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!finalReason) {
      setError('Please provide a reason for voiding this transaction.');
      return;
    }

    if (!isManager && !managerPin.trim()) {
      setError('Manager Security PIN is required for cashier void authorization.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirmVoid({
        saleId: sale.id,
        reason: finalReason,
        managerPin: managerPin.trim()
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to void transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box void-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3>Void Order Authorization</h3>
              <span className="muted">Bill #{sale.bill_number}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Box */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 13
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Order Type:</span>
              <span className="pill" style={{ textTransform: 'capitalize' }}>
                {sale.order_type} {sale.table_number ? `(${sale.table_number})` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Amount:</span>
              <strong style={{ fontSize: 15, color: '#0f172a' }}>{money(sale.total)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Items ({sale.items?.length || 0}):</span>
              <span style={{ maxWidth: 260, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sale.items?.map(i => `${i.qty || i.quantity || 1}x ${i.name}`).join(', ') || 'N/A'}
              </span>
            </div>
          </div>

          {/* Warning Banner */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '10px 12px',
            display: 'flex',
            gap: 10,
            fontSize: 12,
            color: '#92400e',
            lineHeight: 1.4
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              Voiding cancels this receipt, <strong>restores item stock back to inventory</strong>, deducts the sale from shift cash reconciliation, and writes to the audit log.
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
              Reason for Void <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={e => setReasonCategory(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
            >
              {COMMON_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {reasonCategory === 'Other (specify below)' && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                Specific Reason Note
              </label>
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Explain why this order is being voided..."
                rows={2}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                required
              />
            </div>
          )}

          {/* Manager Security PIN */}
          {!isManager ? (
            <div style={{
              background: '#f1f5f9',
              border: '1px dashed #94a3b8',
              borderRadius: 8,
              padding: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <KeyRound size={16} color="#0284c7" />
                <label style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
                  Manager Security PIN Authorization <span style={{ color: '#ef4444' }}>*</span>
                </label>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#64748b' }}>
                Cashier accounts require manager approval. (Demo PIN: <strong>8844</strong>)
              </p>
              <input
                type="password"
                maxLength={6}
                value={managerPin}
                onChange={e => setManagerPin(e.target.value)}
                placeholder="Enter 4-digit Manager PIN"
                style={{ width: '100%', letterSpacing: 4, fontWeight: 700, textAlign: 'center', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                required
              />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
              ✓ Authorized as <strong>{user.name}</strong> ({user.role})
            </div>
          )}

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-btn"
              style={{ background: '#dc2626', borderColor: '#b91c1c' }}
              disabled={submitting}
            >
              {submitting ? 'Voiding...' : 'Confirm Void & Restock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
