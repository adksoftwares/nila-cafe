import React, { useState } from 'react';
import { X, Printer, DollarSign, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle } from 'lucide-react';
import { money } from '../../utils/formatters.js';
import { useShift } from '../../context/ShiftContext.jsx';

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

  const [tab, setTab] = useState(shift ? 'status' : 'open');
  const [openingFloat, setOpeningFloat] = useState('5000');
  const [openNotes, setOpenNotes] = useState('');

  const [adjType, setAdjType] = useState('cash_out');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const [lastZReport, setLastZReport] = useState(null);

  const expectedCash = shiftSummary?.expectedCash ?? (shift?.opening_float || 0);
  const countedNum = Number(actualCash) || 0;
  const variance = Math.round((countedNum - expectedCash) * 100) / 100;

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
    const result = await onCloseShift({ actualCash: countedNum, notes: closeNotes });
    if (result?.zReport) {
      setLastZReport(result.zReport);
      setTab('zreport');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCloseModal}>
      <div className="modal" style={{ width: 'min(100%, 540px)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">TILL & CASH RECONCILIATION</span>
            <h2>
              {tab === 'zreport'
                ? 'Official Z-Report (Shift Closed)'
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '18px' }}>
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
              className={tab === 'close' ? 'secondary-btn active' : 'secondary-btn'}
              style={{ fontSize: '11px', background: tab === 'close' ? '#fff1f2' : '#fff', borderColor: tab === 'close' ? '#e11d48' : 'var(--line)', color: tab === 'close' ? '#e11d48' : '#475569' }}
              onClick={() => setTab('close')}
            >
              End Shift (Z-Report)
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

            <label>Opening Float Cash (LKR)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={openingFloat}
              onChange={e => setOpeningFloat(e.target.value)}
              placeholder="e.g. 5000"
            />

            <label style={{ marginTop: '12px' }}>Shift Notes (Optional)</label>
            <input
              type="text"
              value={openNotes}
              onChange={e => setOpenNotes(e.target.value)}
              placeholder="e.g. Morning counter shift"
            />

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onCloseModal}>
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Start Shift & Unlock Till
              </button>
            </div>
          </form>
        )}

        {/* 2. LIVE TILL STATUS (X-REPORT) */}
        {shift && tab === 'status' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b', fontSize: '10px' }}>OPENING FLOAT</small>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginTop: '2px' }}>
                  {money(shiftSummary?.openingFloat || shift.opening_float)}
                </div>
              </div>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b', fontSize: '10px' }}>CASH SALES COLLECTED</small>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#16a34a', marginTop: '2px' }}>
                  +{money(shiftSummary?.cashSales || 0)}
                </div>
                <small style={{ color: '#94a3b8', fontSize: '9px' }}>{shiftSummary?.bills || 0} completed orders</small>
              </div>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b', fontSize: '10px' }}>NET PETTY CASH ADJUSTMENTS</small>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: (shiftSummary?.netAdjustments || 0) < 0 ? '#e11d48' : '#0f172a', marginTop: '2px' }}>
                  {money(shiftSummary?.netAdjustments || 0)}
                </div>
              </div>
              <div style={{ padding: '12px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                <small style={{ color: 'var(--blue)', fontSize: '10px', fontWeight: 600 }}>EXPECTED CASH IN DRAWER</small>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--blue)', marginTop: '2px' }}>
                  {money(expectedCash)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>
              Shift opened at: <strong>{new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</strong>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => window.print()}
                title="Print Mid-shift X-Reading"
              >
                <Printer size={15} /> Print X-Report
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="secondary-btn" onClick={onCloseModal}>
                  Close
                </button>
                <button type="button" className="primary-btn" onClick={() => setTab('close')}>
                  End Shift →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. CASH IN / CASH OUT ADJUSTMENT */}
        {shift && tab === 'adjust' && (
          <form onSubmit={handleAdjSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
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
                  color: adjType === 'cash_out' ? '#be123c' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ArrowDownRight size={16} /> Cash Out (Payout)
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

        {/* 4. RECONCILIATION & CLOSE SHIFT */}
        {shift && tab === 'close' && (
          <form onSubmit={handleCloseShiftSubmit}>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span>Expected Cash in Drawer:</span>
                <strong>{money(expectedCash)}</strong>
              </div>
              <small style={{ color: '#64748b', fontSize: '10px' }}>
                Calculated from: Opening float + Cash receipts ± Petty cash payouts.
              </small>
            </div>

            <label>Actual Counted Cash in Till (LKR)</label>
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
                  marginTop: '12px',
                  padding: '10px 14px',
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

            <label style={{ marginTop: '12px' }}>Closing Notes / Handover Comments</label>
            <input
              type="text"
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="e.g. Handed over to evening cashier John"
            />

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setTab('status')}>
                Back
              </button>
              <button
                type="submit"
                className="primary-btn"
                style={{ background: '#e11d48' }}
              >
                Confirm & Print Z-Report
              </button>
            </div>
          </form>
        )}

        {/* 5. Z-REPORT PRINTABLE VIEW */}
        {tab === 'zreport' && lastZReport && (
          <div>
            <div className="receipt" id="receipt">
              <div className="receipt-brand">NILA CAFE</div>
              <p>END OF SHIFT Z-REPORT</p>
              <div className="receipt-line">Report: {lastZReport.zReportNumber}</div>
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
                <strong>VARIANCE (OVER / SHORT)</strong>
                <strong>{lastZReport.variance > 0 ? `+${money(lastZReport.variance)}` : money(lastZReport.variance)}</strong>
              </div>
              <hr />
              <p className="receipt-thanks">Official Cashier Shift Audit Log. Signed: _________</p>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={onCloseModal}>
                Finish & Close
              </button>
              <button className="primary-btn" onClick={() => window.print()}>
                <Printer size={15} /> Print Z-Report Slip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
