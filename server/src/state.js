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
    service_charge: 0,
    sscl: 0,
    vat: 0,
    total: 2250,
    payment_method: 'cash',
    amount_received: 2500,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    cashier_name: 'Cashier One',
    items: [
      { id: 'si-1', name: 'Chicken Burger', code: 'BUR001', category: 'Burgers', quantity: 2, price: 950, total: 1900, notes: 'Extra sauce', status: 'ready' },
      { id: 'si-2', name: 'French Fries', code: 'FRI001', category: 'Sides', quantity: 1, price: 500, total: 450, notes: 'Crispy', status: 'ready' }
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
    service_charge: 0,
    sscl: 0,
    vat: 0,
    total: 1500,
    payment_method: 'card',
    amount_received: 1500,
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    cashier_name: 'Demo Owner',
    items: [
      { id: 'si-3', name: 'Classic Pizza', code: 'PIZ001', category: 'Pizza', quantity: 1, price: 1500, total: 1500, notes: 'Less spicy', status: 'pending' }
    ],
    payments: [{ method: 'card', amount: 1500, reference: 'VISA-9921' }]
  },
  {
    id: 'sale-demo-3',
    bill_number: 'POS-NILA-1003',
    order_type: 'takeaway',
    table_number: null,
    kitchen_status: 'pending',
    status: 'completed',
    subtotal: 900,
    discount: 0,
    service_charge: 0,
    sscl: 0,
    vat: 0,
    total: 900,
    payment_method: 'cash',
    amount_received: 1000,
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    cashier_name: 'Cashier One',
    items: [
      { id: 'si-4', name: 'Iced Coffee', code: 'COF001', category: 'Drinks', quantity: 1, price: 500, total: 500, notes: 'Almond milk', status: 'pending' },
      { id: 'si-5', name: 'Fresh Juice', code: 'JUI001', category: 'Drinks', quantity: 1, price: 400, total: 400, notes: 'Less sugar', status: 'pending' }
    ],
    payments: [{ method: 'cash', amount: 900 }]
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
  {
    id: 'shop-demo',
    name: 'The Daily Counter',
    email: 'owner@counterpoint.local',
    phone: '+94 77 123 4567',
    address: 'Colombo, Sri Lanka',
    active: true,
    service_charge_enabled: true,
    service_charge_rate: 10.0,
    sscl_enabled: true,
    sscl_rate: 2.5,
    vat_enabled: true,
    vat_rate: 18.0
  }
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
  notes: 'Morning shift opening float',
  denominations: {},
  variance_reason: null,
  z_counter: null
};

export function setDemoShift(s) {
  demoShift = s;
}

export let demoZCounter = 1;

export function getNextDemoZCounter() {
  return demoZCounter++;
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

export const demoIngredients = [
  { id: 'ing-1', shop_id: 'shop-demo', name: 'Chicken Patty', unit: 'pcs', stock: 50, min_stock_alert: 15, cost_per_unit: 350, active: true },
  { id: 'ing-2', shop_id: 'shop-demo', name: 'Burger Bun', unit: 'pcs', stock: 60, min_stock_alert: 20, cost_per_unit: 60, active: true },
  { id: 'ing-3', shop_id: 'shop-demo', name: 'Cheese Slice', unit: 'pcs', stock: 80, min_stock_alert: 25, cost_per_unit: 80, active: true },
  { id: 'ing-4', shop_id: 'shop-demo', name: 'Coffee Beans', unit: 'g', stock: 5000, min_stock_alert: 1000, cost_per_unit: 8.5, active: true },
  { id: 'ing-5', shop_id: 'shop-demo', name: 'Fresh Milk', unit: 'ml', stock: 10000, min_stock_alert: 2000, cost_per_unit: 0.5, active: true },
  { id: 'ing-6', shop_id: 'shop-demo', name: 'Potato Fries', unit: 'g', stock: 8000, min_stock_alert: 2000, cost_per_unit: 1.2, active: true }
];

export const demoRecipes = [
  // Chicken Burger (p1)
  { id: 'rec-1', shop_id: 'shop-demo', product_id: 'p1', ingredient_id: 'ing-1', ingredient_name: 'Chicken Patty', unit: 'pcs', quantity_required: 1 },
  { id: 'rec-2', shop_id: 'shop-demo', product_id: 'p1', ingredient_id: 'ing-2', ingredient_name: 'Burger Bun', unit: 'pcs', quantity_required: 1 },
  { id: 'rec-3', shop_id: 'shop-demo', product_id: 'p1', ingredient_id: 'ing-3', ingredient_name: 'Cheese Slice', unit: 'pcs', quantity_required: 1 },
  // French Fries (p4)
  { id: 'rec-4', shop_id: 'shop-demo', product_id: 'p4', ingredient_id: 'ing-6', ingredient_name: 'Potato Fries', unit: 'g', quantity_required: 200 },
  // Iced Coffee (p5)
  { id: 'rec-5', shop_id: 'shop-demo', product_id: 'p5', ingredient_id: 'ing-4', ingredient_name: 'Coffee Beans', unit: 'g', quantity_required: 18 },
  { id: 'rec-6', shop_id: 'shop-demo', product_id: 'p5', ingredient_id: 'ing-5', ingredient_name: 'Fresh Milk', unit: 'ml', quantity_required: 150 }
];

export const demoIngredientMovements = [];

export const demoTables = [
  { id: 'tab-1', shop_id: 'shop-demo', table_number: 'Table 1', capacity: 2, status: 'vacant', active_sale_id: null },
  { id: 'tab-2', shop_id: 'shop-demo', table_number: 'Table 2', capacity: 4, status: 'vacant', active_sale_id: null },
  { id: 'tab-3', shop_id: 'shop-demo', table_number: 'Table 3', capacity: 4, status: 'vacant', active_sale_id: null },
  { id: 'tab-4', shop_id: 'shop-demo', table_number: 'Table 4', capacity: 4, status: 'ordered', active_sale_id: 'sale-demo-1' },
  { id: 'tab-5', shop_id: 'shop-demo', table_number: 'Table 5', capacity: 6, status: 'vacant', active_sale_id: null },
  { id: 'tab-6', shop_id: 'shop-demo', table_number: 'Table 6', capacity: 2, status: 'vacant', active_sale_id: null },
  { id: 'tab-7', shop_id: 'shop-demo', table_number: 'Table 7', capacity: 4, status: 'vacant', active_sale_id: null },
  { id: 'tab-8', shop_id: 'shop-demo', table_number: 'Table 8', capacity: 4, status: 'vacant', active_sale_id: null },
  { id: 'tab-9', shop_id: 'shop-demo', table_number: 'Table 9', capacity: 6, status: 'vacant', active_sale_id: null },
  { id: 'tab-10', shop_id: 'shop-demo', table_number: 'Table 10', capacity: 8, status: 'vacant', active_sale_id: null },
  { id: 'tab-11', shop_id: 'shop-demo', table_number: 'Balcony 1', capacity: 4, status: 'vacant', active_sale_id: null },
  { id: 'tab-12', shop_id: 'shop-demo', table_number: 'Balcony 2', capacity: 4, status: 'vacant', active_sale_id: null },
  { id: 'tab-13', shop_id: 'shop-demo', table_number: 'VIP Lounge', capacity: 10, status: 'vacant', active_sale_id: null }
];

export let demoModifiers = [
  {
    id: 'mod-1',
    shop_id: 'shop-demo',
    product_id: 'p5', // Iced Coffee
    name: 'Milk Choice',
    type: 'single',
    required: true,
    options: [
      { id: 'opt-milk-whole', name: 'Fresh Milk', price: 0, ingredient_id: 'ing-5', ingredient_qty: 150 },
      { id: 'opt-milk-oat', name: 'Oat Milk (+150 LKR)', price: 150, ingredient_id: null, ingredient_qty: 0 }
    ],
    active: true
  },
  {
    id: 'mod-2',
    shop_id: 'shop-demo',
    product_id: 'p5', // Iced Coffee
    name: 'Espresso Boost',
    type: 'multiple',
    required: false,
    options: [
      { id: 'opt-extra-shot', name: 'Extra Espresso Shot (+120 LKR)', price: 120, ingredient_id: 'ing-4', ingredient_qty: 18 }
    ],
    active: true
  },
  {
    id: 'mod-3',
    shop_id: 'shop-demo',
    product_id: 'p1', // Chicken Burger
    name: 'Burger Add-Ons',
    type: 'multiple',
    required: false,
    options: [
      { id: 'opt-cheese', name: 'Extra Cheese Slice (+80 LKR)', price: 80, ingredient_id: 'ing-3', ingredient_qty: 1 },
      { id: 'opt-patty', name: 'Extra Chicken Patty (+350 LKR)', price: 350, ingredient_id: 'ing-1', ingredient_qty: 1 }
    ],
    active: true
  }
];

export function setDemoModifiers(mods) {
  demoModifiers = mods;
}

