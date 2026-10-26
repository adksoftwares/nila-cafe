import React, { useState, useEffect } from 'react';
import { X, Users, Utensils, CheckCircle2, Clock, DollarSign, ChefHat, RefreshCw } from 'lucide-react';
import { money } from '../../utils/formatters.js';

export default function TableModal({
  api,
  selectedTable,
  onSelectTable,
  onLoadActiveTableOrder,
  onClose,
  onFlash
}) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await api('/tables');
      setTables(res.tables || []);
    } catch (err) {
      onFlash?.(err.message || 'Failed to fetch table floor plan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleUpdateStatus = async (tableId, newStatus) => {
    try {
      const res = await api(`/tables/${tableId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        setTables(prev => prev.map(t => (t.id === tableId ? { ...t, status: newStatus } : t)));
        onFlash?.(`Table status updated to ${newStatus}`, 'success');
      }
    } catch (err) {
      onFlash?.(err.message || 'Could not update table status', 'error');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'vacant':
        return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', label: 'Vacant' };
      case 'occupied':
        return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', label: 'Occupied' };
      case 'ordered':
        return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', label: 'Open Tab' };
      case 'bill_printed':
        return { bg: '#faf5ff', border: '#e9d5ff', text: '#9333ea', label: 'Bill Printed' };
      default:
        return { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', label: 'Available' };
    }
  };

  const activeTablesCount = tables.filter(t => t.status === 'ordered').length;
  const vacantTablesCount = tables.filter(t => t.status === 'vacant').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 840 }} onClick={e => e.stopPropagation()}>
        <div className="modal-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">DINE-IN FLOOR PLAN</span>
            <h2>Restaurant Tables & Open Tabs</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="icon-btn" onClick={loadTables} title="Refresh Tables">
              <RefreshCw size={17} />
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Status Legend */}
        <div style={{
          display: 'flex',
          gap: 12,
          padding: '8px 14px',
          background: '#f8fafc',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a' }}></span>
            Vacant ({vacantTablesCount})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }}></span>
            Open Tabs ({activeTablesCount})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }}></span>
            Occupied
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9333ea' }}></span>
            Bill Printed
          </span>
        </div>

        {/* Visual Table Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 14,
          maxHeight: 460,
          overflowY: 'auto',
          paddingRight: 4
        }}>
          {tables.map(table => {
            const colors = getStatusColor(table.status);
            const isCurrentSelected = selectedTable === table.table_number;
            const hasOpenTab = table.status === 'ordered' && table.items?.length > 0;

            return (
              <div
                key={table.id}
                style={{
                  border: isCurrentSelected ? '2px solid #0284c7' : `1px solid ${colors.border}`,
                  background: colors.bg,
                  borderRadius: 12,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isCurrentSelected ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>{table.table_number}</strong>
                    <span className="pill" style={{
                      fontSize: 10,
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      padding: '2px 6px'
                    }}>
                      {colors.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={12} /> {table.capacity} Seats
                  </div>

                  {hasOpenTab && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px solid #fed7aa' }}>
                      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Running Bill:</span>
                        <span>{money(table.total)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                        {table.items.length} items ordered
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexDirection: 'column' }}>
                  {hasOpenTab ? (
                    <button
                      type="button"
                      className="primary-btn small"
                      onClick={() => {
                        onLoadActiveTableOrder(table);
                        onClose();
                      }}
                      style={{ width: '100%', fontSize: 11, padding: '5px 8px' }}
                    >
                      <DollarSign size={13} /> View & Settle Tab
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={isCurrentSelected ? 'primary-btn small' : 'secondary-btn small'}
                      onClick={() => {
                        onSelectTable(table.table_number);
                        onClose();
                      }}
                      style={{ width: '100%', fontSize: 11, padding: '5px 8px' }}
                    >
                      {isCurrentSelected ? 'Active in Cart' : 'Assign to Cart'}
                    </button>
                  )}

                  {table.status === 'vacant' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(table.id, 'occupied')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                    >
                      Seat Guests
                    </button>
                  )}

                  {table.status === 'occupied' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(table.id, 'vacant')}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                    >
                      Free Table
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
