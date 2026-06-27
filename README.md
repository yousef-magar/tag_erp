<div align="center">

# 👑 Tag ERP — نظام تخطيط موارد المؤسسة (تاج)

### **Enterprise Resource Planning System — Full-Stack, Offline-First, Production-Grade**

**Built & Architected by [Yousef Magar](https://github.com/yousefmagar)**


---

*Production system powering **Al-Nujoom Feed Co.** — managing daily operations across production, sales, fleet, HR, and accounting.*

</div>

---

## 🧠 What Is This?

**Tag ERP** is a fully self-contained, browser-based ERP system I designed and built from scratch to replace fragmented manual workflows at a real manufacturing company.

It runs **100% offline** after the first load — no cloud, no server, no monthly fees — and covers **19 integrated business modules** from production scheduling to payroll.

This project represents a complete, end-to-end software product: I handled everything from system architecture and database design to UI/UX, business logic, and deployment.

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion + GSAP 3.12.5 |
| Charts & Data Viz | Recharts 2.15 |
| State Management | Zustand 5 |
| Local Database | Dexie.js (IndexedDB) |
| Routing | Wouter |
| UI Component System | Radix UI + shadcn/ui (64 components) |
| Icons | Lucide React |
| Notifications | Sonner |
| Date Handling | date-fns |
| PWA | vite-plugin-pwa |

---

## ✨ Key Engineering Highlights

- **Offline-first architecture** — all data persisted in IndexedDB via Dexie.js; no backend or internet required after initial load
- **19 fully integrated modules** with shared state and cross-module data flow (e.g., production → inventory → invoicing → accounting)
- **Role-based access control (RBAC)** — 3-tier permission model with 30+ granular action-level permissions enforced via a custom `usePermission()` hook
- **AI-powered fleet load optimizer** — suggests optimal vehicle loading based on capacity and geographic routing
- **Bilingual UI** — full Arabic (RTL) and English support with live switching and no layout shifts
- **Arabic spell-check engine** — custom-built with 100+ industry-specific terms, Levenshtein-distance suggestions, and smart autocomplete
- **PWA** — installable on desktop, mobile, and tablet as a standalone app
- **Three-layer data backup** — localStorage fallback + IndexedDB primary + manual JSON export/import
- **Full audit trail** — every system action logged with timestamps, searchable and exportable
- **Auto-backup** every 6 hours; real-time notification polling every 30 seconds

---

## 🗂️ Modules (19 Total)

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI cards, weekly sales charts, fleet map, attendance summary |
| **Production** | Work orders, sessions, bag packing, formula management, cost calculation |
| **Inventory** | Raw materials & finished goods, warehouse alerts, stock transfers |
| **Sales** | Invoicing (cash/credit), payment methods, returns, customer credit limits |
| **Customers** | Customer profiles, account statements, purchase history |
| **Fleet & Delivery** | Vehicle management, multi-stop shipments, expense tracking, AI load optimizer |
| **HR** | Employee records, shifts, daily bonuses, commissions, leaves |
| **Attendance** | Full attendance calendar, check-in/out, overtime calculation |
| **Payroll** | Monthly & weekly payroll, deductions, advances, payslip export |
| **Marketing** | Campaigns, leads, sales rep performance tracking |
| **Accounting** | Treasury, bank accounts, e-wallets, ledger, trial balance |
| **Procurement** | Supplier management, purchase orders, returns, payment allocation |
| **Pricing & Cost** | Product price tiers, formula-based cost calculation, price history |
| **Profit Analytics** | Revenue, COGS, gross & net profit with daily breakdown |
| **Reports** | Customizable multi-module reports, charts, PDF export |
| **AI Assistant** | Google Gemini integration for factory analytics and Q&A |
| **Settings** | Company profile, themes, invoice config, tax settings, backup/restore |
| **Sub-Accounts** | User management with 30+ granular permission controls |
| **Activity Log** | Full audit trail — every system event, searchable and exportable |

---

## 🏗️ System Architecture

```
Component → Zustand Store → Dexie.js (IndexedDB)
                 ↓
          Activity Log  ← every operation recorded
                 ↓
     Notification Checker  ← polls every 30 seconds
                 ↓
        Auto Backup  ← every 6 hours
```

**Data Flow:** Every user action goes through a Zustand store (typed, reactive), is persisted to IndexedDB, and simultaneously logged to the audit trail — ensuring full traceability without any backend.

---

## 🔐 Permissions & Security

A custom **3-tier RBAC model** enforced via the `usePermission()` hook:

- **No Access** — module hidden entirely from UI
- **View Only** — read-only access
- **Full Access** — create, edit, delete, print, export

Beyond module-level access, **30+ granular action permissions** are available (e.g. `sales.create`, `production.delete`, `activity_log.export`) plus special-access flags for sensitive areas:

- Override discount limits
- Access to pricing data
- HR data visibility
- Payroll access

---

## 🚀 Running the Project

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

### Development (Custom Port & Path)

```powershell
$env:PORT=3000; $env:BASE_PATH='/'
Set-Location "D:\El-Nujoom Feeds Co\artifacts\feedflow-erp"
npx vite --config vite.config.ts --host 0.0.0.0
```

### Production — Local Network Server

```bash
# Builds and serves at http://192.168.137.1:8080
# Auto-detects machine IP — accessible to any device on the same Wi-Fi
start-server.cmd
```

### Public HTTPS URL (via Cloudflare Tunnel)

```bash
# Generates a public HTTPS link: https://xxxxx.trycloudflare.com
# Requires server running on localhost:8080
tunnel.cmd
```

### One-Click Full Deploy

```bash
# Builds frontend + API, starts server + tunnel in parallel
start-online.cmd
```

> **Default login:** `admin@tag.com` / `admin@tag`

---

## 📁 Project Structure

```
tag_erp/
├── start-server.cmd          # Production server → port 8080
├── start-online.cmd          # Server + Cloudflare tunnel
├── deploy-network.cmd        # Full build + network deploy
├── tunnel.cmd                # Public HTTPS tunnel
└── artifacts/
    └── feedflow-erp/
        ├── src/
        │   ├── pages/        # 23 page components
        │   ├── hooks/        # 14 Zustand stores + custom hooks
        │   └── components/   # UI component library (64 components)
        ├── public/
        └── vite.config.ts
```

---

## ⌨️ Keyboard Shortcuts

Full keyboard navigation — shortcuts are bound to physical key codes, not characters, so they work in both Arabic and English layouts.

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

## 🎨 Notable UI Engineering

| Component | Description |
|-----------|-------------|
| `TiltCard` | 3D perspective tilt on mouse movement (GSAP) |
| `AnimatedNumber` | Smooth counting animation for KPI values |
| `SmartInput` | Arabic autocomplete + real-time spellcheck |
| `ParticleField` | Ambient animated background |
| `MagneticButton` | Cursor-attracting CTA buttons |
| `ScrollReveal` | Intersection Observer–triggered entry animations |
| `MeshGradient` | Animated gradient background |

---

## 🌐 Internationalization

- Full Arabic (RTL) and English UI with live switching
- Every button, table header, report, and error message is translated
- Custom Arabic spellcheck engine: 100+ feed industry terms, Levenshtein-distance correction, and smart autocomplete

---

## 📄 License

Private — built for Al-Nujoom Feed Co. All rights reserved.

---

<div align="center">

**Tag ERP v1.0** · Al-Nujoom Feed Co. · Built by Yousef Magar

</div>
