# 🌙 Nila Cafe — Point of Sale (POS) & Management Platform ☕

A modern, multi-tenant browser-based POS and cafe management system designed for **Nila Cafe**. It features a fast React (Vite) frontend, Express.js REST API, PostgreSQL database schema, Docker Compose setup, inventory management, dining/takeaway/delivery billing, receipt printing, and sales reporting.

---

## 🚀 Features

- 🧾 **Point of Sale (POS)**: Instant item lookup, category filtering, cart management, takeaway/dining/delivery order pricing, item/bill discounts, and instant receipt preview/printing.
- 📦 **Inventory & Products**: Product catalog with SKU codes, categories, pricing, and live stock tracking.
- 📊 **Sales & Reporting**: Real-time sales transactions, order breakdown by channel, and instant CSV export.
- 🏢 **Multi-Tenant / Multi-Shop**: Independent shop workspaces, tenant-isolated products and billing.
- 💡 **Dual Mode**: Local demo mode (offline browser testing) or persistent database-backed mode (PostgreSQL + JWT auth).

---

## 🛠️ Project Structure

```text
nila-cafe/
├── client/              # React + Vite frontend POS interface
│   ├── src/             # Components, styles, icons
│   ├── package.json
│   └── vite.config.js
├── server/              # Express API & PostgreSQL backend
│   ├── src/             # Authentication, products, sales, reports routes
│   ├── sql/schema.sql   # Multi-tenant PostgreSQL database schema
│   └── package.json
├── docker-compose.yml   # PostgreSQL container configuration
├── .env.example         # Environment template
└── package.json         # Workspace root scripts
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start PostgreSQL Database
```bash
docker compose up -d db
```

### 3. Setup Environment Variables
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```

### 4. Seed Initial Data
```bash
npm run seed --workspace server
```

### 5. Start Development Servers
```bash
npm run dev
```

* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔑 Demo Credentials

### Local Demo / Database Seed Credentials:
* **Shop Owner**: `owner@counterpoint.local` / `Owner123!`
* **Platform Admin**: `admin@counterpoint.local` / `Admin123!`

---

## 📜 Available Scripts

* `npm run dev` — Run both Vite frontend and Express server concurrently
* `npm run build` — Build frontend for production
* `npm test` — Run server test suite
* `npm run start --workspace server` — Start Express API server only

---

## 📄 License
MIT License.
