import React, { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function ModifierModal({
  product,
  modifiers = [],
  orderType = 'takeaway',
  onConfirm,
  onClose
}) {
  const basePrice = Number(orderType === 'takeaway' ? product.takeaway_price : product.normal_price);

  // Initialize selections with required defaults
  const [selections, setSelections] = useState(() => {
    const initial = {};
    for (const group of modifiers) {
      if (group.type === 'single' && group.options?.length) {
        // Pick first option as default
        initial[group.id] = [group.options[0]];
      } else {
        initial[group.id] = [];
      }
    }
    return initial;
  });

  const [notes, setNotes] = useState('');

  const handleSelectOption = (group, option) => {
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (group.type === 'single') {
        return { ...prev, [group.id]: [option] };
      } else {
        // Toggle multiple
        const exists = current.some(o => o.id === option.id);
        const updated = exists
          ? current.filter(o => o.id !== option.id)
          : [...current, option];
        return { ...prev, [group.id]: updated };
      }
    });
  };

  // Flatten all selected options
  const allSelectedOptions = Object.values(selections).flat();
  const extraPrice = allSelectedOptions.reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
  const totalPrice = basePrice + extraPrice;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(product, allSelectedOptions, notes);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(100%, 460px)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">CUSTOMIZE ITEM</span>
            <h2>{product.name}</h2>
            <small style={{ color: '#64748b' }}>Base: {money(basePrice)}</small>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
            {modifiers.map(group => {
              const currentSelected = selections[group.id] || [];
              return (
                <div key={group.id} style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px' }}>{group.name}</strong>
                    <span style={{ fontSize: '11px', color: group.required ? '#dc2626' : '#64748b' }}>
                      {group.type === 'single' ? (group.required ? 'Required (Pick 1)' : 'Pick 1') : 'Optional Add-Ons'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {group.options.map(opt => {
                      const isSelected = currentSelected.some(o => o.id === opt.id);
                      return (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: isSelected ? '1.5px solid var(--blue)' : '1px solid #e2e8f0',
                            background: isSelected ? '#eff6ff' : '#fff',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type={group.type === 'single' ? 'radio' : 'checkbox'}
                              name={group.id}
                              checked={isSelected}
                              onChange={() => handleSelectOption(group, opt)}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: isSelected ? 600 : 400 }}>{opt.name}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: opt.price > 0 ? '#0284c7' : '#64748b' }}>
                            {opt.price > 0 ? `+${money(opt.price)}` : 'Included'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Special Instructions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Special Instructions / Note</label>
              <input
                type="text"
                placeholder="e.g. Extra hot, less sweet, no ice"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button type="button" className="secondary-btn" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" style={{ flex: 2 }}>
              Add to Order — {money(totalPrice)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
