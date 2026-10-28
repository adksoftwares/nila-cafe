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
  ChefHat,
  Users,
  Layers,
  ShieldAlert
} from 'lucide-react';

export default function Sidebar({ user, page, setPage, salesCount, shopName, onLogout, onFlash }) {
  const admin = user.role === 'admin';
  const isManagerOrOwner = user.role === 'owner' || user.role === 'manager' || admin;

  const nav = admin
    ? [
        { name: 'Overview', icon: BarChart3 },
        { name: 'Shops', icon: Store },
        { name: 'Reports', icon: Activity },
        { name: 'Audit Trail', icon: ShieldAlert },
        { name: 'Settings', icon: Settings }
      ]
    : [
        { name: 'POS', icon: ShoppingCart },
        { name: 'Kitchen (KDS)', icon: ChefHat },
        { name: 'Products', icon: Package },
        { name: 'Ingredients & BOM', icon: Layers },
        { name: 'Sales', icon: Receipt },
        { name: 'Customers', icon: Users },
        { name: 'Reports', icon: BarChart3 },
        ...(isManagerOrOwner ? [{ name: 'Audit Trail', icon: ShieldAlert }] : []),
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
          adk<span className="brand-dot">.cafe</span>
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
          <p>We're here to help you get the most out of ADK Cafe.</p>
          <button onClick={() => onFlash('Support contact: support@adksoftwares.com')}>
            Get support <span>↗</span>
          </button>
        </div>

        <button className="nav-item" onClick={() => setPage('Settings')}>
          <Settings size={18} /> Settings
        </button>

        <button
          className="nav-item"
          onClick={onLogout}
          style={{ color: '#e11d48', marginTop: '2px' }}
          title="Sign out of your session"
        >
          <LogOut size={18} /> Logout
        </button>

        <div className="profile">
          <div className="avatar">{initials}</div>
          <div className="profile-text">
            <strong>{user.name}</strong>
            <small style={{ textTransform: 'capitalize' }}>
              {user.role === 'admin' ? 'Platform Administrator' : (user.role === 'owner' ? 'Cafe Owner' : user.role)}
            </small>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>

        <div className="sidebar-software-footer" style={{
          padding: '8px 12px 14px',
          textAlign: 'center',
          fontSize: '10px',
          color: '#94a3b8',
          letterSpacing: '0.2px'
        }}>
          Softwared by <strong style={{ color: '#64748b' }}>ADK Software Solutions</strong>
        </div>
      </div>
    </aside>
  );
}
