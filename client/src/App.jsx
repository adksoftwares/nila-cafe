import React, { useEffect, useMemo, useState } from 'react';
import './style.css';
import { initialProducts, demoUser, API } from './utils/constants.js';
import { request } from './api.js';

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

// Pages
import LoginScreen from './pages/LoginScreen.jsx';
import POSPage from './pages/POSPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
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

  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
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

  const handleCheckout = ({ subtotal, billDiscount, total }) => {
    if (!cart.length || checkoutSubmitting) return;
    setPendingCheckout({ subtotal, billDiscount, total });
    setModal('payment');
  };

  const handleConfirmPayment = async ({ payments, amountReceived, primaryMethod }) => {
    if (!pendingCheckout || !cart.length || checkoutSubmitting) return;

    setCheckoutSubmitting(true);
    const { subtotal, billDiscount, total } = pendingCheckout;

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

    try {
      if (token && apiMode === 'connected') {
        const data = await api('/sales', {
          method: 'POST',
          headers: {
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            orderType,
            tableNumber: orderType === 'dining' ? tableNumber : null,
            items: cart.map(i => ({
              productId: i.product.id,
              quantity: i.qty,
              notes: i.notes || '',
              discount: 0
            })),
            discount: billDiscount,
            payments,
            paymentMethod: primaryMethod,
            amountReceived
          })
        });
        sale.bill_number = data.sale.bill_number;
        sale.total = Number(data.sale.total);
        sale.created_at = data.sale.created_at;
        if (data.payments) sale.payments = data.payments;
      } else if (apiMode !== 'demo') {
        flash('API is offline: this checkout is saved to local workstation only.');
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
      setPendingCheckout(null);
      loadShift();
    } catch (e) {
      flash(e.message);
    } finally {
      setCheckoutSubmitting(false);
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
              onCheckout={handleCheckout}
              checkoutSubmitting={checkoutSubmitting}
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

          {page === 'Sales' && <SalesPage sales={sales} />}

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

      <Toast message={notice} />
    </div>
  );
}
