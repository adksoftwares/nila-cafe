import React, { useEffect, useState } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle, Flame, Check, RefreshCw, Volume2 } from 'lucide-react';
import { API } from '../utils/constants.js';

export default function KDSPage({ token, onFlash }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'preparing' | 'ready'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Play audio chime using Web Audio API (synthetic, 100% reliable without external audio assets)
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Fetch initial active kitchen orders
  const fetchOrders = () => {
    fetch(`${API}/kds/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.orders)) {
          setOrders(d.orders);
        }
      })
      .catch(() => {});
  };

  // Live timer tick every 10 seconds to update elapsed order minutes
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Connect to Real-time SSE Stream
  useEffect(() => {
    fetchOrders();

    const streamUrl = `${API}/kds/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('order:new', (e) => {
      try {
        const data = JSON.parse(e.data);
        const newOrder = {
          id: data.id || data.sale?.id,
          bill_number: data.bill_number || data.sale?.bill_number,
          order_type: data.order_type || data.sale?.order_type,
          table_number: data.table_number || data.sale?.table_number,
          kitchen_status: 'pending',
          created_at: data.created_at || data.sale?.created_at || new Date().toISOString(),
          items: data.items || []
        };
        setOrders(prev => [newOrder, ...prev]);
        playChime();
        onFlash(`New Kitchen Order: ${newOrder.bill_number}`);
      } catch {}
    });

    eventSource.addEventListener('order:status', (e) => {
      try {
        const { orderId, kitchen_status } = JSON.parse(e.data);
        if (kitchen_status === 'served') {
          setOrders(prev => prev.filter(o => String(o.id) !== String(orderId)));
        } else {
          setOrders(prev =>
            prev.map(o => (String(o.id) === String(orderId) ? { ...o, kitchen_status } : o))
          );
        }
      } catch {}
    });

    return () => {
      eventSource.close();
    };
  }, [token]);

  // Update order status action
  const handleUpdateStatus = (orderId, nextStatus) => {
    fetch(`${API}/kds/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: nextStatus })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (nextStatus === 'served') {
            setOrders(prev => prev.filter(o => String(o.id) !== String(orderId)));
            onFlash('Order marked as served.');
          } else {
            setOrders(prev =>
              prev.map(o => (String(o.id) === String(orderId) ? { ...o, kitchen_status: nextStatus } : o))
            );
          }
        }
      })
      .catch(err => onFlash(err.message));
  };

  const visibleOrders = orders.filter(
    o => filter === 'all' || o.kitchen_status === filter
  );

  const formatElapsed = (createdAt) => {
    const mins = Math.floor((now - new Date(createdAt).getTime()) / 60000);
    return mins <= 0 ? 'Just now' : `${mins} min${mins > 1 ? 's' : ''} ago`;
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BARISTA & KITCHEN DISPLAY SYSTEM</span>
          <h1>Kitchen Orders (KDS) 🧑‍🍳</h1>
          <p>Real-time live queue of incoming coffee, food, and dining orders.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ fontSize: '11px', color: soundEnabled ? 'var(--blue)' : '#94a3b8' }}
          >
            <Volume2 size={15} /> {soundEnabled ? 'Chime Alert: ON' : 'Chime Alert: OFF'}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={fetchOrders}
            title="Refresh order queue"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs & Queue Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: `All Active (${orders.length})` },
            { id: 'pending', label: `New / Pending (${orders.filter(o => o.kitchen_status === 'pending').length})` },
            { id: 'preparing', label: `Preparing (${orders.filter(o => o.kitchen_status === 'preparing').length})` },
            { id: 'ready', label: `Ready for Pickup (${orders.filter(o => o.kitchen_status === 'ready').length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={filter === t.id ? 'secondary-btn active' : 'secondary-btn'}
              style={{
                fontSize: '11px',
                background: filter === t.id ? '#eef2ff' : '#fff',
                borderColor: filter === t.id ? 'var(--blue)' : 'var(--line)',
                color: filter === t.id ? 'var(--blue)' : '#475569'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Order Grid */}
      {visibleOrders.length === 0 ? (
        <div className="table-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <ChefHat size={45} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#334155' }}>All Orders are Clear!</h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
            New tickets will appear here with a real-time chime notification the moment an order is placed at the counter.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
          {visibleOrders.map(order => {
            const isPending = order.kitchen_status === 'pending';
            const isPreparing = order.kitchen_status === 'preparing';
            const isReady = order.kitchen_status === 'ready';

            const cardBorder = isPending ? '#f59e0b' : isPreparing ? '#3b82f6' : '#10b981';
            const cardBg = isPending ? '#fffdf7' : isPreparing ? '#f8fafd' : '#f0fdf4';

            return (
              <div
                key={order.id}
                style={{
                  background: cardBg,
                  borderRadius: '12px',
                  border: `2px solid ${cardBorder}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                {/* Order Card Header */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{order.bill_number}</strong>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                      <span style={{ fontSize: '10px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
                        {order.order_type}
                      </span>
                      {order.table_number && (
                        <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {order.table_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#64748b' }}>
                      <Clock size={12} />
                      {formatElapsed(order.created_at)}
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: '3px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: isPending ? '#fef3c7' : isPreparing ? '#dbeafe' : '#d1fae5',
                        color: isPending ? '#b45309' : isPreparing ? '#1d4ed8' : '#047857'
                      }}
                    >
                      {order.kitchen_status}
                    </span>
                  </div>
                </div>

                {/* Items & Notes List */}
                <div style={{ padding: '14px', flex: 1 }}>
                  {order.items?.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '10px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                          {item.qty || item.quantity} × {item.name || item.product_name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>[{item.code || 'ITEM'}]</span>
                      </div>
                      {item.notes && (
                        <div style={{ marginTop: '4px', background: '#fee2e2', color: '#991b1b', padding: '3px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} />
                          NOTE: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick Action Button */}
                <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'preparing')}
                      style={{
                        width: '100%',
                        padding: '9px',
                        borderRadius: '6px',
                        border: 0,
                        background: '#3b82f6',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Flame size={15} /> Start Preparing
                    </button>
                  )}

                  {isPreparing && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      style={{
                        width: '100%',
                        padding: '9px',
                        borderRadius: '6px',
                        border: 0,
                        background: '#10b981',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <CheckCircle size={15} /> Mark as Ready for Pickup
                    </button>
                  )}

                  {isReady && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order.id, 'served')}
                      style={{
                        width: '100%',
                        padding: '9px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#475569',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={15} /> Complete & Mark Served
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
