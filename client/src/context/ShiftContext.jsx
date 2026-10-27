import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ShiftContext = createContext(null);

export function ShiftProvider({ children, api, user, onFlash }) {
  const [shift, setShift] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);

  const loadShift = useCallback(async () => {
    if (!user || user.role === 'admin' || !api) return;
    setLoadingShift(true);
    try {
      const data = await api('/shifts/current');
      setShift(data.shift);
      setShiftSummary(data.summary);
    } catch {
      // In demo mode or offline, keep local state
    } finally {
      setLoadingShift(false);
    }
  }, [api, user]);

  useEffect(() => {
    loadShift();
  }, [loadShift]);

  const openShift = async ({ openingFloat, notes }) => {
    if (!api) return;
    try {
      const res = await api('/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat, notes })
      });
      setShift(res.shift);
      await loadShift();
      onFlash?.('Till shift opened successfully.', 'success');
      return res;
    } catch (e) {
      onFlash?.(e.message, 'error');
      throw e;
    }
  };

  const addAdjustment = async ({ type, amount, reason }) => {
    if (!api) return;
    try {
      const res = await api('/shifts/adjustment', {
        method: 'POST',
        body: JSON.stringify({ type, amount, reason })
      });
      await loadShift();
      onFlash?.(`Recorded ${type === 'cash_in' ? 'Cash In (Float Add)' : 'Payout (Petty Cash)'}.`, 'success');
      return res;
    } catch (e) {
      onFlash?.(e.message, 'error');
      throw e;
    }
  };

  const closeShift = async ({ actualCash, notes }) => {
    if (!api) return;
    try {
      const res = await api('/shifts/close', {
        method: 'POST',
        body: JSON.stringify({ actualCash, notes })
      });
      setShift(res.shift);
      onFlash?.('Shift closed. Official Z-Report generated.', 'success');
      return res;
    } catch (e) {
      onFlash?.(e.message, 'error');
      throw e;
    }
  };

  const value = {
    shift,
    shiftSummary,
    loadingShift,
    loadShift,
    openShift,
    closeShift,
    addAdjustment
  };

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift() {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
}
