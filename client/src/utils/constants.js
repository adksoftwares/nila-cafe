export const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const initialProducts = [
  { id: 'p1', code: 'BUR001', name: 'Chicken Burger', category: 'Burgers', takeaway_price: 850, normal_price: 950, stock: 40, active: true },
  { id: 'p2', code: 'PIZ001', name: 'Classic Pizza', category: 'Pizza', takeaway_price: 1500, normal_price: 1650, stock: 18, active: true },
  { id: 'p3', code: 'JUI001', name: 'Fresh Juice', category: 'Drinks', takeaway_price: 350, normal_price: 400, stock: 60, active: true },
  { id: 'p4', code: 'FRI001', name: 'French Fries', category: 'Sides', takeaway_price: 450, normal_price: 500, stock: 35, active: true },
  { id: 'p5', code: 'COF001', name: 'Iced Coffee', category: 'Drinks', takeaway_price: 500, normal_price: 550, stock: 22, active: true },
  { id: 'p6', code: 'SAN001', name: 'Club Sandwich', category: 'Sandwiches', takeaway_price: 700, normal_price: 780, stock: 24, active: true }
];

export const demoUser = {
  id: 'u-owner',
  name: 'Demo Owner',
  email: 'owner@counterpoint.local',
  role: 'owner',
  shop_id: 'shop-demo'
};
