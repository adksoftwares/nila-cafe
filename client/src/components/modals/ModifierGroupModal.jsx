import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Layers, Check, AlertCircle } from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function ModifierGroupModal({
  modifier,
  products = [],
  ingredients = [],
  onSave,
  onClose,
  onFlash
}) {
  const isEditing = Boolean(modifier?.id);

  const [name, setName] = useState(modifier?.name || '');
  const [productId, setProductId] = useState(modifier?.product_id || '');
  const [type, setType] = useState(modifier?.type || 'single'); // 'single' | 'multiple'
  const [required, setRequired] = useState(modifier?.required || false);
  const [options, setOptions] = useState(() => {
    if (Array.isArray(modifier?.options) && modifier.options.length > 0) {
      return modifier.options.map(o => ({
        id: o.id || 'opt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: o.name || '',
        price: o.price !== undefined ? o.price : 0,
        ingredient_id: o.ingredient_id || '',
        ingredient_qty: o.ingredient_qty !== undefined ? o.ingredient_qty : 0
      }));
    }
    return [
      { id: 'opt-1', name: '', price: 0, ingredient_id: '', ingredient_qty: 0 }
    ];
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddOption = () => {
    setOptions(prev => [
      ...prev,
      {
        id: 'opt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: '',
        price: 0,
        ingredient_id: '',
        ingredient_qty: 0
      }
    ]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 1) {
      setError('A modifier group must have at least one option.');
      return;
    }
    setError('');
    setOptions(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (index, field, value) => {
    setOptions(prev =>
      prev.map((opt, idx) => (idx === index ? { ...opt, [field]: value } : opt))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Modifier group name is required.');
      return;
    }

    const validOptions = options.map(opt => ({
      ...opt,
      name: opt.name.trim(),
      price: Math.max(0, Number(opt.price) || 0),
      ingredient_id: opt.ingredient_id || null,
      ingredient_qty: Math.max(0, Number(opt.ingredient_qty) || 0)
    }));

    if (validOptions.some(o => !o.name)) {
      setError('All modifier options must have a valid title.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        id: modifier?.id,
        name: cleanName,
        productId: productId || null,
        type,
        required,
        options: validOptions
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save modifier group.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 'min(100%, 580px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-heading">
          <div>
            <span className="eyebrow">CATALOGUE CUSTOMIZATION</span>
            <h2>{isEditing ? 'Edit Modifier Group' : 'Create Modifier Group'}</h2>
            <small style={{ color: '#64748b' }}>
              Configure add-on variants, pricing, and raw ingredient BOM auto-depletion.
            </small>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              margin: '0 0 16px',
              padding: '10px 14px',
              borderRadius: '8px',
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

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            {/* Group Name */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>
                Group Title: *
              </label>
              <input
                type="text"
                placeholder="e.g. Milk Selection, Sweetness, Size"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px'
                }}
              />
            </div>

            {/* Target Product */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>
                Apply to Product:
              </label>
              <select
                value={productId}
                onChange={e => setProductId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px'
                }}
              >
                <option value="">All Products (Global Modifier)</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            {/* Selection Rule Type */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>
                Selection Rule:
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px'
                }}
              >
                <option value="single">Single Choice (Radio - Pick 1)</option>
                <option value="multiple">Multiple Choice (Checkboxes - Add any)</option>
              </select>
            </div>

            {/* Mandatory Requirement */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={required}
                  onChange={e => setRequired(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span>
                  <strong>Mandatory Selection</strong>
                  <small style={{ display: 'block', color: '#64748b' }}>Cashier must select at least 1 option</small>
                </span>
              </label>
            </div>
          </div>

          {/* Options & Pricing List */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
                Options & BOM Inventory Linkage ({options.length})
              </label>
              <button
                type="button"
                className="secondary-btn small"
                onClick={handleAddOption}
                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Add Option
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {options.map((opt, idx) => (
                <div
                  key={opt.id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 2fr 1fr 32px',
                    gap: '8px',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px'
                  }}
                >
                  {/* Option Name */}
                  <div>
                    <input
                      type="text"
                      placeholder="Option Name (e.g. Oat Milk)"
                      value={opt.name}
                      onChange={e => handleOptionChange(idx, 'name', e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px'
                      }}
                    />
                  </div>

                  {/* Added Price (LKR) */}
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="+ Price (LKR)"
                      value={opt.price}
                      onChange={e => handleOptionChange(idx, 'price', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px'
                      }}
                    />
                  </div>

                  {/* Linked Raw Ingredient */}
                  <div>
                    <select
                      value={opt.ingredient_id || ''}
                      onChange={e => handleOptionChange(idx, 'ingredient_id', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px'
                      }}
                    >
                      <option value="">No Ingredient Depletion</option>
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ingredient Qty */}
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Qty / unit"
                      disabled={!opt.ingredient_id}
                      value={opt.ingredient_qty}
                      onChange={e => handleOptionChange(idx, 'ingredient_qty', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '11px',
                        background: opt.ingredient_id ? '#fff' : '#f1f5f9'
                      }}
                    />
                  </div>

                  {/* Remove Row Button */}
                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      title="Remove option"
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              <Check size={16} /> {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
