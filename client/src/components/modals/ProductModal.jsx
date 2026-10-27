import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function ProductModal({ product = null, onSave, onClose }) {
  const isEdit = Boolean(product?.id);

  const [form, setForm] = useState({
    id: product?.id || null,
    code: product?.code || '',
    name: product?.name || '',
    category: product?.category || 'General',
    takeaway_price: product?.takeaway_price != null ? String(product.takeaway_price) : '',
    normal_price: product?.normal_price != null ? String(product.normal_price) : '',
    stock: product?.stock != null ? String(product.stock) : '0'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{isEdit ? 'EDIT INVENTORY' : 'INVENTORY'}</span>
            <h2>{isEdit ? 'Edit Product' : 'Add a product'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className="form-grid">
          <div>
            <label>Product code</label>
            <input
              required
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. COF007"
            />
          </div>
          <div>
            <label>Product name</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Filter Coffee"
            />
          </div>
          <div>
            <label>Category</label>
            <input
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Beverages"
            />
          </div>
          <div>
            <label>Stock quantity</label>
            <input
              type="number"
              min="0"
              required
              value={form.stock}
              onChange={e => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <div>
            <label>Takeaway price (LKR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.takeaway_price}
              onChange={e => setForm({ ...form, takeaway_price: e.target.value })}
            />
          </div>
          <div>
            <label>Normal / Dining price (LKR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.normal_price}
              onChange={e => setForm({ ...form, normal_price: e.target.value })}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn">
            {isEdit ? 'Update product' : 'Save product'}
          </button>
        </div>
      </form>
    </div>
  );
}
