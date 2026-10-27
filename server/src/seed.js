import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy .env.example to .env and start PostgreSQL first.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log('--- Initializing Nila Cafe Database Schema & Seed Data ---');

  // 1. Execute SQL schema definitions
  const schemaSql = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(schemaSql);
  console.log('✓ Database schema and RLS policies created / verified.');

  // 2. Passwords & Hashes
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const ownerHash = await bcrypt.hash('Owner123!', 12);
  const managerHash = await bcrypt.hash('Manager123!', 12);
  const cashierHash = await bcrypt.hash('Cashier123!', 12);
  const waiterHash = await bcrypt.hash('Waiter123!', 12);
  const managerPinHash = await bcrypt.hash('1234', 10);

  // 3. Platform Admin
  await pool.query(
    "INSERT INTO users(name, email, password_hash, role) VALUES('System Admin', 'admin@counterpoint.local', $1, 'admin') ON CONFLICT(email) DO NOTHING",
    [adminHash]
  );
  console.log('✓ System Admin seeded (admin@counterpoint.local / Admin123!).');

  // 4. Default Shop
  let shop = (await pool.query("SELECT id FROM shops WHERE email='owner@counterpoint.local'")).rows[0];
  if (!shop) {
    shop = (
      await pool.query(
        "INSERT INTO shops(name, email, phone, address, service_charge_enabled, service_charge_rate, sscl_enabled, sscl_rate, vat_enabled, vat_rate) VALUES('Nila Cafe Central', 'owner@counterpoint.local', '+94 77 123 4567', 'Galle Road, Colombo 03, Sri Lanka', TRUE, 10.00, TRUE, 2.50, TRUE, 18.00) RETURNING id"
      )
    ).rows[0];
  }
  console.log('✓ Default Shop seeded (Nila Cafe Central).');

  // 5. Staff Accounts for Shop
  const staff = [
    ['Demo Owner', 'owner@counterpoint.local', ownerHash, 'owner', managerPinHash],
    ['Store Manager', 'manager@counterpoint.local', managerHash, 'manager', managerPinHash],
    ['Counter Cashier', 'cashier@counterpoint.local', cashierHash, 'cashier', null],
    ['Floor Waiter', 'waiter@counterpoint.local', waiterHash, 'waiter', null]
  ];

  for (const [name, email, hash, role, pin] of staff) {
    await pool.query(
      'INSERT INTO users(shop_id, name, email, password_hash, role, manager_pin_hash) VALUES($1, $2, $3, $4, $5, $6) ON CONFLICT(email) DO NOTHING',
      [shop.id, name, email, hash, role, pin]
    );
  }
  console.log('✓ Staff accounts seeded (Owner, Manager [PIN: 1234], Cashier, Waiter).');

  // 6. Products
  const products = [
    ['BUR001', 'Signature Chicken Burger', 'Burgers', 850, 950, 50],
    ['BUR002', 'Double Beef Burger', 'Burgers', 1200, 1350, 30],
    ['PIZ001', 'Classic Margherita Pizza', 'Pizza', 1500, 1650, 25],
    ['JUI001', 'Fresh Lime & Mint Juice', 'Drinks', 350, 400, 60],
    ['COF001', 'Iced Caramel Latte', 'Drinks', 550, 600, 40],
    ['COF002', 'Flat White Espresso', 'Drinks', 450, 500, 45],
    ['FRI001', 'Crispy Golden French Fries', 'Sides', 450, 500, 40],
    ['SAN001', 'Grilled Chicken Club Sandwich', 'Sandwiches', 750, 850, 30]
  ];

  const productMap = {};
  for (const [code, name, category, takeawayPrice, normalPrice, stock] of products) {
    const res = await pool.query(
      'INSERT INTO products(shop_id, code, name, category, takeaway_price, normal_price, stock) VALUES($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(shop_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id, code',
      [shop.id, code, name, category, takeawayPrice, normalPrice, stock]
    );
    productMap[code] = res.rows[0].id;
  }
  console.log('✓ Menu Products seeded (Burgers, Pizza, Drinks, Sides, Sandwiches).');

  // 7. Raw Ingredients (BOM)
  const ingredients = [
    ['Burger Buns', 'pcs', 100, 20, 45],
    ['Chicken Patties', 'pcs', 80, 15, 180],
    ['Cheese Slices', 'pcs', 120, 25, 35],
    ['Espresso Beans', 'g', 5000, 500, 3.5],
    ['Fresh Milk', 'ml', 15000, 2000, 0.45],
    ['Potatoes', 'g', 10000, 1500, 0.3],
    ['Coffee Syrup', 'ml', 2000, 200, 1.2]
  ];

  const ingredientMap = {};
  for (const [name, unit, stock, alert, cost] of ingredients) {
    const res = await pool.query(
      'INSERT INTO ingredients(shop_id, name, unit, stock, min_stock_alert, cost_per_unit) VALUES($1, $2, $3, $4, $5) ON CONFLICT(shop_id, name) DO UPDATE SET cost_per_unit = EXCLUDED.cost_per_unit RETURNING id, name',
      [shop.id, name, unit, stock, alert, cost]
    );
    ingredientMap[name] = res.rows[0].id;
  }
  console.log('✓ Raw Ingredients seeded for BOM recipe depletion.');

  // 8. Recipe Items (BOM Mappings)
  if (productMap['BUR001'] && ingredientMap['Burger Buns'] && ingredientMap['Chicken Patties']) {
    await pool.query(
      'INSERT INTO recipe_items(shop_id, product_id, ingredient_id, quantity_required) VALUES($1, $2, $3, 1), ($1, $2, $4, 1), ($1, $2, $5, 1) ON CONFLICT(product_id, ingredient_id) DO NOTHING',
      [shop.id, productMap['BUR001'], ingredientMap['Burger Buns'], ingredientMap['Chicken Patties'], ingredientMap['Cheese Slices']]
    );
  }
  if (productMap['COF001'] && ingredientMap['Espresso Beans'] && ingredientMap['Fresh Milk']) {
    await pool.query(
      'INSERT INTO recipe_items(shop_id, product_id, ingredient_id, quantity_required) VALUES($1, $2, $3, 18), ($1, $2, $4, 200), ($1, $2, $5, 20) ON CONFLICT(product_id, ingredient_id) DO NOTHING',
      [shop.id, productMap['COF001'], ingredientMap['Espresso Beans'], ingredientMap['Fresh Milk'], ingredientMap['Coffee Syrup']]
    );
  }
  console.log('✓ Recipe BOM mappings established.');

  // 9. Restaurant Floor Plan Tables
  const tables = [
    ['T-01', 2], ['T-02', 4], ['T-03', 4], ['T-04', 6],
    ['T-05', 4], ['T-06', 8], ['VIP-1', 10], ['OUT-1', 4]
  ];
  for (const [tableNum, cap] of tables) {
    await pool.query(
      'INSERT INTO restaurant_tables(shop_id, table_number, capacity) VALUES($1, $2, $3) ON CONFLICT(shop_id, table_number) DO NOTHING',
      [shop.id, tableNum, cap]
    );
  }
  console.log('✓ Restaurant Dining Tables floor plan seeded (8 tables).');

  // 10. Sample Customer Loyalty & Promotions
  await pool.query(
    "INSERT INTO customers(shop_id, name, phone, email, loyalty_points, total_spent, total_visits) VALUES($1, 'Kasun Perera', '+94771112233', 'kasun@example.local', 180, 18500, 12) ON CONFLICT(shop_id, phone) DO NOTHING",
    [shop.id]
  );
  await pool.query(
    "INSERT INTO promotions(shop_id, code, title, type, value, min_order_amount, active) VALUES($1, 'SAVE10', '10% Discount Campaign', 'percentage', 10.00, 1000.00, TRUE), ($1, 'FLAT250', 'LKR 250 Off Large Order', 'fixed', 250.00, 2500.00, TRUE) ON CONFLICT(shop_id, code) DO NOTHING",
    [shop.id]
  );
  console.log('✓ Sample Customer & Promotional Campaigns seeded.');

  console.log('\n--- Database Seed Complete! Ready for Production or Demo ---');
}

seed()
  .catch((err) => {
    console.error('Seed process failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
