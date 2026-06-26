<div align="center">

# 👑 Tag ERP (تاج)

### Enterprise Resource Planning — Integrated Management System

**Built by [Yousef Magar](https://github.com/yousefmagar)**


---

*A full-featured, offline-first ERP system powering Al-Nujoom Co. — from operations to delivery, all in the browser.*

</div>

---

## 📌 Overview

Tag ERP (تاج) is a **production-grade, browser-based ERP system** covering every business process — production scheduling, inventory management, sales, fleet tracking, HR & payroll, accounting, and more — all running **locally without an internet connection** after the first load.

No cloud lock-in. No monthly fees. Your data never leaves the device.

> **Default credentials**
> Email: `admin@elnujoom.com` · Password: `admin123`

---

## ✨ Key Highlights

- **19 fully integrated modules** covering the entire factory workflow
- **100% offline-capable** — powered by IndexedDB (Dexie.js), no backend required
- **Bilingual UI** — Arabic (RTL) and English with instant live switching
- **PWA support** — installable on desktop, mobile, and tablet as a standalone app
- **Role-based access control** — granular per-module permissions for unlimited sub-accounts
- **AI Load Optimization** — smart fleet loading suggestions based on capacity and geography
- **Animated, responsive UI** — GSAP + Framer Motion with interactive 3D tilt cards
- **Arabic spell-check engine** — 100+ feed industry terms with Egyptian dialect correction

---

## 🗂️ Modules

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/` | KPI cards, weekly sales charts, fleet map, attendance summary |
| Production | `/production` | Work orders, sessions, bag packing, formula management, cost calculation |
| Inventory | `/inventory` | Raw materials & finished goods, warehouse alerts, stock transfers |
| Sales | `/sales` | Invoicing (cash/credit), payment methods, returns, customer credit limits |
| Customers | `/customers` | Customer profiles, account statements, purchase history |
| Fleet & Delivery | `/fleet` | Vehicle management, multi-stop shipments, expense tracking, AI load optimizer |
| HR | `/hr` | Employee records, shifts, daily bonuses, salesperson commissions, leaves |
| Attendance | `/attendance` | Full attendance calendar, check-in/out, overtime calculation |
| Payroll | `/payroll` | Monthly & weekly payroll, deductions, advances, payslip export |
| Marketing | `/marketing` | Campaigns, leads, sales rep performance tracking |
| Accounting | `/accounting` | Treasury, bank accounts, e-wallets, ledger, trial balance |
| Procurement | `/procurement` | Supplier management, purchase orders, returns, payment allocation |
| Pricing & Cost | `/pricing` | Product price tiers, formula-based cost calculation, price history |
| Profit | `/profit` | Revenue, COGS, gross & net profit with daily breakdown |
| Reports | `/reports` | Customizable multi-module reports, charts, PDF export |
| AI Assistant | `/ai-assistant` | Google Gemini integration for factory analytics and Q&A |
| Settings | `/settings` | Company profile, themes, invoice config, tax, backup/restore |
| Sub Accounts | `/sub-accounts` | User management with 30+ granular permission controls |
| Activity Log | `/activity-log` | Full audit trail — every system event, searchable and exportable |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion + GSAP 3.12.5 |
| Charts | Recharts 2.15 |
| State Management | Zustand 5 |
| Local Database | Dexie.js (IndexedDB) |
| Routing | wouter |
| UI Primitives | Radix UI + shadcn/ui (64 components) |
| Icons | Lucide React |
| Notifications | Sonner |
| Drawer UI | Vaul |
| Date Handling | date-fns |
| PWA | vite-plugin-pwa |
| Utilities | clsx + tailwind-merge |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Development

```bash
cd artifacts/feedflow-erp
pnpm install
pnpm run dev
# → http://localhost:5173
```

### Production — Local Network Server

```bash
# Builds the project and serves it at http://192.168.137.1:8080
# Auto-detects the machine's IP — any device on the same Wi-Fi can connect
start-server.cmd
```

### Public HTTPS URL (via Cloudflare Tunnel)

```bash
# Generates a public HTTPS link, e.g. https://xxxxx.trycloudflare.com
# Requires the server to be running on localhost:8080
tunnel.cmd
```

### One-Click Full Deploy

```bash
# Builds frontend + API, starts server + tunnel in two windows
start-online.cmd
```

---

## 📁 Project Structure

```
El-Nujoom Feeds Co/
├── start-server.cmd          # Production server → port 8080
├── start-online.cmd          # Server + Cloudflare tunnel
├── deploy-network.cmd        # Full build + network deploy
├── tunnel.cmd                # Public HTTPS tunnel
└── artifacts/
    └── feedflow-erp/
        ├── src/
        │   ├── pages/        # 23 page components
        │   ├── hooks/        # 14 Zustand stores + custom hooks
        │   └── components/   # UI component library
        ├── public/
        └── vite.config.ts
```

---

## 🔐 Permissions & Security

Tag uses a **3-tier permission model** enforced via the `usePermission()` hook:

- **No Access** — module hidden entirely
- **View Only** — read-only access
- **Full Access** — create, edit, delete, print, export

Beyond module-level access, there are **30+ granular action permissions** (e.g. `sales.create`, `production.delete`, `activity_log.export`) plus special flags for sensitive areas:

- Override discount limits
- Access to pricing data
- HR data visibility
- Payroll access

---

## 💾 Data Architecture

```
Component → Zustand Store → Dexie.js (IndexedDB)
                 ↓
          Activity Log  ← every operation is recorded
                 ↓
     Notification Checker  ← polls every 30 seconds
                 ↓
        Auto Backup  ← every 6 hours
```

**Three-layer backup:**
1. `localStorage` (fallback)
2. IndexedDB via Dexie.js (primary)
3. Manual JSON export/import

No external API required. The app is entirely self-contained.

---

## ⌨️ Keyboard Shortcuts

Navigate the entire system without lifting your hands from the keyboard. Shortcuts work in both Arabic and English keyboard layouts (bound to physical key codes, not characters).

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Global search |
| `Ctrl+Alt+N` | Add new record |
| `Ctrl+Shift+S` | Save |
| `Ctrl+Shift+P` | Print |
| `Ctrl+Shift+E` | Export |
| `Ctrl+Alt+D/P/S/I/F/H/R…` | Navigate to module |
| `?` (outside input) | Show shortcuts reference |

---

## 🌐 Internationalization

- Full Arabic (RTL) and English UI
- Every button, table, report, and error message is translated
- Arabic spellcheck engine with Egyptian dialect support — 100+ feed industry terms, Levenshtein-distance suggestions, and smart autocomplete in input fields

---

## 📸 Notable UI Components

| Component | Description |
|-----------|-------------|
| `TiltCard` | 3D perspective tilt on mouse movement |
| `AnimatedNumber` | Counting animation for KPI values |
| `SmartInput` | Arabic autocomplete + spellcheck field |
| `ParticleField` | Ambient animated background |
| `MagneticButton` | Cursor-attracting CTA buttons |
| `ScrollReveal` | Intersection Observer–triggered entry animations |
| `MeshGradient` | Animated gradient background |

---

## 📄 License

Private — built for Al-Nujoom Feed Co. All rights reserved.

---

<div align="center">
  
**Tag ERP v1.0** · Al-Nujoom Co. · Built by Yousef Magar

</div>
