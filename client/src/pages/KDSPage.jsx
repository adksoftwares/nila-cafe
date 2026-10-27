import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  Clock,
  AlertTriangle,
  CheckCircle,
  Flame,
  Check,
  RefreshCw,
  Volume2,
  Coffee,
  Utensils,
  CheckSquare,
  Square,
  Timer
} from 'lucide-react';
import { API } from '../utils/constants.js';

// Station Category Matcher
const isBaristaItem = (item) => {
  if (item.station === 'barista') return true;
  if (item.station === 'kitchen') return false;
  const cat = String(item.category || '').toLowerCase();
  if (['drinks', 'beverages', 'coffee', 'juices', 'tea', 'shakes', 'smoothies'].includes(cat)) return true;
  const text = `${item.name || item.product_name || ''} ${item.code || ''}`.toLowerCase();
  return /coffee|tea|juice|latte|cappuccino|espresso|mocha|beverage|drink|shake|smoothie|frappe|brew|chai/.test(text);
};

export default function KDSPage({ token, onFlash }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'preparing' | 'ready'
  const [stationFilter, setStationFilter] = useState('all'); // 'all' | 'barista' | 'kitchen'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Play audio chime using Web Audio API (synthetic, 100% reliable)
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

  // High-resolution live timer tick every 1000ms (1 second) for real-time MM:SS precision
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
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
        const enrichedItems = (data.items || []).map((it, idx) => ({
          ...it,
          id: it.id || `item-${idx + 1}`,
          status: it.status || 'pending',
          station: it.station || (isBaristaItem(it) ? 'barista' : 'kitchen')
        }));

        const newOrder = {
          id: data.id || data.sale?.id,
          bill_number: data.bill_number || data.sale?.bill_number,
          order_type: data.order_type || data.sale?.order_type,
          table_number: data.table_number || data.sale?.table_number,
          kitchen_status: 'pending',
          created_at: data.created_at || data.sale?.created_at || new Date().toISOString(),
          items: enrichedItems
        };
        setOrders(prev => [newOrder, ...prev]);
        playChime();
        onFlash(`New Kitchen Order: ${newOrder.bill_number}`);
      } catch {}
    });

    eventSource.addEventListener('order:status', (e) => {
      try {
        const { orderId, kitchen_status, items } = JSON.parse(e.data);
        if (kitchen_status === 'served') {
          setOrders(prev => prev.filter(o => String(o.id) !== String(orderId)));
        } else {
          setOrders(prev =>
            prev.map(o => {
              if (String(o.id) === String(orderId)) {
                return {
                  ...o,
                  kitchen_status,
                  items: items || (kitchen_status === 'ready' ? o.items?.map(i => ({ ...i, status: 'ready' })) : o.items)
                };
              }
              return o;
            })
          );
        }
      } catch {}
    });

    eventSource.addEventListener('order:item_status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setOrders(prev =>
          prev.map(o => {
            if (String(o.id) !== String(data.orderId)) return o;
            const updatedItems = o.items.map(i =>
              String(i.id) === String(data.itemId) ? { ...i, status: data.status } : i
            );
            return {
              ...o,
              kitchen_status: data.kitchen_status || o.kitchen_status,
              items: updatedItems
            };
          })
        );
      } catch {}
    });

    return () => {
      eventSource.close();
    };
  }, [token]);

  // Update overall order status (pending -> preparing -> ready -> served)
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
              prev.map(o => {
                if (String(o.id) !== String(orderId)) return o;
                return {
                  ...o,
                  kitchen_status: nextStatus,
                  items: nextStatus === 'ready' ? o.items?.map(i => ({ ...i, status: 'ready' })) : o.items
                };
              })
            );
          }
        }
      })
      .catch(err => onFlash(err.message));
  };

  // Line-Item Level Bumping: Toggle individual item ready / pending
  const handleToggleItem = (orderId, itemId, currentStatus) => {
    const nextStatus = currentStatus === 'ready' ? 'pending' : 'ready';

    // Optimistic UI update
    setOrders(prev =>
      prev.map(o => {
        if (String(o.id) !== String(orderId)) return o;
        const updatedItems = o.items.map(i =>
          String(i.id) === String(itemId) ? { ...i, status: nextStatus } : i
        );
        const allReady = updatedItems.length > 0 && updatedItems.every(i => i.status === 'ready');
        const anyReady = updatedItems.some(i => i.status === 'ready');

        let nextOrderStatus = o.kitchen_status;
        if (allReady) nextOrderStatus = 'ready';
        else if (anyReady && o.kitchen_status === 'pending') nextOrderStatus = 'preparing';
        else if (!allReady && o.kitchen_status === 'ready') nextOrderStatus = 'preparing';

        return {
          ...o,
          kitchen_status: nextOrderStatus,
          items: updatedItems
        };
      })
    );

    fetch(`${API}/kds/orders/${orderId}/items/${itemId}/bump`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: nextStatus })
    })
      .then(r => r.json())
      .then(d => {
        if (!d.success) {
          // Revert on error
          fetchOrders();
          onFlash(d.error || 'Failed to update item.');
        }
      })
      .catch(() => {
        fetchOrders();
        onFlash('Network error updating item.');
      });
  };

  // SLA Classification & MM:SS Timer Calculator
  const getTimerInfo = (createdAt) => {
    const elapsedMs = Math.max(0, now - new Date(createdAt).getTime());
    const totalSecs = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (mins < 5) {
      return {
        formatted,
        mins,
        sla: 'fresh',
        badge: '🟢 Fresh (< 5m)',
        color: '#10b981',
        bgColor: '#ecfdf5',
        borderColor: '#10b981',
        isDelayed: false
      };
    }
    if (mins < 10) {
      return {
        formatted,
        mins,
        sla: 'warning',
        badge: '🟡 Warning (5-10m)',
        color: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#f59e0b',
        isDelayed: false
      };
    }
    return {
      formatted,
      mins,
      sla: 'delayed',
      badge: '🔴 Delayed (> 10m)',
      color: '#dc2626',
      bgColor: '#fef2f2',
      borderColor: '#ef4444',
      isDelayed: true
    };
  };

  // Station counts
  const baristaCount = orders.filter(o => o.items?.some(isBaristaItem)).length;
  const kitchenCount = orders.filter(o => o.items?.some(i => !isBaristaItem(i))).length;
  const allCount = orders.length;

  // Filter orders by Status AND Station
  const visibleOrders = orders.filter(order => {
    const matchesStatus = filter === 'all' || order.kitchen_status === filter;
    if (!matchesStatus) return false;

    if (stationFilter === 'barista') {
      return order.items?.some(isBaristaItem);
    }
    if (stationFilter === 'kitchen') {
      return order.items?.some(i => !isBaristaItem(i));
    }
    return true;
  });

  return (
    <>
      <style>{`
        @keyframes kdsPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .kds-card-delayed {
          animation: kdsPulse 2s infinite ease-in-out;
        }
      `}</style>

      <div className="page-heading">
        <div>
          <span className="eyebrow">BARISTA & KITCHEN DISPLAY SYSTEM</span>
          <h1>Kitchen Display System (KDS) 🧑‍🍳</h1>
          <p>Real-time live queue with station routing, item-level bumping, and SLA timers.</p>
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

      {/* Station Routing Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          background: '#f1f5f9',
          padding: '6px',
          borderRadius: '10px',
          width: 'fit-content'
        }}
      >
        <button
          type="button"
          onClick={() => setStationFilter('all')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '7px',
            border: 0,
            fontSize: '12px',
            fontWeight: stationFilter === 'all' ? 'bold' : 'normal',
            background: stationFilter === 'all' ? '#fff' : 'transparent',
            color: stationFilter === 'all' ? '#0f172a' : '#64748b',
            boxShadow: stationFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer'
          }}
        >
          <ChefHat size={16} /> All Stations ({allCount})
        </button>

        <button
          type="button"
          onClick={() => setStationFilter('barista')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '7px',
            border: 0,
            fontSize: '12px',
            fontWeight: stationFilter === 'barista' ? 'bold' : 'normal',
            background: stationFilter === 'barista' ? '#fff' : 'transparent',
            color: stationFilter === 'barista' ? '#2563eb' : '#64748b',
            boxShadow: stationFilter === 'barista' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer'
          }}
        >
          <Coffee size={16} color="#2563eb" /> ☕ Barista Station ({baristaCount})
        </button>

        <button
          type="button"
          onClick={() => setStationFilter('kitchen')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '7px',
            border: 0,
            fontSize: '12px',
            fontWeight: stationFilter === 'kitchen' ? 'bold' : 'normal',
            background: stationFilter === 'kitchen' ? '#fff' : 'transparent',
            color: stationFilter === 'kitchen' ? '#ea580c' : '#64748b',
            boxShadow: stationFilter === 'kitchen' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer'
          }}
        >
          <Utensils size={16} color="#ea580c" /> 🍳 Hot Kitchen ({kitchenCount})
        </button>
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
          <h3 style={{ margin: '0 0 6px', color: '#334155' }}>
            {stationFilter === 'barista'
              ? 'No active drinks in Barista queue!'
              : stationFilter === 'kitchen'
              ? 'No active orders in Kitchen queue!'
              : 'All Orders are Clear!'}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
            New tickets will appear here with real-time audio chime notifications the instant an order is placed.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
          {visibleOrders.map(order => {
            const timer = getTimerInfo(order.created_at);
            const isPending = order.kitchen_status === 'pending';
            const isPreparing = order.kitchen_status === 'preparing';
            const isReady = order.kitchen_status === 'ready';

            // Check if all items in this ticket are bumped ready
            const allItemsBumped = Array.isArray(order.items) && order.items.length > 0 && order.items.every(i => i.status === 'ready');
            const itemsReadyCount = (order.items || []).filter(i => i.status === 'ready').length;
            const itemsTotalCount = (order.items || []).length;

            return (
              <div
                key={order.id}
                className={timer.isDelayed ? 'kds-card-delayed' : ''}
                style={{
                  background: isReady ? '#f0fdf4' : '#ffffff',
                  borderRadius: '12px',
                  border: `2px solid ${timer.borderColor}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Order Card Header */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #e2e8f0',
                    background: timer.bgColor,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{order.bill_number}</strong>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          background: '#e2e8f0',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}
                      >
                        {order.order_type}
                      </span>
                      {order.table_number && (
                        <span
                          style={{
                            fontSize: '10px',
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}
                        >
                          {order.table_number}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '10px',
                          background: isReady ? '#d1fae5' : isPreparing ? '#dbeafe' : '#fef3c7',
                          color: isReady ? '#047857' : isPreparing ? '#1d4ed8' : '#b45309',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        {order.kitchen_status}
                      </span>
                    </div>
                  </div>

                  {/* Visual Elapsed Timer & SLA Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '4px',
                        fontSize: '14px',
                        fontWeight: '800',
                        color: timer.color,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      <Timer size={14} />
                      {timer.formatted}
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: '3px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#fff',
                        border: `1px solid ${timer.borderColor}`,
                        color: timer.color
                      }}
                    >
                      {timer.badge}
                    </span>
                  </div>
                </div>

                {/* Items & Bumping Checklist */}
                <div style={{ padding: '12px 14px', flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '10px',
                      color: '#64748b',
                      marginBottom: '8px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}
                  >
                    <span>Line Items ({itemsReadyCount}/{itemsTotalCount} Ready)</span>
                    <span>Tap item to bump</span>
                  </div>

                  {order.items?.map((item, idx) => {
                    const isBarista = isBaristaItem(item);
                    const isItemReady = item.status === 'ready';
                    const isHighlightedStation =
                      stationFilter === 'all' ||
                      (stationFilter === 'barista' && isBarista) ||
                      (stationFilter === 'kitchen' && !isBarista);

                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => handleToggleItem(order.id, item.id || `item-${idx + 1}`, item.status)}
                        style={{
                          marginBottom: '8px',
                          border: isItemReady ? '1px solid #86efac' : '1px solid #e2e8f0',
                          background: isItemReady ? '#f0fdf4' : isHighlightedStation ? '#fff' : '#f8fafc',
                          opacity: isHighlightedStation ? 1 : 0.6,
                          borderRadius: '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isItemReady ? (
                              <CheckSquare size={16} color="#16a34a" />
                            ) : (
                              <Square size={16} color="#94a3b8" />
                            )}
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 'bold',
                                color: isItemReady ? '#16a34a' : '#1e293b',
                                textDecoration: isItemReady ? 'line-through' : 'none'
                              }}
                            >
                              {item.qty || item.quantity} × {item.name || item.product_name}
                            </span>
                          </div>

                          {/* Station Pill */}
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isBarista ? '#eff6ff' : '#fff7ed',
                              color: isBarista ? '#2563eb' : '#c2410c',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            {isBarista ? <Coffee size={10} /> : <Utensils size={10} />}
                            {isBarista ? 'Barista' : 'Kitchen'}
                          </span>
                        </div>

                        {/* Modifiers List */}
                        {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                          <div style={{ marginTop: '4px', paddingLeft: '24px', fontSize: '11px', color: '#475569' }}>
                            {item.modifiers.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                style={{
                                  display: 'inline-block',
                                  marginRight: '6px',
                                  background: '#f1f5f9',
                                  padding: '1px 5px',
                                  borderRadius: '3px'
                                }}
                              >
                                + {m.name || m.title}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Kitchen Preparation Note */}
                        {item.notes && (
                          <div
                            style={{
                              marginTop: '5px',
                              marginLeft: '24px',
                              background: '#fee2e2',
                              color: '#991b1b',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <AlertTriangle size={12} />
                            NOTE: {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {allItemsBumped && !isReady && (
                    <div
                      style={{
                        marginTop: '8px',
                        background: '#dcfce7',
                        color: '#15803d',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}
                    >
                      🎉 All items ready! Advance ticket to pickup.
                    </div>
                  )}
                </div>

                {/* Quick Action Button Bar */}
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
                      <Flame size={15} /> Start Preparing Ticket
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
                      <CheckCircle size={15} /> Mark Ticket Ready for Pickup
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
