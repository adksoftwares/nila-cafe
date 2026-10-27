import React from 'react';
import { Package, Check, Activity, Wallet, Plus, Search, Layers, Sliders } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import { money } from '../utils/formatters.js';

export default function ProductsPage({
  products,
  categories,
  modifiers = [],
  search,
  setSearch,
  onOpenAddProduct,
  onNavigateToBOM
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
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>BOM & MODIFIERS</th>
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
                    <td>
                      <span className="pill success">Active</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
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
