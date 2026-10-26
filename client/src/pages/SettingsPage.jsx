import React from 'react';
import { Users, ShieldCheck, Store } from 'lucide-react';

export default function SettingsPage({ user, shopName, apiMode, onLogout }) {
  const admin = user.role === 'admin';

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>Settings & Configuration</h1>
          <p>Manage your account, workspace details, and system connectivity.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="setting-card">
          <div className="setting-icon">
            <Users size={19} />
          </div>
          <div>
            <h3>User Account</h3>
            <p>
              {user.name} · {user.email}
            </p>
            <span className="pill">{user.role}</span>
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-icon">
            <ShieldCheck size={19} />
          </div>
          <div>
            <h3>Session & Security</h3>
            <p>
              Session active on this workstation. Sign out to terminate access.
            </p>
            <button className="secondary-btn small" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-icon">
            <Store size={19} />
          </div>
          <div>
            <h3>Cafe Workspace Details</h3>
            <p>
              {admin ? 'Platform-wide Multi-Tenant Management' : `${shopName} · Colombo, Sri Lanka`}
            </p>
            <p className="muted">
              Branch profile editing & tax ID configuration available in admin console.
            </p>
          </div>
        </div>

        <div className="setting-card">
          <div className="setting-icon">
            <ShieldCheck size={19} />
          </div>
          <div>
            <h3>Data Connectivity Mode</h3>
            <p>
              {apiMode === 'connected'
                ? 'Connected to PostgreSQL Database'
                : apiMode === 'offline'
                ? 'Offline / API Server Unavailable'
                : 'Local Demo Data Active'}
            </p>
            <p className="muted">
              {apiMode === 'connected'
                ? 'Real-time database persistence and tenant isolation are active.'
                : 'Transactions are stored in local workstation storage only.'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
