# 🌙 Nila Cafe — Point of Sale (POS) & Cafe Management Platform ☕

![CI Pipeline](https://github.com/adksoftwares/nila-cafe/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node: >=20](https://img.shields.io/badge/Node->=20-green.svg)
![PostgreSQL: 16](https://img.shields.io/badge/PostgreSQL-16-blue.svg)

A modern, multi-tenant browser-based POS and cafe management platform designed for **Nila Cafe**. It features a fast React (Vite) frontend, Express.js REST API with rate limiting and security headers, PostgreSQL database schema with Row-Level Security (RLS), Double-Entry Stock Movement Ledger, Idempotency-Key duplicate prevention, Table Number ordering, Item Notes/Modifiers, and instant Kitchen Order Ticket (KOT) printing.

---

## 🚀 Key Features

- 🧾 **Point of Sale (POS)**: Instant item lookup (with `Ctrl+K` shortcut), category filtering, cart management, takeaway/dining/delivery order pricing, bill discounts, and automatic calculations.
- 🪑 **Table & Seat Assignment**: Select dining table numbers (e.g. Table 1 to 12, Balcony, VIP Lounge) seamlessly.
- 📝 **Item Modifiers / Prep Notes**: Add custom preparation notes to any order item (e.g. *"Less sugar"*, *"Oat milk"*, *"Extra hot"*).
- 🧑‍🍳 **Kitchen Order Ticket (KOT)**: Print Barista and Chef slips (KOT) separated from customer receipts without financial pricing.
- 🔒 **Enterprise Financial Safety**:
  - **Idempotency Keys**: Network retries and double-clicks never create duplicate transactions or duplicate stock deductions.
  - **Deadlock-Free Transactions**: Batch deterministic sorting prevents database concurrency deadlocks.
  - **PostgreSQL Row-Level Security (RLS)**: Enforced database-level tenant isolation preventing cross-shop data leaks.
  - **Double-Entry Stock Ledger**: Audit trail logging every inventory change (`stock_movements`).

---

## 🛠️ Architecture & Monorepo Structure

```text
nila-cafe/
├── .github/workflows/   # CI/CD Automated Test & Build Pipeline
├── client/              # React + Vite frontend POS interface
│   ├── src/             # Pages, Components, Modals, Utils
│   ├── Dockerfile       # Multi-stage production container (Node -> Nginx)
│   └── nginx.conf       # High-performance SPA web server config
├── server/              # Express API & PostgreSQL backend
│   ├── src/             # Authentication, products, sales, reports routes
│   ├── sql/schema.sql   # PostgreSQL schema with Row-Level Security (RLS)
│   └── Dockerfile       # Production Node.js container
├── docker-compose.prod.yml # Production fullstack orchestration (DB + API + Web)
├── docker-compose.yml   # Local database development container
├── .env.example         # Environment template
└── package.json         # Monorepo root workspace scripts
```

---

## ⚡ Running in Development Mode

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Unit Tests
```bash
npm test --workspace server
```

### 3. Start Local Development Servers
```bash
npm run dev
```

* **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🐳 Production Deployment (Single Command)

To deploy the entire production stack (PostgreSQL 16 DB + Express API + Nginx Web Frontend) on any cloud server:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

* **Production POS Web App**: [http://localhost](http://localhost) (Port 80)
* **Production API**: [http://localhost:4000](http://localhost:4000)

---

## 🔑 Demo Credentials

### Local Demo / Database Seed Credentials:
* **Cafe Owner**: `owner@counterpoint.local` / `Owner123!`
* **Platform Admin**: `admin@counterpoint.local` / `Admin123!`

---

## 📄 License
MIT License.
