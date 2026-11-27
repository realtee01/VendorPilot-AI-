# VendorPilot AI

**AI-powered business management and private cloud ledger for growing SMEs, wholesalers, and retail merchants.**

VendorPilot AI brings sales orders, operating expenses, inventory control, revenue growth analytics, and a ledger-grounded AI Business Assistant into one fast, responsive workspace. Built with multi-currency support (including Nigerian Naira `₦`, USD `$`, GBP `£`, EUR `€`, GHS `₵`, and KES `KSh`), it replaces scattered notebooks and spreadsheets with real-time financial visibility backed by Cloud Firestore.

---

## Key Capabilities

### Executive Frosted-Glass Dashboard
- **Period-Based KPIs**: Instantly slice Total Revenue, Estimated Net Profit, Total Expenses, Outstanding Payments, Total Products, and Low-Stock Products across **Daily**, **Weekly**, **Monthly**, and **All Time** windows.
- **Interactive Revenue Growth Chart**: Switch between **Growth Bars** (interactive scrubbable and keyboard-accessible period bars color-coded by performance tier) and **Growth Curve** (cumulative revenue trajectory alongside period revenue) across **7 Days**, **30 Days**, and **6 Months** with real period-over-period growth rates.
- **Business Health Radial Dial**: Live 240-degree animated gauge tracking **Profit Margin %**, **Payment Collection Rate %**, and **Inventory Stock Health %**.
- **Sales vs. Expenses & Operational Feeds**: Visual cashflow comparison, top-selling product rankings, recent customer transactions, and one-click low-stock restocking.
- **Floating View Dock**: Jump smoothly between **Overview**, **Revenue Growth**, and **Quick Actions** in both Light and Dark themes.

### Sales & Orders Management
- Log customer orders with automatic order numbering (`VP-1001+`), quantity/unit-price totals, and payment status tracking (**Paid**, **Partial**, **Pending**).
- **Atomic Stock Deduction**: Recording, editing, or deleting a linked sale calculates exact net stock deltas so inventory never double-deducts.
- Settle partial or pending customer balances in one click and export filtered sales ledgers to CSV for offline accounting.

### Expense Tracking & Category Breakdown
- Record operational costs across Stock & Restocking, Logistics & Delivery, Rent & Utilities, Power & Generator, Staff & Payroll, Marketing, Equipment, and Miscellaneous.
- **Expense Category Pie Chart**: Interactive breakdown showing exactly where operating funds are going by category and percentage share.
- Search, filter, edit, delete, and export expense records as formula-safe CSV files.

### Inventory Control & Low-Stock Alerts
- Manage SKUs, cost prices, selling prices, unit margins, current stock levels, and custom reorder thresholds.
- Automatic status classification (**In Stock**, **Low Stock**, **Out of Stock**) with prioritized low-stock alerts and one-click quick restocking from both the Dashboard and Inventory views.

### Ledger-Grounded AI Business Assistant
- Ask natural-language questions about revenue, expenses, profit margins, receivables, top-selling products, customer history, and restock priorities.
- Generate instant **Weekly** and **Monthly Business Summaries** backed by deterministic calculations over your live Cloud Firestore records—never fabricated figures.
- Includes categorized quick prompts and follow-up suggestions tailored to your workspace.

### Conversational First-Time Onboarding
- Welcoming, multi-step conversational setup flow for new accounts (collecting name, business vs. personal focus, workspace details & currency, experience level, and first goal).
- Automatically saves progress as you go, personalizes the dashboard quick-start recommendations, and sends returning users straight into their workspace.

### Offline Accounting CSV Exports
- Export sanitized, Excel-safe CSV files from the **Dashboard** (executive summary + period transactions), **Sales & Orders**, and **Expenses** views, with built-in formula-injection neutralization.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| **Animation & Visualization** | Motion (`motion/react`), Recharts, Lucide React |
| **Backend & Cloud** | Express (`server.ts`), Vercel Serverless Functions (`api/`), Firebase Auth, Cloud Firestore |
| **Performance** | Route-level `React.lazy` + `Suspense` code splitting, memoized single-pass analytics, DiceBear SVG avatars |
| **Testing & Quality** | Node built-in test runner via `tsx`, strict TypeScript (`tsc --noEmit`), ESLint Firestore rules checks |

---

## Security & Privacy Architecture

- **Strict Tenant Isolation**: Every business profile, sale, expense, product, and customer document is scoped to the authenticated user's `userId` and enforced by Cloud Firestore security rules (`firestore.rules`).
- **Authenticated Access**: Supports Email/Password authentication with email verification as well as Google Sign-In.
- **Input & Ledger Integrity**: Client- and rules-level validation enforces ISO dates, finite positive bounds, and safe string lengths.
- **Safe Accounting Exports**: CSV cells neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`) to prevent CSV injection when opening reports in Excel or Google Sheets.
- **Server-Side Secrets & Rate Limiting**: Sensitive API keys stay strictly server-side with per-user rate limiting on API endpoints.

---

## Project Structure

```text
.
├── api/                         # Vercel serverless API endpoints (ai-assistant, health)
├── public/                      # Static public assets & SVG favicon
├── src/
│   ├── assets/images/           # Generated visual assets
│   ├── components/
│   │   ├── ui/                  # Reusable frosted-glass dashboard UI components
│   │   ├── AIAssistantView.tsx  # Grounded AI Business Assistant chat & ledger snapshot
│   │   ├── AuthView.tsx         # Sign-in, registration, and password reset flows
│   │   ├── DashboardView.tsx    # Live Firestore bridge for the Glass Business Dashboard
│   │   ├── ExpensesView.tsx     # Expense ledger, CSV export, and category pie chart
│   │   ├── InventoryView.tsx    # SKU catalogue, stock valuation, and quick restock
│   │   ├── LandingPage.tsx      # Public product showcase & interactive cockpit preview
│   │   ├── Layout.tsx           # Responsive sidebar, top bar, and mobile drawer shell
│   │   ├── OnboardingView.tsx   # Conversational multi-step first-time setup
│   │   ├── SalesView.tsx        # Sales order ledger, payment settlement, and CSV export
│   │   └── SettingsView.tsx     # Business profile, currency, and account preferences
│   ├── context/                 # BusinessContext (Firestore sync) & ThemeContext (Light/Dark)
│   ├── data/                    # Currency options, categories, and business constants
│   ├── server/                  # Shared server helpers, rate limiter, and server tests
│   ├── types/                   # Shared TypeScript interfaces for business domain models
│   ├── utils/                   # Pure analytics, revenue growth, CSV export, avatar & assistant engines
│   ├── App.tsx                  # Auth gating, onboarding flow, lazy route orchestration
│   ├── firebase.ts              # Firebase Auth & Cloud Firestore initialization
│   └── index.css                # Tailwind v4 theme tokens, dark mode & frosted glass system
├── firestore.rules              # Cloud Firestore tenant-isolation security rules
├── server.ts                    # Express + Vite development/production server entry point
├── vercel.json                  # Vercel function bundling & SPA rewrite configuration
└── vite.config.ts               # Vite build & asset pipeline configuration
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm (or Bun)
- A configured Firebase project (`firebase-applet-config.json`) with Authentication and Cloud Firestore enabled

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and set your environment values:

```env
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

### Development Server

Start the full-stack Express + Vite development server on port `3000`:

```bash
npm run dev
```

---

## Scripts & Verification

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Runs the Express + Vite development server (`tsx server.ts`) |
| `npm run build` | Builds the production Vite bundle into `dist/` |
| `npm run start` | Runs the production server (`node server.ts`) |
| `npm run lint` | Runs strict TypeScript type-checking (`tsc --noEmit`) |
| `npx tsx --test src/utils/*.test.ts src/server/*.test.ts` | Executes the full unit test suite (analytics, revenue growth, CSV safety, auth validation, assistant engine, rate limiter, and health API) |

---

## Deployment

VendorPilot AI is ready for deployment on **Vercel** or any Node.js container platform (such as Cloud Run):

- **Vercel**: Uses `vercel.json` to bundle serverless functions in `api/` (`api/ai-assistant.ts` and `api/health.ts`) and route SPA traffic cleanly to `index.html`.
- **Node / Cloud Run**: Build with `npm run build` and start with `npm run start` on port `3000`.

---

## License

All rights reserved. Built for modern SME commerce and financial clarity.
