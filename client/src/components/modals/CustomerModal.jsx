import React, { useState } from 'react';
import { User, Phone, Mail, X } from 'lucide-react';

export default function CustomerModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to register customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={18} />
            </div>
            <div>
              <h3>Add New Customer</h3>
              <span className="muted">Loyalty rewards member</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Kasun Silva"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              Phone Number <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                placeholder="e.g. 0771234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
              <Phone size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 13 }}>
              Email Address (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="e.g. customer@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
              <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, fontSize: 12, color: '#475569' }}>
            ℹ <strong>Loyalty Policy:</strong> Customers earn 1 point for every LKR 100 spent. Points can be redeemed for instant bill discounts.
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Register Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
