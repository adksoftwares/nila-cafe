import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function ShopModal({ onSave, onClose }) {
  const [shopForm, setShopForm] = useState({
    name: '',
    email: '',
    ownerName: '',
    password: '',
    phone: '',
    address: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(shopForm);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">TENANT MANAGEMENT</span>
            <h2>Create a shop workspace</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className="form-grid">
          <div>
            <label>Shop name</label>
            <input
              required
              value={shopForm.name}
              onChange={e => setShopForm({ ...shopForm, name: e.target.value })}
              placeholder="e.g. Nila Cafe Colombo"
            />
          </div>
          <div>
            <label>Owner name</label>
            <input
              required
              value={shopForm.ownerName}
              onChange={e => setShopForm({ ...shopForm, ownerName: e.target.value })}
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label>Login email</label>
            <input
              type="email"
              required
              value={shopForm.email}
              onChange={e => setShopForm({ ...shopForm, email: e.target.value })}
              placeholder="owner@nilacafe.com"
            />
          </div>
          <div>
            <label>Temporary password (min 8 chars)</label>
            <input
              type="password"
              minLength={8}
              required
              value={shopForm.password}
              onChange={e => setShopForm({ ...shopForm, password: e.target.value })}
            />
          </div>
          <div>
            <label>Phone (optional)</label>
            <input
              value={shopForm.phone}
              onChange={e => setShopForm({ ...shopForm, phone: e.target.value })}
              placeholder="+94 77 123 4567"
            />
          </div>
          <div>
            <label>Address (optional)</label>
            <input
              value={shopForm.address}
              onChange={e => setShopForm({ ...shopForm, address: e.target.value })}
              placeholder="e.g. Galle Road, Colombo"
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn">
            Create workspace
          </button>
        </div>
      </form>
    </div>
  );
}
