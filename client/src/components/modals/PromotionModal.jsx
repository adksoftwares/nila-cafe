import React, { useState } from 'react';
import { Tag, Percent, DollarSign, X, Check, AlertCircle } from 'lucide-react';

export default function PromotionModal({ onSave, onClose }) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('percentage'); // 'percentage' | 'fixed'
  const [value, setValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = code.trim().toUpperCase();
    const cleanTitle = title.trim();
    const val = Number(value);
    const minAmt = Math.max(0, Number(minOrderAmount) || 0);

    if (!cleanCode || !cleanTitle) {
      setError('Promo code and campaign title are required.');
      return;
    }
    if (!Number.isFinite(val) || val <= 0) {
      setError('Provide a positive discount value.');
      return;
    }
    if (type === 'percentage' && val > 100) {
      setError('Percentage discount cannot exceed 100%.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        code: cleanCode,
        title: cleanTitle,
        type,
        value: val,
        minOrderAmount: minAmt
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create promotion campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(100%, 460px)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MARKETING & INCENTIVES</span>
            <h2>Create Promotional Coupon</h2>
            <small style={{ color: '#64748b' }}>Configure discount voucher codes and spend criteria.</small>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: '14px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
              Voucher Code: *
            </label>
            <input
              type="text"
              placeholder="e.g. WELCOME10, FLAT500, HAPPYHOUR"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                letterSpacing: '1px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
              Campaign Description: *
            </label>
            <input
              type="text"
              placeholder="e.g. 10% Off First Visit, Weekend Special"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                Discount Type:
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              >
                <option value="percentage">Percentage Off (%)</option>
                <option value="fixed">Fixed Amount Off (LKR)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                Discount Value: *
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                placeholder={type === 'percentage' ? 'e.g. 10 (%)' : 'e.g. 500 (LKR)'}
                value={value}
                onChange={e => setValue(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
              Minimum Order Spend (LKR):
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 1500 (0 for no minimum)"
              value={minOrderAmount}
              onChange={e => setMinOrderAmount(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              <Check size={16} /> {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
