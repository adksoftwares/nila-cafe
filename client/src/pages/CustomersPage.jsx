import React, { useState } from 'react';
import { UserPlus, Search, Star, Award, TrendingUp, Users } from 'lucide-react';
import { money } from '../utils/formatters.js';

export default function CustomersPage({ customers, onOpenAddCustomer, onSearchCustomer }) {
  const [searchTerm, setSearchTerm] = useState('');

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
          <span className="eyebrow">LOYALTY & GUEST PROFILES</span>
          <h1>Customer Directory</h1>
          <p>Track guest visits, lifetime spend, and loyalty reward points.</p>
        </div>
        <button className="primary-btn" onClick={onOpenAddCustomer}>
          <UserPlus size={16} /> Add Customer
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
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
            <div className="stat-label">Member Lifetime Spend</div>
            <div className="stat-val">{money(totalSpend)}</div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <span className="muted">{filtered.length} customers found</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CUSTOMER NAME</th>
                <th>PHONE NUMBER</th>
                <th>EMAIL</th>
                <th>VISITS</th>
                <th>TOTAL SPENT</th>
                <th>LOYALTY POINTS</th>
                <th>JOINED</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.phone}</td>
                  <td>{c.email || <span className="muted">—</span>}</td>
                  <td>
                    <span className="pill" style={{ background: '#f1f5f9' }}>
                      {c.total_visits || 0} visits
                    </span>
                  </td>
                  <td>
                    <strong>{money(c.total_spent || 0)}</strong>
                  </td>
                  <td>
                    <span className="pill" style={{
                      background: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      <strong>{c.loyalty_points || 0} pts</strong>
                    </span>
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="empty-state">
            No customer members found matching your search. Click "Add Customer" to register one.
          </div>
        )}
      </div>
    </>
  );
}
