import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function StatCard({ icon: Icon, label, value, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon"><Icon size={17} /></span>
      </div>
      <strong className="stat-value">{value}</strong>
      {trend && (
        <span className="stat-trend">
          <ArrowUpRight size={14} />
          {trend}
        </span>
      )}
    </div>
  );
}
