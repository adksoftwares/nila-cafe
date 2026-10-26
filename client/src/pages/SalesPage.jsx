import React from 'react';
import { Download, Ban, CheckCircle2, AlertOctagon } from 'lucide-react';
import { money, exportCSV } from '../utils/formatters.js';

export default function SalesPage({ sales, onOpenVoidModal, user }) {
  const completedSales = sales.filter(s => s.status !== 'voided');
  const voidedSales = sales.filter(s => s.status === 'voided');

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TRANSACTIONS & BILLING</span>
          <h1>Sales History</h1>
          <p>Every order, payment, and void clearly accounted for with double-entry stock restoration.</p>
        </div>
        <button
          className="secondary-btn"
          onClick={() => exportCSV(sales)}
          disabled={!sales.length}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="table-card">
        <div className="table-top">
          <div>
            <h3>Recent Transactions</h3>
            <span className="muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span>{completedSales.length} Active Sales</span>
              <span>·</span>
              <span style={{ color: voidedSales.length ? '#dc2626' : 'inherit' }}>
                {voidedSales.length} Voided
              </span>
            </span>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>BILL NUMBER</th>
                <th>DATE & TIME</th>
                <th>ORDER TYPE</th>
                <th>ITEMS</th>
                <th>STATUS</th>
                <th>DISCOUNT</th>
                <th>TOTAL</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => {
                const isVoided = s.status === 'voided';
                return (
                  <tr key={s.id} style={{ opacity: isVoided ? 0.75 : 1 }}>
                    <td>
                      <strong style={{ textDecoration: isVoided ? 'line-through' : 'none' }}>
                        {s.bill_number}
                      </strong>
                      {isVoided && s.void_reason && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertOctagon size={12} />
                          <span>Void: {s.void_reason}</span>
                        </div>
                      )}
                    </td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td>
                      <span className="pill">{s.order_type}</span>
                    </td>
                    <td>
                      {s.items?.reduce(
                        (a, x) => a + (x.qty || x.quantity || 0),
                        0
                      ) || 0}
                    </td>
                    <td>
                      {isVoided ? (
                        <span className="pill" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                          Voided
                        </span>
                      ) : (
                        <span className="pill" style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      )}
                    </td>
                    <td>{money(s.discount)}</td>
                    <td>
                      {isVoided ? (
                        <s style={{ color: '#94a3b8' }}>{money(s.total)}</s>
                      ) : (
                        <strong>{money(s.total)}</strong>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!isVoided ? (
                        <button
                          className="secondary-btn small"
                          onClick={() => onOpenVoidModal(s)}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Authorize Manager Void"
                        >
                          <Ban size={13} /> Void
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                          Restocked
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!sales.length && (
          <div className="empty-state">
            No sales recorded yet. Complete an order in the POS to see it here.
          </div>
        )}
      </div>
    </>
  );
}
