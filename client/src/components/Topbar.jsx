import React from 'react';
import { Activity } from 'lucide-react';

export default function Topbar({ user, page, apiMode, onFlash }) {
  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span> <strong>{page}</strong>
      </div>
      <div className="top-actions">
        <span className={'status-dot ' + (apiMode === 'connected' ? 'online' : '')}></span>
        <span className="status-text">
          {apiMode === 'connected'
            ? 'Connected (PostgreSQL)'
            : apiMode === 'offline'
            ? 'Local Preview'
            : 'Demo Mode'}
        </span>
        <button
          className="icon-btn"
          title="Notifications"
          onClick={() => onFlash('You are all caught up.')}
        >
          <Activity size={18} />
        </button>
        <div className="top-avatar">{initial}</div>
      </div>
    </header>
  );
}
