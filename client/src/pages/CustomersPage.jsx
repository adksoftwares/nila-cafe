import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Star,
  Award,
  TrendingUp,
  Users,
  Tag,
  Percent,
  Trash2,
  Edit3,
  Plus,
  CheckCircle2,
  XCircle,
  Gift,
  Sparkles,
  X,
  Sliders
} from 'lucide-react';
import { money } from '../utils/formatters.js';
import PromotionModal from '../components/modals/PromotionModal.jsx';

export default function CustomersPage({
  customers = [],
  api,
  onFlash,
  onReloadCustomers,
  onOpenAddCustomer
}) {
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'promotions'
  const [searchTerm, setSearchTerm] = useState('');

  // Promotions State
  const [promotions, setPromotions] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Points Adjustment Modal state
  const [adjustingCust, setAdjustingCust] = useState(null);
  const [deltaPoints, setDeltaPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('manual_reward');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const fetchPromotions = async () => {
    if (!api) return;
    setLoadingPromos(true);
    try {
      const res = await api('/promotions?all=true');
      setPromotions(res.promotions || []);
    } catch (err) {
      onFlash?.(err.message || 'Failed to load promotions', 'error');
    } finally {
      setLoadingPromos(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleCreatePromo = async (promoData) => {
    const res = await api('/promotions', {
      method: 'POST',
      body: JSON.stringify(promoData)
    });
    if (res.promotion) {
      setPromotions(prev => [res.promotion, ...prev]);
      onFlash?.(`Promotional coupon "${res.promotion.code}" created!`, 'success');
    }
  };

  const handleTogglePromo = async (id, currentActive) => {
    try {
      const res = await api(`/promotions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !currentActive })
      });
      if (res.success) {
        setPromotions(prev =>
          prev.map(p => (p.id === id ? { ...p, active: !currentActive } : p))
        );
        onFlash?.(`Promo coupon status updated.`, 'success');
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to update promo status.', 'error');
    }
  };

  const handleDeletePromo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promotional coupon?')) return;
    try {
      const res = await api(`/promotions/${id}`, { method: 'DELETE' });
      if (res.success) {
        setPromotions(prev => prev.filter(p => p.id !== id));
        onFlash?.('Promotional coupon deleted.', 'success');
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to delete promo.', 'error');
    }
  };

  const handleAdjustPointsSubmit = async (e) => {
    e.preventDefault();
    const delta = parseInt(deltaPoints, 10);
    if (!Number.isFinite(delta) || delta === 0) return;

    setSubmittingAdjust(true);
    try {
      const res = await api(`/customers/${adjustingCust.id}/points`, {
        method: 'PATCH',
        body: JSON.stringify({ deltaPoints: delta, reason: adjustReason })
      });
      if (res.success) {
        onFlash?.(`Updated points for ${adjustingCust.name}: ${delta > 0 ? '+' : ''}${delta} pts`, 'success');
        setAdjustingCust(null);
        setDeltaPoints('');
        onReloadCustomers?.();
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to adjust points.', 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Are you sure you want to remove this customer record?')) return;
    try {
      const res = await api(`/customers/${id}`, { method: 'DELETE' });
      if (res.success) {
        onFlash?.('Customer profile deleted.', 'success');
        onReloadCustomers?.();
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to delete customer.', 'error');
    }
  };

  const getLoyaltyTier = (spend) => {
    const s = Number(spend || 0);
    if (s >= 20000) {
      return { label: 'VIP Platinum', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    }
    if (s >= 10000) {
      return { label: 'Gold Member', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    }
    if (s >= 5000) {
      return { label: 'Silver Member', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
    }
    return { label: 'Bronze Member', color: '#b45309', bg: '#fef3c7', border: '#fef08a' };
  };

  const filtered = customers.filter(c => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || (c.email && c.email.toLowerCase().includes(s));
  });

  const totalPoints = customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0);
  const totalSpend = customers.reduce((sum, c) => sum + (Number(c.total_spent) || 0), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOYALTY REWARDS & PROMOTIONS</span>
          <h1>Customer Loyalty & Marketing</h1>
          <p>Manage customer profiles, loyalty point tiers, and promotional discount campaigns.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className={activeTab === 'customers' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={16} /> Guest Directory
          </button>
          <button
            type="button"
            className={activeTab === 'promotions' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('promotions')}
          >
            <Tag size={16} /> Promo Campaigns
          </button>
        </div>
      </div>

      {/* ================= TAB 1: CUSTOMERS DIRECTORY & LOYALTY ================= */}
      {activeTab === 'customers' && (
        <>
          {/* KPI Cards */}
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <Users size={20} />
              </div>
              <div>
                <div className="stat-label">Total Members</div>
                <div className="stat-val">{customers.length}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Star size={20} />
              </div>
              <div>
                <div className="stat-label">Active Reward Points</div>
                <div className="stat-val">{totalPoints.toLocaleString()} pts</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="stat-label">Member Lifetime Revenue</div>
                <div className="stat-val">{money(totalSpend)}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Award size={20} />
              </div>
              <div>
                <div className="stat-label">VIP Platinum Guests</div>
                <div className="stat-val">
                  {customers.filter(c => Number(c.total_spent) >= 20000).length}
                </div>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ position: 'relative', width: 280 }}>
                <input
                  type="text"
                  placeholder="Search by name, phone, email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    fontSize: 13,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="muted">{filtered.length} customers found</span>
                <button className="primary-btn small" onClick={onOpenAddCustomer}>
                  <UserPlus size={14} /> Add Customer
                </button>
              </div>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>CONTACT</th>
                    <th>TIER</th>
                    <th>VISITS</th>
                    <th>LIFETIME SPEND</th>
                    <th>LOYALTY POINTS</th>
                    <th>JOINED</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const tier = getLoyaltyTier(c.total_spent);

                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#eff6ff',
                                color: 'var(--blue)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: 12
                              }}
                            >
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ fontSize: 13, display: 'block' }}>{c.name}</strong>
                              <small style={{ color: '#64748b' }}>ID: {c.id.slice(0, 8)}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: 12, display: 'block', color: '#1e293b' }}>{c.phone}</strong>
                          {c.email && <small style={{ color: '#64748b' }}>{c.email}</small>}
                        </td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              background: tier.bg,
                              color: tier.color,
                              border: `1px solid ${tier.border}`,
                              fontWeight: 'bold',
                              fontSize: 11
                            }}
                          >
                            {tier.label}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{c.total_visits || 0}</strong>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13, color: '#15803d' }}>{money(c.total_spent || 0)}</strong>
                        </td>
                        <td>
                          <span
                            className="pill"
                            style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              fontWeight: 'bold',
                              fontSize: 12
                            }}
                          >
                            ⭐ {(c.loyalty_points || 0).toLocaleString()} pts
                          </span>
                        </td>
                        <td>
                          <small style={{ color: '#64748b' }}>
                            {new Date(c.created_at).toLocaleDateString()}
                          </small>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="secondary-btn small"
                              onClick={() => {
                                setAdjustingCust(c);
                                setDeltaPoints('');
                              }}
                              title="Manually adjust points"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              <Sliders size={12} /> Points
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c.id)}
                              title="Delete customer"
                              style={{
                                background: 'transparent',
                                border: 0,
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: 4
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!filtered.length && (
                <div className="empty-state" style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  No customer profiles found matching your search term.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ================= TAB 2: PROMOTIONS & VOUCHERS ================= */}
      {activeTab === 'promotions' && (
        <>
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <Tag size={20} />
              </div>
              <div>
                <div className="stat-label">Active Campaigns</div>
                <div className="stat-val">{promotions.filter(p => p.active).length}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#eff6ff', color: 'var(--blue)' }}>
                <Percent size={20} />
              </div>
              <div>
                <div className="stat-label">Total Coupons</div>
                <div className="stat-val">{promotions.length}</div>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Promotional Campaigns & Coupon Codes</h3>
                <span className="muted">Cashiers can enter these coupon codes at checkout to apply bill discounts</span>
              </div>
              <button
                type="button"
                className="primary-btn small"
                onClick={() => setShowPromoModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} /> Create Coupon
              </button>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>PROMO CODE</th>
                    <th>CAMPAIGN TITLE</th>
                    <th>DISCOUNT TYPE</th>
                    <th>DISCOUNT VALUE</th>
                    <th>MIN ORDER SPEND</th>
                    <th>STATUS</th>
                    <th>CREATED</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map(promo => (
                    <tr key={promo.id}>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            letterSpacing: '1px'
                          }}
                        >
                          {promo.code}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: '#1e293b' }}>{promo.title}</strong>
                      </td>
                      <td>
                        <span
                          className="pill"
                          style={{
                            background: promo.type === 'percentage' ? '#f0fdf4' : '#fffbeb',
                            color: promo.type === 'percentage' ? '#15803d' : '#b45309',
                            fontWeight: 600
                          }}
                        >
                          {promo.type === 'percentage' ? 'Percentage (%)' : 'Fixed LKR'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 14, color: '#16a34a' }}>
                          {promo.type === 'percentage' ? `${promo.value}% OFF` : `${money(promo.value)} OFF`}
                        </strong>
                      </td>
                      <td>
                        {promo.min_order_amount > 0 ? (
                          <span>Min {money(promo.min_order_amount)}</span>
                        ) : (
                          <span className="pill" style={{ background: '#f1f5f9', color: '#64748b' }}>No minimum</span>
                        )}
                      </td>
                      <td>
                        {promo.active ? (
                          <span className="pill" style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: 'bold' }}>
                            Active
                          </span>
                        ) : (
                          <span className="pill" style={{ background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                            Disabled
                          </span>
                        )}
                      </td>
                      <td>
                        <small style={{ color: '#64748b' }}>
                          {new Date(promo.created_at).toLocaleDateString()}
                        </small>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="secondary-btn small"
                            onClick={() => handleTogglePromo(promo.id, promo.active)}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                          >
                            {promo.active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePromo(promo.id)}
                            title="Delete promo code"
                            style={{
                              background: 'transparent',
                              border: 0,
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: 4
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!promotions.length && (
                <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  No promotional discount coupons configured yet. Click "Create Coupon" above to add campaigns.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Promotion Create Modal */}
      {showPromoModal && (
        <PromotionModal
          onSave={handleCreatePromo}
          onClose={() => setShowPromoModal(false)}
        />
      )}

      {/* Loyalty Points Adjustment Modal */}
      {adjustingCust && (
        <div className="modal-backdrop" onClick={() => setAdjustingCust(null)}>
          <div className="modal" style={{ width: 'min(100%, 420px)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">LOYALTY REWARDS ADJUSTMENT</span>
                <h2>Adjust Reward Points</h2>
                <small style={{ color: '#64748b' }}>
                  Member: {adjustingCust.name} (Current: {adjustingCust.loyalty_points || 0} pts)
                </small>
              </div>
              <button type="button" className="icon-btn" onClick={() => setAdjustingCust(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdjustPointsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
                  Points Delta (+ to grant, - to deduct): *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50 or -20"
                  value={deltaPoints}
                  onChange={e => setDeltaPoints(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
                  Adjustment Reason:
                </label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                >
                  <option value="manual_reward">Goodwill / Manual Reward</option>
                  <option value="complaint_resolution">Service Recovery / Complaint</option>
                  <option value="correction">Audit Balance Correction</option>
                  <option value="expiry_deduction">Manual Expiry Deduction</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <button type="button" className="secondary-btn" onClick={() => setAdjustingCust(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submittingAdjust}>
                  {submittingAdjust ? 'Updating...' : 'Save Point Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
