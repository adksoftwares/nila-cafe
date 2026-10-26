import React from 'react';
import { Activity, Clock, DollarSign, CloudOff, CloudUpload, RefreshCw, WifiOff } from 'lucide-react';
import { money } from '../utils/formatters.js';

export default function Topbar({
  user,
  page,
  apiMode,
  shift,
  shiftSummary,
  onOpenShiftModal,
  isOnline = true,
  offlineQueueCount = 0,
  isSyncing = false,
  onTriggerSync,
  onFlash
}) {
  const initial = user?.name?.[0]?.toUpperCase() || 'U';
  const expectedCash = shiftSummary?.expectedCash ?? (shift?.opening_float || 0);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span> <strong>{page}</strong>
      </div>
      <div className="top-actions">
        {/* Offline Queue / Sync Pill */}
        {offlineQueueCount > 0 ? (
          <button
            type="button"
            onClick={onTriggerSync}
            disabled={isSyncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              border: isOnline ? '1px solid #93c5fd' : '1px solid #fed7aa',
              background: isOnline ? '#eff6ff' : '#fff7ed',
              color: isOnline ? '#1d4ed8' : '#c2410c',
              marginRight: '6px',
              cursor: isOnline ? 'pointer' : 'default'
            }}
            title={isOnline ? 'Click to sync offline orders to cloud' : 'Orders stored locally until network returns'}
          >
            {isSyncing ? (
              <>
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Syncing ({offlineQueueCount})...</span>
              </>
            ) : isOnline ? (
              <>
                <CloudUpload size={13} />
                <span>Sync {offlineQueueCount} Orders</span>
              </>
            ) : (
              <>
                <CloudOff size={13} />
                <span>{offlineQueueCount} Saved Offline</span>
              </>
            )}
          </button>
        ) : !isOnline ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              border: '1px solid #fecdd3',
              background: '#fff1f2',
              color: '#e11d48',
              marginRight: '6px'
            }}
          >
            <WifiOff size={13} /> Offline
          </span>
        ) : null}

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

        <span className={'status-dot ' + (apiMode === 'connected' && isOnline ? 'online' : '')}></span>
        <span className="status-text">
          {!isOnline
            ? 'Offline (Local Safe)'
            : apiMode === 'connected'
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
