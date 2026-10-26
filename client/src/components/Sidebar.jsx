import React from 'react';
import {
  Command,
  Store,
  ChevronDown,
  Settings,
  LogOut,
  BarChart3,
  Activity,
  ShoppingCart,
  Package,
  Receipt,
  ChefHat
} from 'lucide-react';

export default function Sidebar({ user, page, setPage, salesCount, shopName, onLogout, onFlash }) {
  const admin = user.role === 'admin';
  const nav = admin
    ? [
        { name: 'Overview', icon: BarChart3 },
        { name: 'Shops', icon: Store },
        { name: 'Reports', icon: Activity },
        { name: 'Settings', icon: Settings }
      ]
    : [
        { name: 'POS', icon: ShoppingCart },
        { name: 'Kitchen (KDS)', icon: ChefHat },
        { name: 'Products', icon: Package },
        { name: 'Sales', icon: Receipt },
        { name: 'Reports', icon: BarChart3 },
        { name: 'Settings', icon: Settings }
      ];

  const initials = user.name
    ?.split(' ')
    .map(x => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Command size={20} />
        </div>
        <span>
          nila<span className="brand-dot">.cafe</span>
        </span>
      </div>

      <div className="workspace">
        <div className="workspace-icon">
          <Store size={17} />
        </div>
        <div>
          <strong>{admin ? 'Platform Admin' : shopName}</strong>
          <small>{admin ? 'All workspaces' : 'Cafe workspace'}</small>
        </div>
        <ChevronDown size={15} />
      </div>

      <div className="nav-caption">WORKSPACE</div>
      <nav>
        {nav.map(n => (
          <button
            key={n.name}
            onClick={() => setPage(n.name)}
            className={page === n.name ? 'nav-item active' : 'nav-item'}
          >
            <n.icon size={18} />
            {n.name}
            {n.name === 'Sales' && salesCount > 0 && (
              <span className="nav-count">{salesCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon">✳</div>
          <strong>Need a hand?</strong>
          <p>We're here to help you get the most out of Nila Cafe.</p>
          <button onClick={() => onFlash('Support contact: support@nilacafe.local')}>
            Get support <span>↗</span>
          </button>
        </div>

        <button className="nav-item" onClick={() => setPage('Settings')}>
          <Settings size={18} /> Settings
        </button>

        <div className="profile">
          <div className="avatar">{initials}</div>
          <div className="profile-text">
            <strong>{user.name}</strong>
            <small>{admin ? 'Platform Administrator' : 'Cafe Owner'}</small>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
