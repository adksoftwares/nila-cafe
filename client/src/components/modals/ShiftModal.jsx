import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Eye,
  EyeOff,
  Coins,
  FileSpreadsheet
} from 'lucide-react';
import { money } from '../../utils/formatters.js';
import { useShift } from '../../context/ShiftContext.jsx';

const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20];

export default function ShiftModal({
  shift: propShift,
  shiftSummary: propSummary,
  onOpenShift: propOpenShift,
  onCloseShift: propCloseShift,
  onAddAdjustment: propAddAdjustment,
  onCloseModal
}) {
  const shiftCtx = useShift();
  const shift = propShift !== undefined ? propShift : shiftCtx.shift;
  const shiftSummary = propSummary !== undefined ? propSummary : shiftCtx.shiftSummary;
  const onOpenShift = propOpenShift || shiftCtx.openShift;
  const onCloseShift = propCloseShift || shiftCtx.closeShift;
  const onAddAdjustment = propAddAdjustment || shiftCtx.addAdjustment;
  const getXReport = shiftCtx.getXReport;
  const printXReport = shiftCtx.printXReport;
  const printZReport = shiftCtx.printZReport;

  const [tab, setTab] = useState(shift ? 'status' : 'open');
  const [openingFloat, setOpeningFloat] = useState('5000');
  const [openNotes, setOpenNotes] = useState('');

  const [adjType, setAdjType] = useState('cash_out');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Blind Reconciliation State
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [showExpectedTarget, setShowExpectedTarget] = useState(false);
  const [denominations, setDenominations] = useState({
    '5000': '',
    '1000': '',
    '500': '',
    '100': '',
    '50': '',
    '20': ''
  });

  // Interim X-Report State
  const [xReportData, setXReportData] = useState(null);
  const [loadingXReport, setLoadingXReport] = useState(false);
  const [lastZReport, setLastZReport] = useState(null);

  const expectedCash = shiftSummary?.expectedCash ?? (shift?.opening_float || 0);
  const countedNum = Number(actualCash) || 0;
  const variance = Math.round((countedNum - expectedCash) * 100) / 100;

  // Handle denomination changes
  const handleDenomChange = (val, count) => {
    const updated = { ...denominations, [val]: count };
    setDenominations(updated);

    // Sum all denominations
    let sum = 0;
    for (const [dVal, dCount] of Object.entries(updated)) {
      const c = parseInt(dCount, 10) || 0;
      sum += Number(dVal) * c;
    }
    setActualCash(sum > 0 ? String(sum) : '');
  };

  // Fetch X-Report on tab click
  useEffect(() => {
    if (tab === 'xreport' && getXReport && !xReportData) {
      setLoadingXReport(true);
      getXReport()
        .then(d => {
          if (d?.xReport) setXReportData(d.xReport);
        })
        .finally(() => setLoadingXReport(false));
    }
  }, [tab, getXReport]);

  const handleStartShiftSubmit = (e) => {
    e.preventDefault();
    onOpenShift({ openingFloat: Number(openingFloat), notes: openNotes });
  };

  const handleAdjSubmit = (e) => {
    e.preventDefault();
    onAddAdjustment({ type: adjType, amount: Number(adjAmount), reason: adjReason });
    setAdjAmount('');
    setAdjReason('');
    setTab('status');
  };

  const handleCloseShiftSubmit = async (e) => {
    e.preventDefault();
    if (variance !== 0 && !varianceReason.trim()) {
      alert('A reason is required when there is a cash drawer variance (shortage or overage).');
      return;
    }

    const result = await onCloseShift({
      actualCash: countedNum,
      notes: closeNotes,
      denominations,
      varianceReason: varianceReason.trim()
    });

    if (result?.zReport) {
      setLastZReport(result.zReport);
      setTab('zreport');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCloseModal}>
      <div className="modal" style={{ width: 'min(100%, 560px)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">TILL & CASH RECONCILIATION</span>
            <h2>
              {tab === 'zreport'
                ? `Official Z-Report #${lastZReport?.zReportNumber || ''}`
                : tab === 'xreport'
                ? 'Interim Mid-Shift X-Report'
                : tab === 'open'
                ? 'Open New Shift'
                : 'Cashier Shift Management'}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCloseModal}>
            <X size={19} />
          </button>
        </div>

        {shift && tab !== 'zreport' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '18px' }}>
            <button
              type="button"
              className={tab === 'status' ? 'secondary-btn active' : 'secondary-btn'}
              style={{ fontSize: '11px', background: tab === 'status' ? '#eff2ff' : '#fff', borderColor: tab === 'status' ? 'var(--blue)' : 'var(--line)' }}
              onClick={() => setTab('status')}
            >
              Till Status
            </button>
            <button
              type="button"
              className={tab === 'adjust' ? 'secondary-btn active' : 'secondary-btn'}
              style={{ fontSize: '11px', background: tab === 'adjust' ? '#eff2ff' : '#fff', borderColor: tab === 'adjust' ? 'var(--blue)' : 'var(--line)' }}
              onClick={() => setTab('adjust')}
            >
              ± Petty Cash
            </button>
            <button
              type="button"
              className={tab === 'xreport' ? 'secondary-btn active' : 'secondary-btn'}
              style={{ fontSize: '11px', background: tab === 'xreport' ? '#eff2ff' : '#fff', borderColor: tab === 'xreport' ? 'var(--blue)' : 'var(--line)' }}
              onClick={() => {
                setXReportData(null);
                setTab('xreport');
              }}
            >
              X-Report
            </button>
            <button
              type="button"
              className={tab === 'close' ? 'secondary-btn active' : 'secondary-btn'}
              style={{ fontSize: '11px', background: tab === 'close' ? '#fff1f2' : '#fff', borderColor: tab === 'close' ? '#e11d48' : 'var(--line)', color: tab === 'close' ? '#e11d48' : '#475569' }}
              onClick={() => setTab('close')}
            >
              End Shift (Z)
            </button>
          </div>
        )}

        {/* 1. OPEN SHIFT FORM */}
        {!shift && tab === 'open' && (
          <form onSubmit={handleStartShiftSubmit}>
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                <Clock size={16} color="var(--blue)" />
                <strong style={{ fontSize: '12px' }}>Start Daily Cashier Shift</strong>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Count and enter the initial small change and cash float present in the cash drawer.
              </p>
            </div>

            <label>Opening Cash Float (LKR)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={openingFloat}
              onChange={e => setOpeningFloat(e.target.value)}
              placeholder="e.g. 5000"
            />

            <label style={{ marginTop: '12px' }}>Shift Notes / Float Breakdown</label>
            <input
              type="text"
              value={openNotes}
              onChange={e => setOpenNotes(e.target.value)}
              placeholder="e.g. Denominations: 500x8, 100x10"
            />

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onCloseModal}>
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Open Till & Unlock POS
              </button>
            </div>
          </form>
        )}

        {/* 2. TILL STATUS OVERVIEW */}
        {shift && tab === 'status' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b' }}>Shift Started</small>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b' }}>Opening Float</small>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {money(shift.opening_float)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b' }}>Bills Processed</small>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {shiftSummary?.bills || 0} orders
                </div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <small style={{ color: '#166534' }}>Expected Cash in Till</small>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#15803d' }}>
                  {money(expectedCash)}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onCloseModal}>
                Close Dialog
              </button>
              <button type="button" className="primary-btn" onClick={() => setTab('close')}>
                Close Shift (Z-Report)
              </button>
            </div>
          </div>
        )}

        {/* 3. PETTY CASH IN / OUT */}
        {shift && tab === 'adjust' && (
          <form onSubmit={handleAdjSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => setAdjType('cash_out')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: adjType === 'cash_out' ? '2px solid #e11d48' : '1px solid #e2e8f0',
                  background: adjType === 'cash_out' ? '#fff1f2' : '#fff',
                  color: adjType === 'cash_out' ? '#e11d48' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowDownRight size={16} /> Cash Out (Payout / Expense)
              </button>
              <button
                type="button"
                onClick={() => setAdjType('cash_in')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: adjType === 'cash_in' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                  background: adjType === 'cash_in' ? '#f0fdf4' : '#fff',
                  color: adjType === 'cash_in' ? '#15803d' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowUpRight size={16} /> Cash In (Add Float)
              </button>
            </div>

            <label>Amount (LKR)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              required
              value={adjAmount}
              onChange={e => setAdjAmount(e.target.value)}
              placeholder="e.g. 500"
            />

            <label style={{ marginTop: '12px' }}>Reason / Purpose</label>
            <input
              type="text"
              required
              value={adjReason}
              onChange={e => setAdjReason(e.target.value)}
              placeholder={adjType === 'cash_out' ? 'e.g. Bought 2L emergency fresh milk' : 'e.g. Replenished 100-rupee notes'}
            />

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setTab('status')}>
                Back
              </button>
              <button type="submit" className="primary-btn">
                Save Till Adjustment
              </button>
            </div>
          </form>
        )}

        {/* 4. INTERIM X-REPORT TAB */}
        {shift && tab === 'xreport' && (
          <div>
            {loadingXReport ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                Computing interim shift statistics...
              </div>
            ) : xReportData ? (
              <div>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1' }}>
                      📋 INTERIM X-READING (Shift Remains Active)
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {new Date(xReportData.currentTimestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: '6px' }}>
                    <small style={{ color: '#64748b', fontSize: '10px' }}>Total Bills</small>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{xReportData.billsCount}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: '6px' }}>
                    <small style={{ color: '#64748b', fontSize: '10px' }}>Cash Sales</small>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{money(xReportData.cashSales)}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: '6px' }}>
                    <small style={{ color: '#64748b', fontSize: '10px' }}>Card / QR Sales</small>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{money(xReportData.cardSales + xReportData.qrSales)}</div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Opening Float:</span>
                    <strong>{money(xReportData.openingFloat)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Net Petty Cash Adjustments (±):</span>
                    <strong>{money(xReportData.netAdjustments)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Total Tax & Levies Collected:</span>
                    <strong style={{ color: '#0369a1' }}>+{money(xReportData.totalTaxesCollected)}</strong>
                  </div>
                  <hr style={{ border: 0, borderTop: '1px dashed #cbd5e1', margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>Expected Cash in Drawer:</span>
                    <strong style={{ color: '#15803d' }}>{money(xReportData.expectedCash)}</strong>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="secondary-btn" onClick={() => setTab('status')}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => printXReport?.(xReportData)}
                  >
                    <Printer size={15} /> Print Thermal X-Report
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 5. BLIND RECONCILIATION & END SHIFT (Z-REPORT) */}
        {shift && tab === 'close' && (
          <form onSubmit={handleCloseShiftSubmit}>
            {/* Blind Count Notice */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ShieldCheck size={14} color="#16a34a" /> Blind Reconciliation Active
                </span>
                <button
                  type="button"
                  onClick={() => setShowExpectedTarget(!showExpectedTarget)}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: '10px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}
                  title="Reveal target balance (Manager audit)"
                >
                  {showExpectedTarget ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showExpectedTarget ? 'Hide Target' : 'Reveal Target'}
                </button>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#15803d' }}>
                Drawer target is hidden during counting to prevent forced balancing and maintain audit integrity.
              </p>
              {showExpectedTarget && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#14532d', borderTop: '1px dashed #86efac', paddingTop: '4px' }}>
                  Target Expected Cash: <strong>{money(expectedCash)}</strong>
                </div>
              )}
            </div>

            {/* Quick Denomination Counter */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                <Coins size={14} color="#64748b" />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Cash Denomination Counter (Optional)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {DENOMINATIONS.map(denom => (
                  <div key={denom} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 6px' }}>
                    <small style={{ fontSize: '10px', fontWeight: 600, color: '#475569', minWidth: '38px' }}>{denom}:</small>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={denominations[String(denom)]}
                      onChange={e => handleDenomChange(String(denom), e.target.value)}
                      style={{ border: 0, width: '100%', fontSize: '11px', padding: '2px 4px', textAlign: 'right' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <label>Total Physical Cash Counted in Till (LKR)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={actualCash}
              onChange={e => setActualCash(e.target.value)}
              placeholder="Enter physical cash counted in drawer"
              autoFocus
            />

            {actualCash !== '' && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: variance === 0 ? '#f0fdf4' : variance < 0 ? '#fff1f2' : '#fefce8',
                  border: `1px solid ${variance === 0 ? '#bbf7d0' : variance < 0 ? '#fecdd3' : '#fef08a'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {variance !== 0 && <AlertTriangle size={15} color={variance < 0 ? '#e11d48' : '#ca8a04'} />}
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>
                    {variance === 0 ? 'Till is Perfectly Balanced' : variance < 0 ? 'Cash Shortage (Deficit)' : 'Cash Overage (Surplus)'}
                  </span>
                </div>
                <strong style={{ fontSize: '13px', color: variance === 0 ? '#16a34a' : variance < 0 ? '#e11d48' : '#ca8a04' }}>
                  {variance > 0 ? `+${money(variance)}` : money(variance)}
                </strong>
              </div>
            )}

            {actualCash !== '' && variance !== 0 && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ color: '#e11d48', fontWeight: 600 }}>
                  Mandatory Variance Reason / Explanation *
                </label>
                <input
                  type="text"
                  required
                  value={varianceReason}
                  onChange={e => setVarianceReason(e.target.value)}
                  placeholder="e.g. Customer change left behind / change shortage"
                  style={{ borderColor: '#fca5a5' }}
                />
              </div>
            )}

            <label style={{ marginTop: '10px' }}>Handover Notes / Cashier Comments</label>
            <input
              type="text"
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="e.g. Handed over till to John for evening shift"
            />

            <div className="modal-actions" style={{ marginTop: '14px' }}>
              <button type="button" className="secondary-btn" onClick={() => setTab('status')}>
                Back
              </button>
              <button
                type="submit"
                className="primary-btn"
                style={{ background: '#e11d48' }}
              >
                Seal Shift & Generate Z-Report
              </button>
            </div>
          </form>
        )}

        {/* 6. SEALED OFFICIAL Z-REPORT PRINTABLE VIEW */}
        {tab === 'zreport' && lastZReport && (
          <div>
            <div className="receipt" id="receipt">
              <div className="receipt-brand">NILA CAFE</div>
              <p style={{ fontWeight: 'bold' }}>OFFICIAL Z-REPORT #{lastZReport.zReportNumber}</p>
              <div className="receipt-line">Z-Counter: <strong>{lastZReport.zReportNumber}</strong></div>
              <div className="receipt-line">Cashier: {lastZReport.cashier}</div>
              <div className="receipt-line">Opened: {new Date(lastZReport.openedAt).toLocaleString()}</div>
              <div className="receipt-line">Closed: {new Date(lastZReport.closedAt).toLocaleString()}</div>
              <hr />
              <div className="receipt-item">
                <span>Opening Float</span>
                <span>{money(lastZReport.openingFloat)}</span>
              </div>
              <div className="receipt-item">
                <span>Total Cash Sales ({lastZReport.billsCount} bills)</span>
                <span>+{money(lastZReport.cashSales)}</span>
              </div>
              <div className="receipt-item">
                <span>Net Adjustments (Petty cash)</span>
                <span>{money(lastZReport.netAdjustments)}</span>
              </div>
              <hr />
              <div className="receipt-item">
                <strong>EXPECTED CASH</strong>
                <strong>{money(lastZReport.expectedCash)}</strong>
              </div>
              <div className="receipt-item">
                <strong>ACTUAL COUNTED CASH</strong>
                <strong>{money(lastZReport.actualCountedCash)}</strong>
              </div>
              <div className="receipt-item" style={{ fontSize: '12px', color: lastZReport.variance < 0 ? '#e11d48' : '#16a34a' }}>
                <strong>TILL VARIANCE</strong>
                <strong>{lastZReport.variance > 0 ? `+${money(lastZReport.variance)}` : money(lastZReport.variance)}</strong>
              </div>
              {lastZReport.varianceReason && (
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', margin: '4px 0' }}>
                  Variance Note: "{lastZReport.varianceReason}"
                </div>
              )}
              <hr />
              <p className="receipt-thanks">Official Tax Audit Record. Register totals reset. Signed: _________</p>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={onCloseModal}>
                Finish & Close
              </button>
              <button className="primary-btn" onClick={() => printZReport?.(lastZReport)}>
                <Printer size={15} /> Print Thermal Z-Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
