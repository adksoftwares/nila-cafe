import React from 'react';
import { Store, Users, ShieldCheck, Activity, Plus } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';

export default function AdminShopsPage({
  viewMode,
  adminShops,
  apiMode,
  onOpenCreateShop,
  onSetPage
}) {
  const isOverview = viewMode === 'Overview';

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLATFORM ADMINISTRATION</span>
          <h1>{isOverview ? 'Platform Overview' : 'Shop Workspaces'}</h1>
          <p>
            {isOverview
              ? 'Manage your cafe branches, shops, and monitor system health.'
              : 'Each branch or shop has its own isolated products, sales, and accounts.'}
          </p>
        </div>
        <button className="primary-btn" onClick={onOpenCreateShop}>
          <Plus size={17} /> Create shop
        </button>
      </div>

      {isOverview && (
        <div className="stat-grid">
          <StatCard
            icon={Store}
            label="Registered shops"
            value={adminShops.length || 1}
          />
          <StatCard
            icon={Users}
            label="Owner accounts"
            value={adminShops.reduce((a, s) => a + Number(s.owners || 1), 0)}
          />
          <StatCard
            icon={ShieldCheck}
            label="Platform status"
            value="Healthy"
          />
          <StatCard
            icon={Activity}
            label="Database Mode"
            value={apiMode === 'connected' ? 'Live DB' : 'Demo'}
          />
        </div>
      )}

      <div className="table-card">
        <div className="table-top">
          <h3>{isOverview ? 'Active Workspaces' : 'All Shop Workspaces'}</h3>
          {isOverview && (
            <button className="text-button" onClick={() => onSetPage('Shops')}>
              View all →
            </button>
          )}
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SHOP NAME</th>
                <th>OWNER EMAIL</th>
                <th>PHONE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {(adminShops.length
                ? adminShops
                : [
                    {
                      id: 'shop-demo',
                      name: 'The Daily Counter (ADK Cafe)',
                      email: 'owner@counterpoint.local',
                      phone: '+94 77 123 4567',
                      active: true
                    }
                  ]
              ).map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="table-product">
                      <span className="mini-product">
                        <Store size={15} />
                      </span>
                      <strong>{s.name}</strong>
                    </div>
                  </td>
                  <td>{s.email}</td>
                  <td>{s.phone || '—'}</td>
                  <td>
                    <span className="pill success">
                      {s.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
