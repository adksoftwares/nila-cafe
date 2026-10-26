import React, { useEffect, useMemo, useState } from 'react';
import './style.css';
import { initialProducts, demoUser, API } from './utils/constants.js';
import { request } from './api.js';
import { queueOfflineSale, getOfflineQueue, removeOfflineSale } from './utils/offlineQueue.js';

// Components
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Toast from './components/Toast.jsx';

// Modals
import ReceiptModal from './components/modals/ReceiptModal.jsx';
import ProductModal from './components/modals/ProductModal.jsx';
import ShopModal from './components/modals/ShopModal.jsx';
import ShiftModal from './components/modals/ShiftModal.jsx';
import PaymentModal from './components/modals/PaymentModal.jsx';
import VoidModal from './components/modals/VoidModal.jsx';
import CustomerModal from './components/modals/CustomerModal.jsx';

// Pages
import LoginScreen from './pages/LoginScreen.jsx';
import POSPage from './pages/POSPage.jsx';
import KDSPage from './pages/KDSPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import AdminShopsPage from './pages/AdminShopsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('pos_token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_user'));
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState('POS');
  const [products, setProducts] = useState(initialProducts);
  const [sales, setSales] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_sales') || '[]');
    } catch {
      return [];
    }
  });

  const [orderType, setOrderType] = useState('takeaway');
  const [tableNumber, setTableNumber] = useState('Table 1');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All items');
  const [discountMode, setDiscountMode] = useState('percent');
  const [discount, setDiscount] = useState(0);

  const [customers, setCustomers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [appliedPromotion, setAppliedPromotion] = useState(null);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [selectedVoidSale, setSelectedVoidSale] = useState(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(null);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [shopName] = useState('Nila Cafe');
  const [adminShops, setAdminShops] = useState([]);
  const [apiMode, setApiMode] = useState('demo');

  const [shift, setShift] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3200);
  };

  const api = (path, options = {}) => request(path, options, token);

  // Check health and mode on mount
  useEffect(() => {
    fetch(API.replace(/\/api$/, '') + '/api/health')
      .then(r => r.json())
      .then(d => setApiMode(d.database === 'connected' ? 'connected' : d.mode || 'demo'))
      .catch(() => setApiMode('offline'));
  }, []);

  // Monitor network connectivity & auto-sync offline queue
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flash('Connection restored. Syncing offline orders...');
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      flash('Network offline. POS operating in local offline mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getOfflineQueue().then(q => setOfflineQueueCount(q.length));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token]);

  // Sync pending offline orders with idempotent protection
  const syncOfflineQueue = async () => {
    if (!token || isSyncing) return;
    try {
      setIsSyncing(true);
      const queue = await getOfflineQueue();
      if (!queue.length) {
        setOfflineQueueCount(0);
        return;
      }

      let syncedCount = 0;
      for (const item of queue) {
        try {
          await api('/sales', {
            method: 'POST',
            headers: {
              'Idempotency-Key': item.idempotencyKey
            },
            body: JSON.stringify(item.payload)
          });
          await removeOfflineSale(item.id);
          syncedCount++;
        } catch (err) {
          console.warn('Sync attempt for order', item.id, err.message);
          // If already saved or conflict, safe to clean
          if (err.message.includes('already exists') || err.message.includes('Idempotency')) {
            await removeOfflineSale(item.id);
          }
        }
      }

      const remaining = await getOfflineQueue();
      setOfflineQueueCount(remaining.length);

      if (syncedCount > 0) {
        flash(`Synced ${syncedCount} offline order(s) successfully.`);
        loadSales();
        loadShift();
        loadCustomers();
      }
    } catch (err) {
      console.warn('Offline sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Verify session
  useEffect(() => {
    if (!token || !user) return;
    api('/auth/me')
      .then(d => setUser(d.user))
      .catch(() => {
        localStorage.removeItem('pos_token');
        localStorage.removeItem('pos_user');
        setToken('');
        setUser(null);
      });
  }, [token]);

  const loadShift = () => {
    if (!token || !user || user.role === 'admin') return;
    api('/shifts/current')
      .then(d => {
        setShift(d.shift);
        setShiftSummary(d.summary);
      })
      .catch(() => {});
  };

  const loadSales = () => {
    if (!token || !user) return;
    api('/sales')
      .then(d => {
        if (d.sales) {
          setSales(d.sales);
          localStorage.setItem('pos_sales', JSON.stringify(d.sales));
        }
      })
      .catch(() => {});
  };

  const loadCustomers = () => {
    if (!token || !user || user.role === 'admin') return;
    api('/customers')
      .then(d => {
        if (d.customers) setCustomers(d.customers);
      })
      .catch(() => {});
  };

  const loadPromotions = () => {
    if (!token || !user || user.role === 'admin') return;
    api('/promotions')
      .then(d => {
        if (d.promotions) setPromotions(d.promotions);
      })
      .catch(() => {});
  };

  // Load shop data / admin data / shift data
  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      api('/admin/shops')
        .then(d => setAdminShops(d.shops || []))
        .catch(() => {});
      return;
    }

    api('/products')
      .then(d => {
        if (d.products?.length) setProducts(d.products);
      })
      .catch(() => {});

    loadShift();
    loadSales();
    loadCustomers();
    loadPromotions();
  }, [user, token]);

  const categories = useMemo(
    () => ['All items', ...new Set(products.map(p => p.category || 'General'))],
    [products]
  );

  const handleLogin = async (loginEmail, loginPassword) => {
    setLoginLoading(true);
    setLoginError('');

    try {
      let data;
      try {
        data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: loginEmail, password: loginPassword })
        });
      } catch (err) {
        if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          const demo =
            loginEmail === 'owner@counterpoint.local' && loginPassword === 'Owner123!'
              ? demoUser
              : loginEmail === 'manager@counterpoint.local' && loginPassword === 'Manager123!'
              ? { id: 'u-manager', name: 'Store Manager', email: loginEmail, role: 'manager', shop_id: 'shop-demo' }
              : loginEmail === 'cashier@counterpoint.local' && loginPassword === 'Cashier123!'
              ? { id: 'u-cashier', name: 'Cashier One', email: loginEmail, role: 'cashier', shop_id: 'shop-demo' }
              : loginEmail === 'waiter@counterpoint.local' && loginPassword === 'Waiter123!'
              ? { id: 'u-waiter', name: 'Service Staff', email: loginEmail, role: 'waiter', shop_id: 'shop-demo' }
              : loginEmail === 'admin@counterpoint.local' && loginPassword === 'Admin123!'
              ? { id: 'u-admin', name: 'System Admin', email: loginEmail, role: 'admin', shop_id: null }
              : null;

          if (!demo) {
            throw new Error('Cannot connect to API. Use demo: owner@counterpoint.local / Owner123!');
          }
          data = { token: 'demo-session-' + Date.now(), user: demo };
          setApiMode('offline');
        } else {
          throw err;
        }
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('pos_token', data.token);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      setPage(data.user.role === 'admin' ? 'Overview' : 'POS');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    setCart([]);
    setPage('POS');
  };

  const handleAddProductToCart = (p) => {
    setCart(old => {
      const found = old.find(i => i.product.id === p.id);
      return found
        ? old.map(i => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...old, { product: p, qty: 1 }];
    });
  };

  const handleChangeQty = (id, val) => {
    setCart(old =>
      old.map(i =>
        i.product.id === id
          ? { ...i, qty: Math.max(1, Math.min(999, Number(val) || 1)) }
          : i
      )
    );
  };

  const handleChangeNotes = (id, notes) => {
    setCart(old =>
      old.map(i => (i.product.id === id ? { ...i, notes } : i))
    );
  };

  const handleRemoveItem = (id) => {
    setCart(old => old.filter(i => i.product.id !== id));
  };

  const handleCheckout = (checkoutDetails) => {
    if (!cart.length || checkoutSubmitting) return;
    setPendingCheckout(checkoutDetails);
    setModal('payment');
  };

  const handleConfirmPayment = async ({ payments, amountReceived, primaryMethod }) => {
    if (!pendingCheckout || !cart.length || checkoutSubmitting) return;

    setCheckoutSubmitting(true);
    const {
      subtotal,
      billDiscount,
      total,
      customerId,
      customerName,
      customerPhone,
      pointsEarned,
      pointsRedeemed,
      promotionCode
    } = pendingCheckout;

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    const sale = {
      id: Date.now(),
      bill_number: 'POS-' + Date.now().toString().slice(-7),
      order_type: orderType,
      table_number: orderType === 'dining' ? tableNumber : null,
      subtotal,
      discount: billDiscount,
      total,
      customer_id: customerId || null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      points_earned: pointsEarned || 0,
      points_redeemed: pointsRedeemed || 0,
      promotion_code: promotionCode || null,
      payment_method: primaryMethod,
      amount_received: amountReceived,
      payments: payments,
      created_at: new Date().toISOString(),
      items: cart.map(i => {
        const price = Number(orderType === 'takeaway' ? i.product.takeaway_price : i.product.normal_price);
        return {
          name: i.product.name,
          code: i.product.code,
          qty: i.qty,
          price,
          notes: i.notes || '',
          total: price * i.qty
        };
      })
    };

    const checkoutPayload = {
      orderType,
      tableNumber: orderType === 'dining' ? tableNumber : null,
      items: cart.map(i => ({
        productId: i.product.id,
        quantity: i.qty,
        notes: i.notes || '',
        discount: 0
      })),
      discount: billDiscount,
      customerId,
      pointsRedeemed,
      promotionCode,
      payments,
      paymentMethod: primaryMethod,
      amountReceived
    };

    try {
      if (!isOnline) {
        throw new Error('Offline');
      }

      if (token && apiMode === 'connected') {
        const data = await api('/sales', {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(checkoutPayload)
        });
        sale.bill_number = data.sale.bill_number;
        sale.total = Number(data.sale.total);
        sale.created_at = data.sale.created_at;
        if (data.sale.points_earned) sale.points_earned = data.sale.points_earned;
        if (data.sale.points_redeemed) sale.points_redeemed = data.sale.points_redeemed;
        if (data.sale.promotion_code) sale.promotion_code = data.sale.promotion_code;
        if (data.payments) sale.payments = data.payments;
      }
    } catch (e) {
      if (!isOnline || e.message === 'Offline' || e.message.includes('fetch') || e.message.includes('Failed to fetch')) {
        await queueOfflineSale({
          id: sale.id,
          idempotencyKey,
          payload: checkoutPayload,
          saleRecord: sale
        });
        const q = await getOfflineQueue();
        setOfflineQueueCount(q.length);
        flash('Network offline: Order saved to local device queue. Auto-syncing when back online.');
      } else {
        flash(e.message);
        setCheckoutSubmitting(false);
        return;
      }
    }

    setSales(old => {
      const updated = [sale, ...old];
      localStorage.setItem('pos_sales', JSON.stringify(updated));
      return updated;
    });

    setModal('receipt');
    setLastReceipt(sale);
    setCart([]);
    setDiscount(0);
    setSelectedCustomer(null);
    setPointsToRedeem(0);
    setAppliedPromotion(null);
    setPendingCheckout(null);
    loadShift();
    loadSales();
    loadCustomers();
    setCheckoutSubmitting(false);
  };

  const handleCreateCustomer = async (custForm) => {
    try {
      const res = await api('/customers', {
        method: 'POST',
        body: JSON.stringify(custForm)
      });
      flash(`Customer ${res.customer.name} registered.`);
      loadCustomers();
      setSelectedCustomer(res.customer);
      return res;
    } catch (err) {
      throw err;
    }
  };

  const handleVoidSale = async ({ saleId, reason, managerPin }) => {
    try {
      const res = await api(`/sales/${saleId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason, managerPin })
      });
      flash('Transaction voided successfully. Stock restored.');
      loadSales();
      loadShift();
      if (user?.role !== 'admin') {
        api('/products')
          .then(d => {
            if (d.products?.length) setProducts(d.products);
          })
          .catch(() => {});
      }
      return res;
    } catch (err) {
      throw err;
    }
  };

  const handleSaveProduct = async (formData) => {
    try {
      if (token && apiMode === 'connected') {
        const d = await api('/products', {
          method: 'POST',
          body: JSON.stringify({
            ...formData,
            takeaway_price: Number(formData.takeaway_price),
            normal_price: Number(formData.normal_price),
            stock: Number(formData.stock)
          })
        });
        setProducts(old => [...old, d.product]);
      } else {
        setProducts(old => [
          {
            ...formData,
            id: 'p' + Date.now(),
            takeaway_price: Number(formData.takeaway_price),
            normal_price: Number(formData.normal_price),
            stock: Number(formData.stock),
            active: true
          },
          ...old
        ]);
      }
      setModal('');
      flash('Product saved successfully.');
    } catch (e) {
      flash(e.message);
    }
  };

  const handleCreateShop = async (shopForm) => {
    try {
      const d = await api('/admin/shops', {
        method: 'POST',
        body: JSON.stringify(shopForm)
      });
      setAdminShops(old => [d.shop, ...old]);
      setModal('');
      flash('Shop workspace account created successfully.');
    } catch (e) {
      flash(e.message);
    }
  };

  const handleOpenShift = async ({ openingFloat, notes }) => {
    try {
      const res = await api('/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat, notes })
      });
      setShift(res.shift);
      loadShift();
      flash('Till shift opened successfully.');
      setModal('');
    } catch (e) {
      flash(e.message);
    }
  };

  const handleAddAdjustment = async ({ type, amount, reason }) => {
    try {
      await api('/shifts/adjustment', {
        method: 'POST',
        body: JSON.stringify({ type, amount, reason })
      });
      loadShift();
      flash(`Recorded ${type === 'cash_in' ? 'Cash In (Float Add)' : 'Payout (Petty Cash)'}.`);
    } catch (e) {
      flash(e.message);
    }
  };

  const handleCloseShift = async ({ actualCash, notes }) => {
    try {
      const res = await api('/shifts/close', {
        method: 'POST',
        body: JSON.stringify({ actualCash, notes })
      });
      setShift(res.shift);
      flash('Shift closed. Official Z-Report generated.');
      return res;
    } catch (e) {
      flash(e.message);
    }
  };

  if (!user) {
    return (
      <>
        <LoginScreen
          onLogin={handleLogin}
          loading={loginLoading}
          error={loginError}
          onFlash={flash}
        />
        <Toast message={notice} />
      </>
    );
  }

  const admin = user.role === 'admin';

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        page={page}
        setPage={setPage}
        salesCount={sales.length}
        shopName={shopName}
        onLogout={handleLogout}
        onFlash={flash}
      />

      <main className="main-area">
        <Topbar
          user={user}
          page={page}
          apiMode={apiMode}
          shift={shift}
          shiftSummary={shiftSummary}
          onOpenShiftModal={() => setModal('shift')}
          isOnline={isOnline}
          offlineQueueCount={offlineQueueCount}
          isSyncing={isSyncing}
          onTriggerSync={syncOfflineQueue}
          onFlash={flash}
        />

        <div className="content">
          {page === 'POS' && (
            <POSPage
              user={user}
              products={products}
              category={category}
              setCategory={setCategory}
              categories={categories}
              search={search}
              setSearch={setSearch}
              orderType={orderType}
              setOrderType={setOrderType}
              tableNumber={tableNumber}
              setTableNumber={setTableNumber}
              cart={cart}
              onAddProduct={handleAddProductToCart}
              onChangeQty={handleChangeQty}
              onChangeNotes={handleChangeNotes}
              onRemoveItem={handleRemoveItem}
              discount={discount}
              setDiscount={setDiscount}
              discountMode={discountMode}
              setDiscountMode={setDiscountMode}
              customers={customers}
              selectedCustomer={selectedCustomer}
              setSelectedCustomer={setSelectedCustomer}
              pointsToRedeem={pointsToRedeem}
              setPointsToRedeem={setPointsToRedeem}
              appliedPromotion={appliedPromotion}
              setAppliedPromotion={setAppliedPromotion}
              promotions={promotions}
              onOpenAddCustomer={() => setModal('customer')}
              onCheckout={handleCheckout}
              checkoutSubmitting={checkoutSubmitting}
            />
          )}

          {page === 'Kitchen (KDS)' && (
            <KDSPage
              token={token}
              onFlash={flash}
            />
          )}

          {page === 'Products' && (
            <ProductsPage
              products={products}
              categories={categories}
              search={search}
              setSearch={setSearch}
              onOpenAddProduct={() => setModal('product')}
            />
          )}

          {page === 'Sales' && (
            <SalesPage
              sales={sales}
              user={user}
              onOpenVoidModal={(s) => {
                setSelectedVoidSale(s);
                setModal('void');
              }}
            />
          )}

          {page === 'Customers' && (
            <CustomersPage
              customers={customers}
              onOpenAddCustomer={() => setModal('customer')}
            />
          )}

          {page === 'Reports' && (
            <ReportsPage
              sales={sales}
              products={products}
              onGoToProducts={() => setPage('Products')}
            />
          )}

          {(page === 'Overview' || page === 'Shops') && admin && (
            <AdminShopsPage
              viewMode={page}
              adminShops={adminShops}
              apiMode={apiMode}
              onOpenCreateShop={() => setModal('shop')}
              onSetPage={setPage}
            />
          )}

          {page === 'Settings' && (
            <SettingsPage
              user={user}
              shopName={shopName}
              apiMode={apiMode}
              onLogout={handleLogout}
            />
          )}
        </div>
      </main>

      {modal === 'receipt' && (
        <ReceiptModal
          receipt={lastReceipt}
          shopName={shopName}
          onClose={() => setModal('')}
        />
      )}

      {modal === 'product' && (
        <ProductModal
          onSave={handleSaveProduct}
          onClose={() => setModal('')}
        />
      )}

      {modal === 'shop' && (
        <ShopModal
          onSave={handleCreateShop}
          onClose={() => setModal('')}
        />
      )}

      {modal === 'shift' && (
        <ShiftModal
          shift={shift}
          shiftSummary={shiftSummary}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
          onAddAdjustment={handleAddAdjustment}
          onCloseModal={() => setModal('')}
        />
      )}

      {modal === 'payment' && pendingCheckout && (
        <PaymentModal
          total={pendingCheckout.total}
          onConfirmPayment={handleConfirmPayment}
          onClose={() => setModal('')}
        />
      )}

      {modal === 'void' && selectedVoidSale && (
        <VoidModal
          sale={selectedVoidSale}
          user={user}
          onConfirmVoid={handleVoidSale}
          onClose={() => {
            setModal('');
            setSelectedVoidSale(null);
          }}
        />
      )}

      {modal === 'customer' && (
        <CustomerModal
          onSave={handleCreateCustomer}
          onClose={() => setModal('')}
        />
      )}

      <Toast message={notice} />
    </div>
  );
}
