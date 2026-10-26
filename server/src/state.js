export const demoProducts = [
  { id: 'p1', code: 'BUR001', name: 'Chicken Burger', category: 'Burgers', takeaway_price: 850, normal_price: 950, stock: 40, active: true },
  { id: 'p2', code: 'PIZ001', name: 'Classic Pizza', category: 'Pizza', takeaway_price: 1500, normal_price: 1650, stock: 18, active: true },
  { id: 'p3', code: 'JUI001', name: 'Fresh Juice', category: 'Drinks', takeaway_price: 350, normal_price: 400, stock: 60, active: true },
  { id: 'p4', code: 'FRI001', name: 'French Fries', category: 'Sides', takeaway_price: 450, normal_price: 500, stock: 35, active: true },
  { id: 'p5', code: 'COF001', name: 'Iced Coffee', category: 'Drinks', takeaway_price: 500, normal_price: 550, stock: 22, active: true },
  { id: 'p6', code: 'SAN001', name: 'Club Sandwich', category: 'Sandwiches', takeaway_price: 700, normal_price: 780, stock: 24, active: true }
];

export let demoSales = [
  {
    id: 'sale-demo-1',
    bill_number: 'POS-NILA-1001',
    order_type: 'dining',
    table_number: 'Table 4',
    kitchen_status: 'ready',
    status: 'completed',
    subtotal: 2350,
    discount: 100,
    total: 2250,
    payment_method: 'cash',
    amount_received: 2500,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    cashier_name: 'Cashier One',
    items: [
      { id: 'si-1', name: 'Chicken Burger', code: 'BUR001', quantity: 2, price: 950, total: 1900, notes: 'Extra sauce' },
      { id: 'si-2', name: 'French Fries', code: 'FRI001', quantity: 1, price: 500, total: 450, notes: 'Crispy' }
    ],
    payments: [{ method: 'cash', amount: 2250 }]
  },
  {
    id: 'sale-demo-2',
    bill_number: 'POS-NILA-1002',
    order_type: 'takeaway',
    table_number: null,
    kitchen_status: 'preparing',
    status: 'completed',
    subtotal: 1500,
    discount: 0,
    total: 1500,
    payment_method: 'card',
    amount_received: 1500,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    cashier_name: 'Demo Owner',
    items: [
      { id: 'si-3', name: 'Classic Pizza', code: 'PIZ001', quantity: 1, price: 1500, total: 1500, notes: 'Less spicy' }
    ],
    payments: [{ method: 'card', amount: 1500, reference: 'VISA-9921' }]
  }
];

export const demoUsers = [
  { id: 'u-admin', name: 'System Admin', email: 'admin@counterpoint.local', password: 'Admin123!', role: 'admin', shop_id: null, active: true },
  { id: 'u-owner', name: 'Demo Owner', email: 'owner@counterpoint.local', password: 'Owner123!', role: 'owner', shop_id: 'shop-demo', manager_pin: '8844', active: true },
  { id: 'u-manager', name: 'Store Manager', email: 'manager@counterpoint.local', password: 'Manager123!', role: 'manager', shop_id: 'shop-demo', manager_pin: '8844', active: true },
  { id: 'u-cashier', name: 'Cashier One', email: 'cashier@counterpoint.local', password: 'Cashier123!', role: 'cashier', shop_id: 'shop-demo', active: true },
  { id: 'u-waiter', name: 'Service Staff', email: 'waiter@counterpoint.local', password: 'Waiter123!', role: 'waiter', shop_id: 'shop-demo', active: true }
];

export const demoShops = [
  { id: 'shop-demo', name: 'The Daily Counter', email: 'owner@counterpoint.local', phone: '+94 77 123 4567', address: 'Colombo, Sri Lanka', active: true }
];

export const demoCustomers = [
  {
    id: 'cust-1',
    shop_id: 'shop-demo',
    name: 'Kasun Perera',
    phone: '0771234567',
    email: 'kasun@gmail.com',
    loyalty_points: 240,
    total_spent: 24000,
    total_visits: 12,
    created_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString()
  },
  {
    id: 'cust-2',
    shop_id: 'shop-demo',
    name: 'Fatima Nazeer',
    phone: '0719876543',
    email: 'fatima.n@outlook.com',
    loyalty_points: 150,
    total_spent: 15500,
    total_visits: 8,
    created_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString()
  },
  {
    id: 'cust-3',
    shop_id: 'shop-demo',
    name: 'Rohan De Silva',
    phone: '0754433221',
    email: 'rohan.desilva@yahoo.com',
    loyalty_points: 80,
    total_spent: 8000,
    total_visits: 4,
    created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString()
  }
];

export const demoPromotions = [
  {
    id: 'promo-1',
    shop_id: 'shop-demo',
    code: 'WELCOME10',
    title: '10% Welcome Discount',
    type: 'percentage',
    value: 10,
    min_order_amount: 500,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'promo-2',
    shop_id: 'shop-demo',
    code: 'CAFE500',
    title: 'LKR 500 Off Large Orders',
    type: 'fixed',
    value: 500,
    min_order_amount: 2500,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'promo-3',
    shop_id: 'shop-demo',
    code: 'HAPPYHOUR',
    title: '15% Happy Hour Special',
    type: 'percentage',
    value: 15,
    min_order_amount: 1000,
    active: true,
    created_at: new Date().toISOString()
  }
];

export const demoIdempotencyCache = new Map();

export let demoShift = {
  id: 'shift-demo-1',
  shop_id: 'shop-demo',
  user_id: 'u-owner',
  opened_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  closed_at: null,
  opening_float: 5000,
  expected_cash: 5000,
  actual_cash: null,
  difference: null,
  status: 'open',
  notes: 'Morning shift opening float'
};

export function setDemoShift(s) {
  demoShift = s;
}

export let demoShiftAdjustments = [];

export function setDemoShiftAdjustments(adj) {
  demoShiftAdjustments = adj;
}

export const kdsClients = new Map();

export function broadcastKDS(shopId, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [clientId, client] of kdsClients.entries()) {
    if (client.shopId === shopId || client.isAdmin) {
      try {
        client.res.write(payload);
      } catch {
        kdsClients.delete(clientId);
      }
    }
  }
}
