import React from 'react';
import { Clock3 } from 'lucide-react';
import ProductCatalog from '../components/pos/ProductCatalog.jsx';
import CartPanel from '../components/pos/CartPanel.jsx';

export default function POSPage({
  user,
  products,
  category,
  setCategory,
  categories,
  search,
  setSearch,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  cart,
  onAddProduct,
  onChangeQty,
  onChangeNotes,
  onRemoveItem,
  discount,
  setDiscount,
  discountMode,
  setDiscountMode,
  onCheckout,
  checkoutSubmitting
}) {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Team';

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">POINT OF SALE</span>
          <h1>
            {greeting}, {firstName} <span>☕</span>
          </h1>
          <p>Ready to take orders and serve fresh coffee & food.</p>
        </div>
        <div className="date-chip">
          <Clock3 size={15} />
          {new Date().toLocaleDateString('en-LK', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </div>
      </div>

      <div className="pos-layout">
        <ProductCatalog
          products={products}
          category={category}
          setCategory={setCategory}
          categories={categories}
          search={search}
          setSearch={setSearch}
          orderType={orderType}
          onAddProduct={onAddProduct}
        />

        <CartPanel
          orderType={orderType}
          setOrderType={setOrderType}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
          cart={cart}
          onChangeQty={onChangeQty}
          onChangeNotes={onChangeNotes}
          onRemoveItem={onRemoveItem}
          discount={discount}
          setDiscount={setDiscount}
          discountMode={discountMode}
          setDiscountMode={setDiscountMode}
          onCheckout={onCheckout}
          checkoutSubmitting={checkoutSubmitting}
        />
      </div>
    </>
  );
}
