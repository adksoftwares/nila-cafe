# 🌙 Nila Cafe — Point of Sale (POS) & Cafe Management Platform ☕

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node: >=22](https://img.shields.io/badge/Node->=22-green.svg)
![PostgreSQL: 16](https://img.shields.io/badge/PostgreSQL-16-blue.svg)
![Tests](https://img.shields.io/badge/Tests-68%20Passing-brightgreen.svg)

A high-performance, multi-tenant browser-based POS and cafe management platform engineered for **Nila Cafe**. Built with a fast React 18 (Vite) single-page application frontend, modular Express.js micro-framework API with rate limiting, Zod declarative validation, Pino structured logging, PostgreSQL 16 database with Row-Level Security (RLS) multi-tenancy, multi-station Kitchen Display System (KDS), double-entry Bill of Materials (BOM) inventory ledger, native binary ESC/POS thermal printing, and production containerization.

---

## 🚀 Enterprise Feature Catalog

### 1. 🧾 Point of Sale (POS) & Cart Engine
- **Instant Search & Hotkeys**: Fast keyboard navigation (`Ctrl+K` global item search), category filtering, and item pagination.
- **Dynamic Pricing Rules**: Automatic price adjustments based on order type (Takeaway vs Dining vs Delivery).
- **Cart Management**: Cart state isolated via `CartContext` with real-time price calculations, discounts, and item modifiers.
- **Offline Resilience**: Queue checkouts locally during network dropouts; auto-drains queue idempotently upon reconnection without duplicate transactions.

### 2. 💸 Dynamic Tax & Service Charge Engine
- **Configurable Tax Breakdown**: Per-shop configurable rates for **10% Service Charge**, **2.5% SSCL** (Social Security Contribution Levy), and **18% VAT** (Value Added Tax).
- **Exemption Rules**: Automatic exemption of Service Charges on Takeaway and Delivery orders.
- **Audit-Proof Rounding**: Currency rounding designed to prevent IEEE-754 floating-point arithmetic leaks.

### 3. 📦 Raw Ingredients & Bill of Materials (BOM) Recipe Engine
- **Automated Stock Depletion**: Checking out orders automatically decrements mapped raw ingredients (e.g. coffee beans, milk, burger buns).
- **Double-Entry Void Restock**: Cancelling or voiding a sale automatically returns both finished goods and raw ingredient stock with full ledger tracking.
- **Shipment Restock Ledger**: Track incoming shipments with supplier unit costs and low-stock alert thresholds.
- **Recipe Margin Calculator**: Real-time margin and cost analysis per recipe.

### 4. 🖨️ ESC/POS Thermal Printing & Hardware Control
- **Binary ESC/POS Protocol**: Generates hardware-native binary command buffers for 80mm (48 column) and 58mm (32 column) receipt printers.
- **Cash Drawer RJ11 Kick**: Generates 24V pin-2 electrical pulse to trigger physical cash drawers on cash settlements.
- **WebUSB & Network Socket**: Direct browser hardware access via WebUSB API and server-side direct TCP socket printing (`port 9100`).
- **Reports & Test Patterns**: Diagnostic alignment patterns, Interim X-Reports, Sequential Z-Reports, and Barista/Chef KOT slips.

### 5. 🪑 Restaurant Floor Plan & Open Tabs Engine
- **Visual Table Grid**: Real-time table status monitoring (`vacant`, `occupied`, `ordered`, `bill_printed`).
- **Open Tabs & Hold Orders**: Park orders on specific tables, incrementally fire add-on rounds to the kitchen, and settle tabs seamlessly.

### 6. 🧑‍🍳 Multi-Station Kitchen Display System (KDS)
- **Station Routing**: Line items route automatically to **Barista** (beverages, coffees) or **Hot Kitchen** (burgers, pizza, fries) stations.
- **Live SLA Timers**: Color-coded elapsed order duration badges:
  - 🟢 **Fresh**: < 10 mins
  - 🟡 **Warning**: 10 – 20 mins
  - 🔴 **Delayed**: > 20 mins
- **Line-Item Bumping & Real-Time Sync**: Bump individual items or advance tickets to ready. Server-Sent Events (SSE) stream order updates in real time.

### 7. 🛡️ Security, RBAC & Forensic Audit Trail
- **Role-Based Access Control**: Strict privilege boundaries between `Admin`, `Owner`, `Manager`, `Cashier`, and `Waiter`.
- **Manager PIN Authorization**: Mandatory PIN challenge for high-risk actions (sale voids, cash drawer kicks, manual shifts adjustments).
- **PostgreSQL Row-Level Security (RLS)**: Enforced database-level multi-tenant isolation preventing cross-shop data leaks.
- **Forensic Audit Engine**: Immutable audit trail recording user identity, action category, severity, timestamp, and metadata.

### 8. 💵 Shift Reconciliation & Sequential Z-Counter
- **Blind Till Reconciliation**: Cashiers count and enter physical drawer denominations before viewing expected cash.
- **Discrepancy Reporting**: Automatic calculation of cash overages/shortages with mandatory variance explanations.
- **Sequential Z-Counter**: Monotonically incrementing daily financial Z-number for tax authority compliance.
- **Interim X-Reports**: Mid-shift readouts without closing the shift or resetting accumulators.

### 9. 🎁 Customer Loyalty & Promotional Campaigns
- **Loyalty Points Engine**: Customers earn points on spend with instant redemption at checkout.
- **Promotional Coupons**: Percentage and fixed discount campaigns with minimum order spend validation.

### 10. 🐳 Production Containerization & Observability
- **Node 22 LTS Alpine**: Lightweight, multi-stage Docker builds utilizing `dumb-init` for proper signal handling and non-root execution.
- **Liveness & Readiness Probes**: Kubernetes and Docker-compatible probes (`/api/health/liveness`, `/api/health/readiness`).
- **Deep Health Diagnostics**: Real-time monitoring of database connection pool latency, total/idle/waiting connections, process RSS/heap memory, and system load.
- **Graceful Shutdown**: Intercepts `SIGTERM` and `SIGINT` to drain in-flight HTTP requests and cleanly terminate database pools.

---

## 🛠️ Monorepo Architecture

```text
nila-cafe/
├── .github/workflows/         # CI/CD Automated Test & Build Pipeline
├── client/                    # React 18 + Vite Production Frontend
│   ├── src/
│   │   ├── components/        # Sidebar, Topbar, Modals, Toasts
│   │   ├── context/           # CartContext, ShiftContext
│   │   ├── pages/             # POS, KDS, Products, BOM, Sales, Audit, Settings
│   │   └── utils/             # ESC/POS helpers, WebUSB, offline queue
│   ├── Dockerfile             # Multi-stage builder (Node 22 -> Nginx Alpine)
│   └── nginx.conf             # Hardened SPA Nginx reverse proxy & security headers
├── server/                    # Node.js 22 + Express Modular Backend
│   ├── sql/
│   │   └── schema.sql         # PostgreSQL 16 schema with Row-Level Security (RLS)
│   ├── src/
│   │   ├── middleware/        # JWT auth, RBAC permissions, Rate limiters
│   │   ├── routes/            # Modular domain route handlers
│   │   ├── schemas/           # Declarative Zod validation schemas
│   │   ├── utils/             # Pino logger, ESC/POS compiler, health diagnostics
│   │   ├── db.js              # PostgreSQL connection pool with demo fallback
│   │   ├── index.js           # Server bootstrap and graceful shutdown lifecycle
│   │   ├── seed.js            # Comprehensive idempotent database seeder
│   │   └── index.test.js      # 68 automated unit and integration tests
│   └── Dockerfile             # Multi-stage Node 22 Alpine container with dumb-init
├── docker-compose.prod.yml    # Production stack (Postgres + API + Nginx Web)
├── docker-compose.yml         # Local development Postgres database
├── .env.example               # Root unified environment variables template
└── package.json               # Monorepo workspace configuration
```

---

## ⚡ Quickstart: Local Development

### 1. Prerequisites
- **Node.js**: >= 20.x (Recommended: Node 22 LTS)
- **NPM**: >= 10.x
- **Docker**: (Optional, for running local PostgreSQL 16)

### 2. Installation
Clone the repository and install all workspace dependencies:
```bash
git clone https://github.com/adksoftwares/nila-cafe.git
cd nila-cafe
npm install
```

### 3. Start Local PostgreSQL Database
```bash
docker compose up -d db
```

### 4. Run Automated Test Suite
Run the 68 automated tests covering business logic, tax calculations, ESC/POS binary buffers, and health diagnostics:
```bash
npm test --workspace server
```

### 5. Initialize Database Schema & Seed Data
```bash
npm run seed --workspace server
```

### 6. Start Development Servers
```bash
npm run dev
```
- **Web Application**: [http://localhost:5173](http://localhost:5173)
- **REST API & Health**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🐳 Production Deployment

Deploy the entire hardened stack (PostgreSQL 16 DB + Node 22 API + Nginx Web Frontend) with a single command:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- **Production POS Frontend**: [http://localhost](http://localhost) (Port 80)
- **Production REST API**: [http://localhost:4000](http://localhost:4000)
- **Health Check Probe**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

### Container Resilience Architecture:
- **`db`**: PostgreSQL 16 with persistent volume and `pg_isready` health check.
- **`api`**: Node 22 Alpine running with `dumb-init`, non-root user, 15-second graceful shutdown drain window, and log rotation (`max-size: 10m`).
- **`web`**: Nginx Alpine serving compressed static assets with hardened headers and health probes.

---

## 🔑 Default Credentials & Role Matrix

| Role | Email | Password | Manager PIN | Scope |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | `admin@counterpoint.local` | `Admin123!` | — | Platform-wide shops management, audit logs, system overview |
| **Cafe Owner** | `owner@counterpoint.local` | `Owner123!` | `1234` | Full cafe shop control, inventory, recipes, staff, financial reports |
| **Store Manager**| `manager@counterpoint.local` | `Manager123!`| `1234` | Shift approvals, void authorisations, stock adjustments |
| **Counter Cashier**| `cashier@counterpoint.local` | `Cashier123!`| — | POS order taking, payments, drawer operations, shift till reconciliation |
| **Floor Waiter** | `waiter@counterpoint.local` | `Waiter123!` | — | Table floor plan management, open tabs, KOT kitchen firing |

> [!IMPORTANT]
> Change all default credentials and configure a secure `JWT_SECRET` prior to deploying to a public production environment.

---

## 📡 Health Check & Observability Endpoints

| Endpoint | Method | Purpose | Response Sample |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Comprehensive system diagnostic | Database latency, connection pool stats, memory usage, uptime |
| `/api/health/liveness` | `GET` | Container liveness probe | `{"status": "alive", "timestamp": "..."}` |
| `/api/health/readiness` | `GET` | Traffic readiness probe (returns 503 if DB down or shutting down) | `{"status": "ready", "database": "connected", "ready": true}` |

---

## 📄 License
MIT License. Crafted with precision for **Nila Cafe**.
