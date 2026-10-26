import React from 'react';
import { Download } from 'lucide-react';
import { money, exportCSV } from '../utils/formatters.js';

export default function SalesPage({ sales }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TRANSACTIONS & BILLING</span>
          <h1>Sales History</h1>
          <p>Every order, payment, and receipt clearly accounted for.</p>
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
          <h3>Recent Transactions</h3>
          <span className="muted">{sales.length} records on this device</span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>BILL NUMBER</th>
                <th>DATE & TIME</th>
                <th>ORDER TYPE</th>
                <th>ITEMS</th>
                <th>DISCOUNT</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.bill_number}</strong>
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
                  <td>{money(s.discount)}</td>
                  <td>
                    <strong>{money(s.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sales.length && (
          <div className="empty-state">
            No sales recorded on this device yet. Complete an order in the POS to see it here.
          </div>
        )}
      </div>
    </>
  );
}
