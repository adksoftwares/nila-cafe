import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Sliders,
  RefreshCw,
  Search,
  Filter,
  Clock,
  User,
  Info,
  X,
  FileCode,
  Download
} from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import { money } from '../utils/formatters.js';

export default function AuditPage({ api, onFlash }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    voidsCount: 0,
    drawerKicksCount: 0,
    adjustmentsCount: 0,
    dangerCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [search, setSearch] = useState('');

  // Selected Log for JSON Drawer Modal
  const [inspectLog, setInspectLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (category !== 'all') q.set('category', category);
      if (severity !== 'all') q.set('severity', severity);
      if (search.trim()) q.set('search', search.trim());
      q.set('limit', '100');

      const [logsRes, statsRes] = await Promise.all([
        api(`/audit-logs?${q.toString()}`),
        api('/audit-logs/stats')
      ]);

      setLogs(logsRes.logs || []);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      onFlash?.(err.message || 'Failed to fetch audit records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [category, severity]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleExportCSV = () => {
    if (!logs.length) {
      onFlash?.('No audit records to export.', 'info');
      return;
    }

    const headers = ['Timestamp', 'Action', 'Severity', 'Category', 'Actor', 'Role', 'Details'];
    const rows = logs.map(l => [
      `"${new Date(l.created_at).toLocaleString()}"`,
      `"${l.action}"`,
      `"${l.severity || l.details?.severity || 'info'}"`,
      `"${l.category || l.details?.category || 'general'}"`,
      `"${l.user_name || l.details?.userName || 'System'}"`,
      `"${l.user_role || l.details?.userRole || 'system'}"`,
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `adk_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onFlash?.('Audit trail exported to CSV successfully.', 'success');
  };

  const formatRelativeTime = (timestamp) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getSeverityBadge = (sev) => {
    if (sev === 'danger') {
      return <span className="pill" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 'bold' }}>🔴 Danger</span>;
    }
    if (sev === 'warning') {
      return <span className="pill" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 'bold' }}>🟡 Warning</span>;
    }
    return <span className="pill" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 'bold' }}>🟢 Info</span>;
  };

  const renderDetailsSummary = (log) => {
    const d = log.details || {};
    switch (log.action) {
      case 'SALE_VOID':
        return (
          <span>
            Voided bill <strong>{d.billNumber || d.saleId}</strong> for <strong>{money(d.total || 0)}</strong>.
            {d.reason && <span> Reason: <em>"{d.reason}"</em>.</span>}
            {d.authorizedByName && <span> Authorized by: <strong>{d.authorizedByName}</strong>.</span>}
          </span>
        );
      case 'SALE_COMPLETED':
        return (
          <span>
            Completed bill <strong>{d.billNumber}</strong> for <strong>{money(d.total || 0)}</strong> ({d.orderType}, {d.paymentMethod}).
          </span>
        );
      case 'DRAWER_KICK':
        return (
          <span style={{ color: '#b91c1c', fontWeight: 600 }}>
            ⚡ Physical cash drawer kick pulse triggered manually.
          </span>
        );
      case 'SHIFT_OPEN':
        return (
          <span>
            Opened register shift with float <strong>{money(d.openingFloat || 0)}</strong>.
          </span>
        );
      case 'SHIFT_ADJUSTMENT':
        return (
          <span>
            Cash {d.type === 'cash_in' ? 'inflow (+)' : 'outflow (-)'} of <strong>{money(d.amount || 0)}</strong>. Reason: <em>"{d.reason}"</em>.
          </span>
        );
      case 'SHIFT_CLOSE':
        return (
          <span>
            Closed register <strong>{d.zReportNumber}</strong>. Expected: <strong>{money(d.expectedCash || 0)}</strong>, Counted: <strong>{money(d.actualCountedCash || 0)}</strong>. Variance: <strong style={{ color: d.variance !== 0 ? '#b91c1c' : '#15803d' }}>{money(d.variance || 0)}</strong>.
          </span>
        );
      case 'INGREDIENT_RESTOCK':
        return (
          <span>
            Restocked <strong>{d.ingredientName}</strong> (+{d.deltaQty} {d.unit}). Reason: {d.reason}.
          </span>
        );
      case 'RECIPE_BOM_DELETE':
        return (
          <span>
            Removed recipe BOM mapping {d.ingredient_name ? `(${d.ingredient_name})` : `(ID: ${d.recipeId})`}.
          </span>
        );
      case 'MODIFIER_GROUP_CREATE':
        return (
          <span>
            Created modifier group <strong>"{d.name}"</strong> with {d.optionsCount} options.
          </span>
        );
      case 'MODIFIER_GROUP_DELETE':
        return (
          <span>
            Deleted modifier group <strong>"{d.name}"</strong>.
          </span>
        );
      default:
        return <span>{JSON.stringify(d).slice(0, 100)}</span>;
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">COMPLIANCE, FORENSICS & SECURITY</span>
          <h1>Security Audit Trail</h1>
          <p>Immutable forensic ledger of all fiscal till events, bill voids, stock movements, and access logs.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="secondary-btn" onClick={handleExportCSV}>
            <Download size={15} /> Export CSV
          </button>
          <button type="button" className="secondary-btn" onClick={fetchLogs}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Forensic Stat Cards */}
      <div className="stat-grid">
        <StatCard icon={ShieldCheck} label="Total Audit Events" value={stats.totalEvents} />
        <StatCard icon={AlertTriangle} label="Transactions Voided" value={stats.voidsCount} />
        <StatCard icon={Zap} label="Manual Drawer Kicks" value={stats.drawerKicksCount} />
        <StatCard icon={Sliders} label="Shift Cash Adjustments" value={stats.adjustmentsCount} />
      </div>

      {/* Filter and Search Bar */}
      <div className="table-card" style={{ marginBottom: '16px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'fiscal', label: '💰 Fiscal & Till' },
              { id: 'sales', label: '🧾 Sales & Voids' },
              { id: 'inventory', label: '📦 Inventory & BOM' },
              { id: 'menu', label: '🍽️ Menu & Modifiers' },
              { id: 'security', label: '🛡️ Security & Auth' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={category === cat.id ? 'secondary-btn active' : 'secondary-btn'}
                style={{
                  fontSize: '11px',
                  background: category === cat.id ? '#eef2ff' : '#fff',
                  borderColor: category === cat.id ? 'var(--blue)' : 'var(--line)',
                  color: category === cat.id ? 'var(--blue)' : '#475569'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Severity & Search Form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="all">All Severities</option>
              <option value="danger">🔴 Danger / High</option>
              <option value="warning">🟡 Warning</option>
              <option value="info">🟢 Info / Low</option>
            </select>

            <div className="search-box compact" style={{ margin: 0 }}>
              <Search size={14} />
              <input
                placeholder="Search actor, bill, reason…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '12px' }}
              />
            </div>
            <button type="submit" className="primary-btn small" style={{ padding: '6px 12px' }}>
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>SEVERITY</th>
                <th>ACTION</th>
                <th>ACTOR</th>
                <th>ACTIVITY SUMMARY</th>
                <th style={{ textAlign: 'right' }}>METADATA</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const sev = log.severity || log.details?.severity || 'info';

                return (
                  <tr key={log.id}>
                    {/* Timestamp */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} color="#94a3b8" />
                        <div>
                          <strong style={{ fontSize: '12px', display: 'block', color: '#1e293b' }}>
                            {formatRelativeTime(log.created_at)}
                          </strong>
                          <small style={{ fontSize: '10px', color: '#64748b' }}>
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </small>
                        </div>
                      </div>
                    </td>

                    {/* Severity Badge */}
                    <td>{getSeverityBadge(sev)}</td>

                    {/* Action Code */}
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          fontFamily: 'monospace',
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: '#0f172a'
                        }}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Actor */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} color="#64748b" />
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', display: 'block' }}>
                            {log.user_name || log.details?.userName || 'System'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>
                            {log.user_role || log.details?.userRole || 'system'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Context Summary */}
                    <td style={{ fontSize: '12px', color: '#334155' }}>
                      {renderDetailsSummary(log)}
                    </td>

                    {/* Inspect Payload Button */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="secondary-btn small"
                        onClick={() => setInspectLog(log)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '3px 8px' }}
                      >
                        <FileCode size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!logs.length && (
            <div className="empty-state" style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <ShieldCheck size={40} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ margin: '0 0 6px', color: '#334155' }}>No Audit Records Found</h3>
              <p style={{ margin: 0, fontSize: '12px' }}>
                All security, till transactions, and fiscal operations will be permanently recorded here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* JSON Inspector Slide-Over / Modal */}
      {inspectLog && (
        <div className="modal-backdrop" onClick={() => setInspectLog(null)}>
          <div
            className="modal"
            style={{ width: 'min(100%, 540px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">AUDIT FORENSIC METADATA</span>
                <h2>{inspectLog.action}</h2>
                <small style={{ color: '#64748b' }}>
                  ID: {inspectLog.id} • {new Date(inspectLog.created_at).toLocaleString()}
                </small>
              </div>
              <button type="button" className="icon-btn" onClick={() => setInspectLog(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#0f172a', padding: '16px', borderRadius: '8px', margin: '8px 0 16px' }}>
              <pre
                style={{
                  margin: 0,
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontFamily: 'Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="primary-btn" onClick={() => setInspectLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
