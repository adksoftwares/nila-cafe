import React, { createContext, useContext, useState, useMemo } from 'react';
import { calculateBillTaxes } from '../utils/tax.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('takeaway');
  const [tableNumber, setTableNumber] = useState('Table 1');
  const [discountMode, setDiscountMode] = useState('percent');
  const [discount, setDiscount] = useState(0);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [appliedPromotion, setAppliedPromotion] = useState(null);

  const [taxConfig, setTaxConfig] = useState({
    service_charge_enabled: true,
    service_charge_rate: 10.0,
    sscl_enabled: true,
    sscl_rate: 2.5,
    vat_enabled: true,
    vat_rate: 18.0
  });

  const unitPrice = (p) =>
    Number(orderType === 'takeaway' ? p.takeaway_price : p.normal_price);

  const subtotal = useMemo(() => {
    return cart.reduce((s, i) => s + unitPrice(i.product) * i.qty, 0);
  }, [cart, orderType]);

  // 1. Manual Discount
  const manualDiscount = useMemo(() => {
    return Math.min(
      subtotal,
      discountMode === 'percent'
        ? (subtotal * Number(discount || 0)) / 100
        : Number(discount || 0)
    );
  }, [subtotal, discountMode, discount]);

  // 2. Promotion Code Discount
  const promoDiscount = useMemo(() => {
    if (!appliedPromotion || subtotal < appliedPromotion.min_order_amount) return 0;
    return appliedPromotion.type === 'percentage'
      ? Math.round(subtotal * (appliedPromotion.value / 100) * 100) / 100
      : Math.min(subtotal, appliedPromotion.value);
  }, [appliedPromotion, subtotal]);

  // 3. Loyalty Points Discount
  const pointsDiscount = useMemo(() => {
    return Math.min(
      Math.max(0, subtotal - manualDiscount - promoDiscount),
      Number(pointsToRedeem) || 0
    );
  }, [subtotal, manualDiscount, promoDiscount, pointsToRedeem]);

  const totalDiscount = useMemo(() => {
    return Math.round(Math.min(subtotal, manualDiscount + promoDiscount + pointsDiscount) * 100) / 100;
  }, [subtotal, manualDiscount, promoDiscount, pointsDiscount]);

  // 4. Dynamic Taxes & Service Charges
  const taxes = useMemo(() => {
    return calculateBillTaxes({
      subtotal,
      discount: totalDiscount,
      orderType,
      taxConfig
    });
  }, [subtotal, totalDiscount, orderType, taxConfig]);

  const total = taxes.grandTotal;
  const totalItemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pointsToEarn = useMemo(() => (selectedCustomer ? Math.floor(total / 100) : 0), [selectedCustomer, total]);

  // Actions
  const addToCart = (product) => {
    setCart(prev => {
      const idx = prev.findIndex(x => x.product.id === product.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [{ product, qty: 1, notes: '' }, ...prev];
    });
  };

  const changeQty = (id, newQty) => {
    const qty = Math.max(1, Math.min(999, Number(newQty) || 1));
    setCart(prev =>
      prev.map(i => (i.product.id === id ? { ...i, qty } : i))
    );
  };

  const changeNotes = (id, notes) => {
    setCart(prev =>
      prev.map(i => (i.product.id === id ? { ...i, notes } : i))
    );
  };

  const removeItem = (id) => {
    setCart(prev => prev.filter(i => i.product.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setPointsToRedeem(0);
    setAppliedPromotion(null);
  };

  const loadTableTab = (table, productsCatalog = []) => {
    setOrderType('dining');
    setTableNumber(table.table_number);
    if (table.items?.length) {
      setCart(table.items.map(item => {
        const prod = productsCatalog.find(p => p.id === item.product_id || p.code === item.code) || {
          id: item.product_id,
          name: item.name,
          code: item.code,
          normal_price: item.price,
          takeaway_price: item.price,
          stock: 99
        };
        return {
          product: prod,
          qty: item.qty || 1,
          notes: item.notes || ''
        };
      }));
    }
  };

  const value = {
    cart,
    setCart,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    discountMode,
    setDiscountMode,
    discount,
    setDiscount,
    selectedCustomer,
    setSelectedCustomer,
    pointsToRedeem,
    setPointsToRedeem,
    appliedPromotion,
    setAppliedPromotion,
    taxConfig,
    setTaxConfig,
    subtotal,
    manualDiscount,
    promoDiscount,
    pointsDiscount,
    totalDiscount,
    taxes,
    total,
    totalItemCount,
    pointsToEarn,
    unitPrice,
    addToCart,
    changeQty,
    changeNotes,
    removeItem,
    clearCart,
    loadTableTab
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
