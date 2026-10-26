import React from 'react';
import { Activity, Clock, DollarSign } from 'lucide-react';
import { money } from '../utils/formatters.js';

export default function Topbar({ user, page, apiMode, shift, shiftSummary, onOpenShiftModal, onFlash }) {
  const initial = user?.name?.[0]?.toUpperCase() || 'U';
  const expectedCash = shiftSummary?.expectedCash ?? (shift?.opening_float || 0);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span> <strong>{page}</strong>
      </div>
      <div className="top-actions">
        {/* Cashier Shift Status Pill */}
        {user?.role !== 'admin' && (
          <button
            type="button"
            onClick={onOpenShiftModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              border: shift ? '1px solid #bbf7d0' : '1px solid #fecdd3',
              background: shift ? '#f0fdf4' : '#fff1f2',
              color: shift ? '#166534' : '#9f1239',
              marginRight: '6px'
            }}
          >
            <Clock size={13} />
            {shift ? `Till: ${money(expectedCash)}` : 'Till Closed (Click to Open)'}
          </button>
        )}

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
