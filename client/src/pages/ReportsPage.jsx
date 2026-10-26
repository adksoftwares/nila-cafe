import React from 'react';
import { Wallet, Receipt, ArrowDownRight, Package, Activity, Download } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import { money, exportCSV } from '../utils/formatters.js';

export default function ReportsPage({ sales, products, onGoToProducts }) {
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalDiscounts = sales.reduce((s, x) => s + x.discount, 0);

  const orderTypes = ['takeaway', 'delivery', 'dining'];
  const maxOrderTypeValue = Math.max(
    1,
    ...orderTypes.map(k =>
      sales.filter(s => s.order_type === k).reduce((a, s) => a + s.total, 0)
    )
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUSINESS INSIGHTS</span>
          <h1>Reports & Analytics</h1>
          <p>A quick, clean snapshot of your cafe's daily performance.</p>
        </div>
        <button
          className="secondary-btn"
          onClick={() => exportCSV(sales)}
          disabled={!sales.length}
        >
          <Download size={16} /> Export sales
        </button>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={Wallet}
          label="Recorded sales"
          value={money(totalRevenue)}
          trend="Total revenue"
        />
        <StatCard
          icon={Receipt}
          label="Completed bills"
          value={sales.length}
          trend="Completed orders"
        />
        <StatCard
          icon={ArrowDownRight}
          label="Discounts given"
          value={money(totalDiscounts)}
          trend="All discounts"
        />
        <StatCard
          icon={Package}
          label="Products"
          value={products.length}
          trend="Active menu items"
        />
      </div>

      <div className="report-grid">
        <div className="table-card">
          <div className="table-top">
            <h3>Sales by Order Channel</h3>
          </div>

          {orderTypes.map(t => {
            const val = sales
              .filter(s => s.order_type === t)
              .reduce((a, s) => a + s.total, 0);

            return (
              <div className="bar-row" key={t}>
                <div>
                  <span>{t[0].toUpperCase() + t.slice(1)}</span>
                  <strong>{money(val)}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(val / maxOrderTypeValue) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}

          <p className="report-note">
            Reports aggregate sales transactions recorded in your workspace. Connect PostgreSQL for centralized multi-device reports.
          </p>
        </div>

        <div className="insight-card">
          <div className="insight-icon">
            <Activity size={20} />
          </div>
          <h3>Continuous Growth & Insights</h3>
          <p>
            With your database connected, track sales trends across time, identify peak coffee hours, monitor top-selling items, and manage ingredient reorders.
          </p>
          <button className="text-button" onClick={onGoToProducts}>
            Review inventory →
          </button>
        </div>
      </div>
    </>
  );
}
