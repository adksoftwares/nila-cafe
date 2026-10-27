import React, { useRef, useEffect, useState } from 'react';
import { Search, ChevronDown, Plus, Sparkles } from 'lucide-react';
import { money } from '../../utils/formatters.js';
import { useCart } from '../../context/CartContext.jsx';
import ModifierModal from '../modals/ModifierModal.jsx';

export default function ProductCatalog({
  products,
  category,
  setCategory,
  categories,
  search,
  setSearch,
  modifiers = [],
  orderType: propOrderType,
  onAddProduct: propOnAddProduct
}) {
  const { orderType: ctxOrderType, addToCart } = useCart();
  const orderType = propOrderType || ctxOrderType;
  const onAddProduct = propOnAddProduct || addToCart;
  const searchInputRef = useRef(null);
  const [activeModifierProduct, setActiveModifierProduct] = useState(null);

  // Implement real Cmd+K / Ctrl+K keyboard shortcut!
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const visible = products.filter(
    p =>
      p.active !== false &&
      (category === 'All items' || p.category === category) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()))
  );

  const unitPrice = p =>
    Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);

  const handleProductClick = (p) => {
    const productMods = modifiers.filter(m => !m.product_id || m.product_id === p.id);
    if (productMods.length > 0) {
      setActiveModifierProduct(p);
    } else {
      onAddProduct(p);
    }
  };

  return (
    <section className="catalog">
      <div className="catalog-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            ref={searchInputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products or scan barcode… (Ctrl+K)"
          />
          <kbd>⌘ K</kbd>
        </div>
        <button className="filter-btn" onClick={() => setCategory('All items')}>
          Filters <ChevronDown size={15} />
        </button>
      </div>

      <div className="category-row">
        {categories.map(c => (
          <button
            key={c}
            className={category === c ? 'category active' : 'category'}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {visible.map((p, i) => {
          const hasMods = modifiers.some(m => !m.product_id || m.product_id === p.id);
          return (
            <button
              className="product-card"
              key={p.id}
              onClick={() => handleProductClick(p)}
            >
              <div className={'product-art art-' + (i % 6)}>
                {p.category === 'Drinks' || p.category === 'Beverages'
                  ? '☕'
                  : p.category === 'Pizza'
                  ? '🍕'
                  : p.category === 'Sides'
                  ? '🍟'
                  : p.category === 'Burgers'
                  ? '🍔'
                  : p.category === 'Sandwiches'
                  ? '🥪'
                  : '◉'}
                <span className="add-circle">
                  <Plus size={15} />
                </span>
              </div>
              <div className="product-meta">
                <span>{p.category || 'General'}</span>
                {hasMods && (
                  <span style={{ fontSize: '9px', background: '#eff6ff', color: '#2563eb', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>
                    Options
                  </span>
                )}
                <small>{p.code}</small>
              </div>
              <strong>{p.name}</strong>
              <div className="product-price">{money(unitPrice(p))}</div>
              <div className="stock-line">{p.stock} in stock</div>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="empty-state">
          No products found. Try a different search term or category.
        </div>
      )}

      <div className="catalog-foot">
        <span>{visible.length} products available</span>
        <span>
          Prices shown for <strong>{orderType.toUpperCase()}</strong>
        </span>
      </div>

      {activeModifierProduct && (
        <ModifierModal
          product={activeModifierProduct}
          modifiers={modifiers.filter(m => !m.product_id || m.product_id === activeModifierProduct.id)}
          orderType={orderType}
          onConfirm={(p, selectedOptions, notes) => {
            addToCart(p, selectedOptions, notes);
            setActiveModifierProduct(null);
          }}
          onClose={() => setActiveModifierProduct(null)}
        />
      )}
    </section>
  );
}
