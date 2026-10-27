import React from 'react';
import { Package, Check, Activity, Wallet, Plus, Search, Layers, Sliders, Pencil, Trash2 } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import { money } from '../utils/formatters.js';

export default function ProductsPage({
  products,
  categories,
  modifiers = [],
  search,
  setSearch,
  onOpenAddProduct,
  onNavigateToBOM,
  onEditProduct,
  onDeleteProduct
}) {
  const visible = products.filter(
    p =>
      p.active !== false &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INVENTORY & MENU</span>
          <h1>Products & Items</h1>
          <p>Keep your cafe catalogue, pricing, recipes, and modifiers accurate.</p>
        </div>
        <button className="primary-btn" onClick={onOpenAddProduct}>
          <Plus size={17} /> Add product
        </button>
      </div>

      <div className="stat-grid">
        <StatCard icon={Package} label="Total products" value={products.length} />
        <StatCard
          icon={Check}
          label="Active products"
          value={products.filter(p => p.active !== false).length}
        />
        <StatCard
          icon={Activity}
          label="Low stock items"
          value={products.filter(p => p.stock < 10).length}
        />
        <StatCard
          icon={Wallet}
          label="Categories"
          value={Math.max(1, categories.length - 1)}
        />
      </div>

      <div className="table-card">
        <div className="table-top">
          <h3>Menu & Product Catalogue</h3>
          <div className="search-box compact">
            <Search size={16} />
            <input
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CODE</th>
                <th>CATEGORY</th>
                <th>TAKEAWAY PRICE</th>
                <th>DINING PRICE</th>
                <th>STOCK</th>
                <th style={{ textAlign: 'center' }}>BOM & MODIFIERS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const linkedMods = modifiers.filter(m => m.product_id === p.id);

                return (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <span className="mini-product">{p.name[0]}</span>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>{p.code}</td>
                    <td>{p.category}</td>
                    <td>{money(p.takeaway_price)}</td>
                    <td>{money(p.normal_price)}</td>
                    <td>
                      <span className={p.stock < 10 ? 'low-stock' : ''}>
                        {p.stock}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="secondary-btn small"
                        onClick={() => onNavigateToBOM?.(p.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px' }}
                      >
                        <Layers size={13} color="var(--blue)" /> Manage BOM & Modifiers
                        {linkedMods.length > 0 && (
                          <span style={{ fontSize: '9px', background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {linkedMods.length} mods
                          </span>
                        )}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onEditProduct?.(p)}
                        title={`Edit ${p.name}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#2563eb',
                          cursor: 'pointer',
                          marginRight: '6px'
                        }}
                      >
                        <Pencil size={13} />
                        <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '3px' }}>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onDeleteProduct?.(p)}
                        title={`Delete ${p.name}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fecdd3',
                          background: '#fff1f2',
                          color: '#e11d48',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} />
                        <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '3px' }}>Delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
