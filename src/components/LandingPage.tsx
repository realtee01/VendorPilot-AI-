import React, { useState } from 'react';
import { m } from 'motion/react';
import {
  Bot,
  Check,
  ChevronRight,
  LayoutDashboard,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { ThemeToggleButton } from '../context/ThemeContext';
import {
  LandingHero,
  RollingCtaButton,
  VendorPilotIntroSplash,
  VendorPilotMotionProvider,
} from './LandingHero';

interface LandingPageProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

type PreviewRange = '7d' | '30d' | '6m';

interface HeroPreviewData {
  revenueLabel: string;
  revenueValue: string;
  deltaNote: string;
  outstandingValue: string;
  outstandingNote: string;
  expensesValue: string;
  profitValue: string;
  profitMargin: string;
  lowStockCount: string;
  points: number[];
  labels: string[];
}

const HERO_PREVIEW_DATA: Record<PreviewRange, HeroPreviewData> = {
  '7d': {
    revenueLabel: 'Weekly Revenue',
    revenueValue: '₦1.28M',
    deltaNote: '₦214,000 collected across 19 customer orders',
    outstandingValue: '₦172,000',
    outstandingNote: '2 orders awaiting balance',
    expensesValue: '₦465,000',
    profitValue: '₦815,000',
    profitMargin: '63.7%',
    lowStockCount: '3 items',
    points: [180, 240, 210, 310, 285, 360, 395],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  '30d': {
    revenueLabel: 'Monthly Revenue',
    revenueValue: '₦4.85M',
    deltaNote: '₦4.24M collected · 68 orders recorded this month',
    outstandingValue: '₦612,000',
    outstandingNote: '5 unpaid / partial orders',
    expensesValue: '₦3.18M',
    profitValue: '₦1.67M',
    profitMargin: '34.4%',
    lowStockCount: '4 items',
    points: [420, 680, 540, 790, 960, 840, 910],
    labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Now'],
  },
  '6m': {
    revenueLabel: '6-Month Revenue',
    revenueValue: '₦26.4M',
    deltaNote: 'Consistent wholesale & retail growth in NGN (₦)',
    outstandingValue: '₦612,000',
    outstandingNote: '97.7% collection rate',
    expensesValue: '₦18.1M',
    profitValue: '₦8.30M',
    profitMargin: '31.4%',
    lowStockCount: '4 items',
    points: [320, 480, 410, 620, 740, 690, 880],
    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};

type BusinessSegmentId = 'wholesalers' | 'retail' | 'provisions' | 'fashion' | 'hardware';

interface BusinessSegment {
  id: BusinessSegmentId;
  label: string;
  headline: string;
  description: string;
  replaces: string;
  bullets: string[];
  previewTitle: string;
  previewKpis: Array<{ label: string; value: string }>;
  previewRows: Array<{ primary: string; secondary: string; amount: string; status: 'Paid' | 'Partial' | 'Pending' }>;
}

const BUSINESS_SEGMENTS: BusinessSegment[] = [
  {
    id: 'wholesalers',
    label: 'Wholesalers',
    headline: 'Your wholesale ledger, finally sorted.',
    description:
      'No more credit balances lost in notebooks, stock counts in spreadsheets, or late-night calculator errors. VendorPilot AI keeps every carton, bag, and customer transfer in one place.',
    replaces: 'Paper notebooks · Spreadsheets · WhatsApp order threads',
    bullets: [
      'Track paid, partial, and credit wholesale orders at a glance',
      'Auto-deduct warehouse cartons & bags with zero duplicate deductions',
      'Spot high-margin bulk buyers and overdue balances immediately',
    ],
    previewTitle: 'Wholesale Orders',
    previewKpis: [
      { label: 'Monthly Revenue', value: '₦4,850,000' },
      { label: 'Outstanding Credit', value: '₦612,000' },
      { label: 'Est. Net Profit', value: '₦1,670,000' },
    ],
    previewRows: [
      { primary: 'Mama Gold Rice (50kg) · Qty 15', secondary: 'Amaka Distributors', amount: '₦1,267,500', status: 'Paid' },
      { primary: "Devon King's Oil (5L) · Qty 24", secondary: 'Tunde Bakare Stores', amount: '₦420,000', status: 'Partial' },
      { primary: 'Golden Penny Semovita · Qty 40', secondary: 'Alhaji Musa Depot', amount: '₦340,000', status: 'Pending' },
      { primary: 'Indomie Super Pack · Qty 35', secondary: 'Iya Risi Provisions', amount: '₦497,000', status: 'Paid' },
    ],
  },
  {
    id: 'retail',
    label: 'Retail Shops',
    headline: 'Every daily counter sale, accounted for.',
    description:
      'Log cash, POS terminal, and bank transfer sales cleanly throughout the day, monitor daily diesel and shop expenses, and close each evening knowing your true net profit.',
    replaces: 'Counter tally books · Manual POS slips · Mental stock checks',
    bullets: [
      'Switch between Daily, Weekly, and Monthly dashboard views in one click',
      'Log POS, cash, and bank transfer receipts alongside shop expenses',
      'Receive low-stock alerts before fast-moving shelf items hit zero',
    ],
    previewTitle: 'Daily Shop Ledger',
    previewKpis: [
      { label: 'Today Revenue', value: '₦384,500' },
      { label: 'Daily Expenses', value: '₦62,000' },
      { label: 'Est. Net Profit', value: '₦322,500' },
    ],
    previewRows: [
      { primary: 'Peak Evaporated Milk (Carton)', secondary: 'Walk-in POS Sale', amount: '₦54,000', status: 'Paid' },
      { primary: 'Milo Refill Pack (800g) · Qty 12', secondary: 'Kemi Adeyemi', amount: '₦78,000', status: 'Paid' },
      { primary: 'Power Oil 3L · Qty 6', secondary: 'Chuka Eze', amount: '₦67,200', status: 'Partial' },
      { primary: 'Dangote Sugar (10kg) · Qty 4', secondary: 'Bola Kitchen', amount: '₦88,000', status: 'Paid' },
    ],
  },
  {
    id: 'provisions',
    label: 'Food & Provisions',
    headline: 'Protect thin margins on fast-moving staples.',
    description:
      'When supplier prices shift weekly, knowing your exact cost price, selling margin, and logistics spend keeps your provision store profitable without guesswork.',
    replaces: 'Price stickers · Scattered supplier receipts · Guesswork margins',
    bullets: [
      'Compare cost price vs. selling price margin across every SKU',
      'Log market transport, generator fuel, and restock costs cleanly',
      'Ask the AI Business Assistant which staples sold fastest this month',
    ],
    previewTitle: 'Provisions Catalogue',
    previewKpis: [
      { label: 'Retail Stock Value', value: '₦3,240,000' },
      { label: 'Active SKUs', value: '48' },
      { label: 'Low-Stock Alerts', value: '3 items' },
    ],
    previewRows: [
      { primary: 'Parboiled Rice (50kg)', secondary: '22 bags · Min 10', amount: '₦84,500', status: 'Paid' },
      { primary: 'Vegetable Oil (5L Keg)', secondary: '6 kegs · Min 12', amount: '₦17,500', status: 'Partial' },
      { primary: 'Semovita (5kg Pack)', secondary: '18 packs · Min 8', amount: '₦8,500', status: 'Paid' },
      { primary: 'Tomato Paste (Carton)', secondary: '0 left · Min 10', amount: '₦28,000', status: 'Pending' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion & Beauty',
    headline: 'Track deposits, deliveries, and bestsellers.',
    description:
      'Handle Instagram, WhatsApp, and walk-in orders with clean deposit tracking, customer phone history, and instant visibility into which collections actually convert.',
    replaces: 'DM screenshots · Unorganized deposit notes · Missed follow-ups',
    bullets: [
      'Record partial deposits and settle remaining balances in one click',
      'Keep every repeat buyer’s phone number and order history searchable',
      'Export clean monthly CSV reports for accounting or partner reviews',
    ],
    previewTitle: 'Customer Orders',
    previewKpis: [
      { label: 'Monthly Sales', value: '₦2,190,000' },
      { label: 'Pending Deposits', value: '₦245,000' },
      { label: 'Repeat Buyers', value: '34' },
    ],
    previewRows: [
      { primary: 'Linen Two-Piece Set · Qty 3', secondary: 'Zainab Bello', amount: '₦135,000', status: 'Paid' },
      { primary: 'Shea Glow Body Kit · Qty 8', secondary: 'Ngozi Studio', amount: '₦160,000', status: 'Partial' },
      { primary: 'Structured Tote Bag · Qty 2', secondary: 'Tolu Ogunleye', amount: '₦84,000', status: 'Paid' },
      { primary: 'Silk Scarf Bundle · Qty 5', secondary: 'Adaora Events', amount: '₦95,000', status: 'Pending' },
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware & Parts',
    headline: 'Keep every SKU, quote, and credit client tight.',
    description:
      'Manage hundreds of high-value parts, track contractor credit accounts without leakage, and restock critical items before jobs get delayed.',
    replaces: 'Carbon-copy receipt books · Outdated stock cards · Manual ledgers',
    bullets: [
      'Search SKUs, customer phone numbers, and order numbers instantly',
      'Monitor total inventory valuation in Naira across your warehouse',
      'Generate weekly and monthly profit summaries in seconds',
    ],
    previewTitle: 'Parts & Credit Ledger',
    previewKpis: [
      { label: 'Stock Valuation', value: '₦9,450,000' },
      { label: 'Receivables Due', value: '₦890,000' },
      { label: 'Est. Net Profit', value: '₦2,410,000' },
    ],
    previewRows: [
      { primary: '2.5mm Copper Cable Coil · Qty 6', secondary: 'Bamidele Electricals', amount: '₦468,000', status: 'Paid' },
      { primary: 'Solar Inverter Battery 200Ah', secondary: 'Kano Grid Works', amount: '₦310,000', status: 'Partial' },
      { primary: 'PVC Conduit Bundle · Qty 20', secondary: 'Olu Construction', amount: '₦185,000', status: 'Paid' },
      { primary: 'LED Floodlight 200W · Qty 10', secondary: 'Eko Site Services', amount: '₦240,000', status: 'Pending' },
    ],
  },
];

const FAQ_ITEMS = [
  {
    question: 'How do I get started with VendorPilot AI?',
    answer:
      'Click "Log in / Sign up", sign in with your Google (Gmail) account or create an email and password login, and fill out your quick business profile (business name, category, location, phone, and currency). Your live dashboard opens immediately.',
  },
  {
    question: 'Is VendorPilot AI free to use?',
    answer:
      'Yes. You can sign up and run your sales, expenses, inventory, CSV reports, and AI Business Assistant right away on our free-tier setup with zero billing surprises.',
  },
  {
    question: 'Which currencies are supported?',
    answer:
      'Nigerian Naira (NGN ₦) is configured by default for Nigerian SMEs, and you can switch to USD ($), GBP (£), EUR (€), GHS (₵), or KES (KSh) anytime in Business Settings.',
  },
  {
    question: 'Does the AI Business Assistant ever invent numbers?',
    answer:
      'Never. Every revenue figure, expense total, estimated net profit, top-selling product, and low-stock alert is computed directly from your actual Cloud Firestore records using deterministic application math. If you have no records yet for a timeframe, it tells you honestly.',
  },
  {
    question: 'Is my business data private and secure?',
    answer:
      'Yes. Every record is tied to your authenticated user ID and protected by strict per-user Cloud Firestore Security Rules. Other users cannot view, edit, or delete your records, and no private data is stored in browser localStorage.',
  },
  {
    question: 'Does inventory update automatically when I record a sale?',
    answer:
      'Yes. Recording a sale linked to a product atomically deducts the exact sold quantity from inventory. Editing or deleting a sale adjusts or restores stock by the exact net difference so you never suffer double deductions.',
  },
  {
    question: 'Can I export my dashboard data and business records?',
    answer:
      'Yes. Click "Download Report" on your Dashboard to export your currently filtered Daily, Weekly, Monthly, or All-Time performance as a spreadsheet-ready CSV file, or export a full JSON ledger backup anytime from Business Settings.',
  },
  {
    question: 'Does VendorPilot AI work on both phones and laptops?',
    answer:
      'Yes. Every page—from recording counter sales and checking low-stock alerts to asking the AI Business Assistant—is built to work smoothly on mobile phones, tablets, and desktop screens.',
  },
];

const FEATURE_CHECKLIST_COLUMNS = [
  [
    'Live Executive Dashboard',
    'Sales & Order Ledger',
    'Paid, Partial & Pending Tracking',
    'Automatic Stock Deduction',
    'Multi-Currency (NGN ₦ Default)',
    'Daily, Weekly & Monthly Filters',
  ],
  [
    'Operational Expense Tracking',
    'Low-Stock & Out-of-Stock Alerts',
    'Customer Directory & History',
    'AI Business Assistant',
    'One-Click CSV Performance Export',
    'JSON Full Ledger Backup',
  ],
  [
    'Google & Email/Password Auth',
    'Private Cloud Firestore Sync',
    'Strict Per-User Data Isolation',
    'Safe Edit & Delete Stock Restore',
    'Nigerian VAT Rate Reference',
    'Desktop & Mobile Responsive UI',
  ],
];

function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-editorial text-base font-semibold tracking-normal text-slate-900 dark:text-white">
        VendorPilot <span className="text-emerald-600 dark:text-emerald-400">AI</span>
      </span>
    </span>
  );
}

function PreviewLineChart({ points, labels }: { points: number[]; labels: string[] }) {
  const width = 520;
  const height = 180;
  const padX = 24;
  const padY = 18;
  const maxVal = Math.max(...points) * 1.12;
  const minVal = Math.min(...points) * 0.7;
  const span = Math.max(1, maxVal - minVal);

  const coords = points.map((val, idx) => {
    const x = padX + (idx / Math.max(1, points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((val - minVal) / span) * (height - padY * 2);
    return { x, y };
  });

  const linePath = coords.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(height - padY).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible sm:h-48" aria-hidden="true">
        <defs>
          <linearGradient id="vpLandingArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.2, 0.45, 0.7, 0.92].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={height * ratio}
            y2={height * ratio}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}
        <path d={areaPath} fill="url(#vpLandingArea)" />
        <path
          d={linePath}
          fill="none"
          className="stroke-slate-900 dark:stroke-emerald-400"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {coords.map((pt, idx) => (
          <circle
            key={labels[idx]}
            cx={pt.x}
            cy={pt.y}
            r="3.2"
            className={
              idx === coords.length - 1
                ? 'fill-emerald-600 stroke-white dark:fill-emerald-400 dark:stroke-slate-900'
                : 'fill-slate-900 stroke-white dark:fill-slate-100 dark:stroke-slate-900'
            }
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between px-4 font-mono text-[11px] text-slate-400">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export function LandingPage({ onOpenAuth }: LandingPageProps) {
  const [heroRange, setHeroRange] = useState<PreviewRange>('30d');
  const [activeSegmentId, setActiveSegmentId] = useState<BusinessSegmentId>('wholesalers');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(1);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const heroData = HERO_PREVIEW_DATA[heroRange];
  const activeSegment =
    BUSINESS_SEGMENTS.find((seg) => seg.id === activeSegmentId) ?? BUSINESS_SEGMENTS[0];

  const navLinks = [
    { href: '#getting-started', label: 'How it works' },
    { href: '#features', label: 'Features' },
    { href: '#built-for', label: "Who it's for" },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <VendorPilotMotionProvider>
      <div className="vp-dark-auto min-h-screen overflow-x-clip bg-white text-slate-900 dark:bg-[#090e17] dark:text-slate-100">
        {/* Full-screen VendorPilot AI emerald intro preloader that morphs into the Hero phone */}
        <VendorPilotIntroSplash />

        {/* Top Bar (Brand — Nav Links — Theme Toggle + Rolling Primary CTA) */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#090e17]/85">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6 lg:px-8">
            <a
              href="#top"
              className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <BrandLogo />
            </a>

            <nav
              aria-label="Landing navigation"
              onMouseLeave={() => setHoveredNav(null)}
              className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredNav(link.href)}
                  onFocus={() => setHoveredNav(link.href)}
                  onBlur={() => setHoveredNav(null)}
                  className="relative rounded-full px-3.5 py-2 transition-colors hover:text-slate-950 dark:hover:text-white whitespace-nowrap shrink-0"
                >
                  {hoveredNav === link.href && (
                    <m.span
                      layoutId="vp-nav-hover"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-full bg-emerald-50 dark:bg-slate-800/90"
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </a>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <ThemeToggleButton />
              <span className="hidden sm:inline-flex">
                <RollingCtaButton
                  size="sm"
                  label="Log in / Sign up"
                  hoverLabel="Open workspace"
                  onClick={() => onOpenAuth('signin')}
                />
              </span>
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500 sm:hidden whitespace-nowrap"
              >
                Log in / Sign up
              </button>
            </div>
          </div>
        </header>

        <main id="top">
          {/* =====================================================================
              SECTION 1: HERO (CITY-GRID + KINETIC HEADLINE + PHONE COCKPIT)
              FOLLOWED BY INTERACTIVE EXECUTIVE DASHBOARD SHOWCASE
          ===================================================================== */}
          <section className="relative isolate overflow-x-clip pb-20 sm:pb-28">
            <LandingHero
              heroRange={heroRange}
              onRangeChange={setHeroRange}
              onOpenAuth={onOpenAuth}
            />

            {/* Live Interactive Executive Dashboard Preview floating over the emerald/teal cloud design */}
            <div className="relative isolate mx-auto mt-6 max-w-6xl px-4 pt-4 sm:mt-10 sm:px-6 lg:px-8">
              {/* Full-bleed billowing emerald/teal atmospheric cloud design behind the dashboard preview */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-12 -top-12 bottom-0 -z-10 opacity-100 dark:opacity-45 sm:-inset-x-24"
              >
                <div className="absolute left-1/2 top-4 h-[28rem] w-[124%] max-w-[1380px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_68%_58%_at_50%_44%,rgba(16,185,129,0.52)_0%,rgba(45,212,191,0.42)_38%,rgba(167,243,208,0.34)_64%,rgba(255,255,255,0)_82%)] blur-[64px] sm:h-[36rem] sm:w-[92%]" />
                <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_48%_48%,rgba(16,185,129,0.82)_0%,rgba(52,211,153,0.62)_44%,rgba(153,246,228,0.34)_72%,rgba(255,255,255,0)_86%)] blur-[40px] sm:left-[4%] sm:top-4 sm:h-[26rem] sm:w-[29rem]" />
                <div className="absolute left-1/2 top-0 h-72 w-[23rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(5,150,105,0.92)_0%,rgba(16,185,129,0.72)_45%,rgba(52,211,153,0.38)_72%,rgba(255,255,255,0)_88%)] blur-[38px] sm:-top-4 sm:h-[28rem] sm:w-[36rem]" />
                <div className="absolute -right-16 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_52%_48%,rgba(13,148,136,0.76)_0%,rgba(20,184,166,0.58)_44%,rgba(110,231,183,0.36)_72%,rgba(255,255,255,0)_86%)] blur-[40px] sm:right-[4%] sm:top-2 sm:h-[27rem] sm:w-[30rem]" />
                <div className="absolute left-1/2 top-[16rem] h-[24rem] w-[114%] max-w-[1320px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_64%_52%_at_50%_44%,rgba(52,211,153,0.48)_0%,rgba(110,231,183,0.34)_48%,rgba(209,250,229,0.18)_72%,rgba(255,255,255,0)_90%)] blur-[64px] sm:top-[18rem] sm:h-[30rem] sm:w-[88%]" />
              </div>

              <div className="mb-3 flex items-center justify-between">
                <a
                  href="#getting-started"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-white/80 backdrop-blur-md transition-colors hover:bg-white hover:text-emerald-700"
                >
                  <span>How to get started</span>
                  <ChevronRight className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                </a>
              </div>

            {/* Interactive VendorPilot AI Workspace Mockup Frame */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/8">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Preview Sidebar */}
                <aside className="hidden border-r border-slate-100 bg-slate-50/70 p-4 lg:col-span-3 lg:flex lg:flex-col">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <BrandLogo />
                  </div>
                  <div className="mt-5 space-y-1 text-xs font-medium">
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                      <span className="flex items-center gap-2.5">
                        <LayoutDashboard className="h-3.5 w-3.5 text-emerald-600" />
                        Dashboard
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600">
                      <span className="flex items-center gap-2.5">
                        <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                        Sales &amp; Orders
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">5</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600">
                      <span className="flex items-center gap-2.5">
                        <Receipt className="h-3.5 w-3.5 text-slate-400" />
                        Expenses
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600">
                      <span className="flex items-center gap-2.5">
                        <Package className="h-3.5 w-3.5 text-slate-400" />
                        Inventory
                      </span>
                      <span className="font-mono text-[11px] text-amber-700 tabular-nums">4</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600">
                      <span className="flex items-center gap-2.5">
                        <Bot className="h-3.5 w-3.5 text-slate-400" />
                        AI Business Assistant
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600">
                      <span className="flex items-center gap-2.5">
                        <Settings className="h-3.5 w-3.5 text-slate-400" />
                        Business Settings
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto border-t border-slate-200/80 pt-3">
                    <div className="flex items-center gap-2.5 px-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 font-display text-[11px] font-semibold text-white">
                        AO
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">Adebayo Provisions</p>
                        <p className="truncate text-[11px] text-slate-500">Lagos · NGN (₦)</p>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* Preview Main Cockpit */}
                <div className="p-5 sm:p-6 lg:col-span-9">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Executive Dashboard Preview</p>
                      <p className="font-display text-sm font-semibold text-slate-900">
                        Adebayo Wholesale &amp; Provisions
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label="Preview dashboard range"
                      className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
                    >
                      {(
                        [
                          { id: '7d', label: '7 Days' },
                          { id: '30d', label: 'Monthly' },
                          { id: '6m', label: '6 Months' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setHeroRange(opt.id)}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                            heroRange === opt.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart + Side KPI Stack (mirrors Screenshot 2) */}
                  <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 md:col-span-8">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-slate-500">{heroData.revenueLabel}</p>
                          <div className="mt-1 flex items-baseline gap-2.5">
                            <span className="font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums sm:text-3xl">
                              {heroData.revenueValue}
                            </span>
                            <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                              {heroData.profitMargin} margin
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{heroData.deltaNote}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <PreviewLineChart points={heroData.points} labels={heroData.labels} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:col-span-4 md:grid-cols-1">
                      <div className="rounded-xl border border-slate-100 bg-white p-3.5">
                        <p className="text-[11px] font-medium text-slate-500">Outstanding Payments</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-amber-700 tabular-nums">
                          {heroData.outstandingValue}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{heroData.outstandingNote}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white p-3.5">
                        <p className="text-[11px] font-medium text-slate-500">Total Expenses</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                          {heroData.expensesValue}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Restock, fuel &amp; logistics</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white p-3.5">
                        <p className="text-[11px] font-medium text-slate-500">Estimated Net Profit</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-emerald-700 tabular-nums">
                          {heroData.profitValue}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Revenue minus expenses</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white p-3.5">
                        <p className="text-[11px] font-medium text-slate-500">Low-Stock Alerts</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                          {heroData.lowStockCount}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Below reorder level</p>
                      </div>
                    </div>
                  </div>

                  {/* Open Orders Preview Table */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-900">Recent Customer Orders</p>
                      <span className="text-[11px] text-slate-400">Sample preview · Your data stays private</span>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] text-slate-400">
                            <th className="pb-2 font-medium">Order</th>
                            <th className="pb-2 font-medium">Customer</th>
                            <th className="pb-2 font-medium">Product</th>
                            <th className="pb-2 text-right font-medium">Amount</th>
                            <th className="pb-2 text-right font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          <tr>
                            <td className="py-2.5 font-mono text-slate-500 tabular-nums">VP-1048</td>
                            <td className="py-2.5 font-medium text-slate-900">Amaka Distributors</td>
                            <td className="py-2.5 text-slate-600">Mama Gold Rice (50kg) · 5</td>
                            <td className="py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                              ₦422,500
                            </td>
                            <td className="py-2.5 text-right font-medium text-emerald-700">Paid</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-mono text-slate-500 tabular-nums">VP-1047</td>
                            <td className="py-2.5 font-medium text-slate-900">Tunde Bakare Stores</td>
                            <td className="py-2.5 text-slate-600">Devon King&apos;s Oil (5L) · 8</td>
                            <td className="py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                              ₦140,000
                            </td>
                            <td className="py-2.5 text-right font-medium text-amber-700">Partial</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 2: GETTING STARTED (3-STEP VISUAL CARDS — Screenshot 4 Top)
        ===================================================================== */}
        <section id="getting-started" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-hand text-base tracking-wide text-emerald-700">Getting started</p>
              <h2 className="mt-1.5 font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-950 text-balance sm:text-5xl">
                Your first win is
                <br />
                five minutes away.
              </h2>
              <p className="mt-4 font-hand text-lg leading-relaxed text-slate-600 sm:text-xl">
                VendorPilot AI is built to get your business up and running fast. No complex
                accounting setup, no spreadsheet formulas to maintain.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="relative flex h-56 items-center justify-center bg-gradient-to-b from-emerald-50 via-teal-50/50 to-white px-6 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-slate-900">
                  <div className="w-full max-w-[230px] rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Business Profile</span>
                      <span className="font-mono font-semibold text-emerald-700">NGN (₦)</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800">
                        Adebayo Provisions Ltd
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                        <span>Private Cloud Ready</span>
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-6 pt-2 pb-7 text-center">
                  <h3 className="font-editorial text-xl font-bold text-slate-950">
                    Set up your business profile
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    Sign in with Google or email, enter your business name, location, and default
                    Naira currency. Your isolated Firestore workspace is ready immediately.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="relative flex h-56 items-center justify-center bg-gradient-to-b from-emerald-50 via-teal-50/50 to-white px-6 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-slate-900">
                  <div className="relative w-full max-w-[230px] rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <span className="absolute -top-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 font-mono text-[11px] font-semibold text-white shadow-md shadow-emerald-600/25">
                      1 min
                    </span>
                    <p className="text-[11px] text-slate-400">Order VP-1001</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      ₦422,500
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-emerald-700">
                      Stock auto-deducted · Paid
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                      <div className="h-full w-4/5 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-6 pt-2 pb-7 text-center">
                  <h3 className="font-editorial text-xl font-bold text-slate-950">
                    Record your first sale &amp; stock
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    Add products with selling prices and low-stock thresholds, then log cash,
                    transfer, or partial-payment orders in seconds.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="relative flex h-56 items-center justify-center bg-gradient-to-b from-emerald-50 via-teal-50/50 to-white px-6 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-slate-900">
                  <div className="w-full max-w-[240px] rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        ₦4.85M
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-700">
                        +34% margin
                      </span>
                    </div>
                    <svg viewBox="0 0 180 54" className="mt-2 h-12 w-full" aria-hidden="true">
                      <path
                        d="M 4 46 L 44 34 L 84 38 L 128 20 L 174 8"
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-white">
                      <span className="text-[10px] text-slate-300">Receivables Due</span>
                      <span className="font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                        ₦612,000
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 px-6 pt-2 pb-7 text-center">
                  <h3 className="font-editorial text-xl font-bold text-slate-950">
                    See your dashboard come alive
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    Every sale, expense, and restock immediately shapes your revenue chart, profit
                    margin, CSV reports, and AI Business Assistant answers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 3: PLATFORM DIVIDER BANNER (Screenshot 4 Bottom)
        ===================================================================== */}
        <section className="relative isolate overflow-hidden py-16 sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-emerald-50/90 via-teal-50/40 to-transparent dark:from-emerald-950/45 dark:via-teal-950/20 dark:to-transparent"
          />
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p className="font-hand text-base tracking-wide text-emerald-700">
              The Operations Platform
            </p>
            <h2 className="mt-1.5 font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-950 text-balance sm:text-5xl">
              From sale to profit.
              <br />
              All in one place.
            </h2>
            <p className="mt-4 font-hand text-lg leading-relaxed text-slate-600 sm:text-xl">
              Stay on top of customer orders, daily expenses, stock alerts, and cash flow—without
              the spreadsheet mess.
            </p>
            <div className="mt-7">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-7 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 whitespace-nowrap"
              >
                <span>Log in / Sign up</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 4: 3 FEATURE DEEP-DIVES (Screenshots 5 & 6)
        ===================================================================== */}
        <section id="features" className="scroll-mt-20 space-y-24 py-16 sm:space-y-32 sm:py-24">
          {/* Spotlight 1: Sales & Receivables */}
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h3 className="font-editorial text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Track Every Sale.
                  <span className="block text-slate-500">Never Miss an Unpaid Balance.</span>
                </h3>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                  Record cash, POS, bank transfer, and partial-payment orders in seconds. Know
                  exactly who paid in full, who owes a balance, and settle orders in one click.
                </p>
              </div>
            </div>

            <div className="relative mt-10 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-8">
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Background Ledger Card */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 lg:col-span-7">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-xs font-semibold text-slate-900">Sales &amp; Orders Ledger</p>
                    <span className="font-mono text-xs text-emerald-700 tabular-nums">
                      ₦1,984,500 collected
                    </span>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100 text-xs">
                    {[
                      { id: 'VP-1052', customer: 'Amaka Nwosu Stores', item: 'Parboiled Rice (50kg) × 6', total: '₦507,000', status: 'Paid' },
                      { id: 'VP-1051', customer: 'Tunde Bakare Depot', item: "Devon King's Oil (5L) × 10", total: '₦175,000', status: 'Partial' },
                      { id: 'VP-1050', customer: 'Funke Bakery Ltd', item: 'Golden Penny Flour × 12', total: '₦432,000', status: 'Pending' },
                      { id: 'VP-1049', customer: 'Chinedu Provisions', item: 'Indomie Super Pack × 20', total: '₦284,000', status: 'Paid' },
                    ].map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            <span className="mr-2 font-mono text-slate-400">{row.id}</span>
                            {row.customer}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.item}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono font-semibold text-slate-900 tabular-nums">
                            {row.total}
                          </p>
                          <p
                            className={`text-[11px] font-medium ${
                              row.status === 'Paid'
                                ? 'text-emerald-700'
                                : row.status === 'Partial'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {row.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overlapping Record New Sale Form Preview */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 lg:col-span-5">
                  <p className="font-display text-sm font-semibold text-slate-900">Record New Sale</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Auto-calculates totals and deducts linked inventory.
                  </p>
                  <div className="mt-4 space-y-3 text-xs">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">Product</p>
                      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 font-medium text-slate-900">
                        Mama Gold Parboiled Rice (50kg)
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">Quantity</p>
                        <div className="mt-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 tabular-nums">
                          5
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-slate-500">Unit Price</p>
                        <div className="mt-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900 tabular-nums">
                          ₦84,500
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">Payment Status</p>
                      <div className="mt-1 grid grid-cols-3 gap-1.5">
                        <span className="rounded-md bg-emerald-50 py-1.5 text-center font-semibold text-emerald-800 ring-1 ring-emerald-200">
                          Paid
                        </span>
                        <span className="rounded-md bg-slate-50 py-1.5 text-center text-slate-600">
                          Partial
                        </span>
                        <span className="rounded-md bg-slate-50 py-1.5 text-center text-slate-600">
                          Pending
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3.5 py-2.5 text-white">
                      <span className="text-slate-300">Order Total</span>
                      <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                        ₦422,500
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spotlight 2: Inventory & Automatic Stock Deduction */}
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h3 className="font-editorial text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Control Your Inventory.
                  <span className="block text-slate-500">Restock Before You Run Out.</span>
                </h3>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                  Set selling prices, cost margins, and low-stock thresholds for every product.
                  Sales deduct inventory atomically—and edits or deletes reconcile stock cleanly.
                </p>
              </div>
            </div>

            <div className="relative mt-10 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-8">
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 lg:col-span-7">
                  <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-[11px] text-slate-500">Retail Stock Value</p>
                      <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums sm:text-lg">
                        ₦4,620,000
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Low-Stock Alerts</p>
                      <p className="mt-1 font-mono text-base font-semibold text-amber-700 tabular-nums sm:text-lg">
                        3 SKUs
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Out of Stock</p>
                      <p className="mt-1 font-mono text-base font-semibold text-rose-700 tabular-nums sm:text-lg">
                        1 SKU
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100 text-xs">
                    {[
                      { sku: 'MG-RIC-50K', name: 'Mama Gold Parboiled Rice (50kg)', stock: '22 bags', price: '₦84,500', state: 'In Stock' },
                      { sku: 'KG-OIL-05L', name: "Devon King's Vegetable Oil (5L)", stock: '4 kegs', price: '₦17,500', state: 'Low Stock' },
                      { sku: 'PW-OIL-03L', name: 'Power Oil Bottle (3L)', stock: '0 left', price: '₦11,200', state: 'Out of Stock' },
                    ].map((prod) => (
                      <div key={prod.sku} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{prod.name}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                            {prod.sku} · {prod.stock}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono font-semibold text-slate-900 tabular-nums">
                            {prod.price}
                          </p>
                          <p
                            className={`text-[11px] font-medium ${
                              prod.state === 'In Stock'
                                ? 'text-emerald-700'
                                : prod.state === 'Low Stock'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {prod.state}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Foreground Restock Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 lg:col-span-5">
                  <p className="font-display text-sm font-semibold text-slate-900">
                    Quick Restock Item
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Devon King&apos;s Vegetable Oil (5L) · KG-OIL-05L
                  </p>
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between rounded-lg bg-amber-50/70 px-3.5 py-2.5 text-amber-900">
                      <span>Current Stock</span>
                      <span className="font-mono font-semibold tabular-nums">4 Kegs (Min 12)</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5">
                      <span className="text-slate-600">Quantity Received</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        +20 Kegs
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3.5 py-2.5 text-emerald-900">
                      <span>Updated Stock Balance</span>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                        24 Kegs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spotlight 3: Expenses & AI Business Assistant */}
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h3 className="font-editorial text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Track Expenses.
                  <span className="block text-slate-500">Ask Your AI Business Assistant.</span>
                </h3>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                  Categorize restocks, diesel, rent, logistics, and payroll—then ask your AI
                  Business Assistant for instant weekly summaries, profit margins, and restock
                  priorities backed strictly by your real Firestore records.
                </p>
              </div>
            </div>

            <div className="relative mt-10 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-8">
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Expense Category Breakdown */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 lg:col-span-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-xs font-semibold text-slate-900">Expenses by Category</p>
                    <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      ₦1,245,000 total
                    </span>
                  </div>
                  <div className="mt-4 space-y-3.5 text-xs">
                    {[
                      { cat: 'Inventory Restock', amount: '₦820,000', pct: 66 },
                      { cat: 'Power & Generator Fuel', amount: '₦195,000', pct: 16 },
                      { cat: 'Delivery & Logistics', amount: '₦130,000', pct: 10 },
                      { cat: 'Staff Payroll & Rent', amount: '₦100,000', pct: 8 },
                    ].map((item) => (
                      <div key={item.cat}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">{item.cat}</span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {item.amount} · {item.pct}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Foreground AI Business Assistant Conversation Preview */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 lg:col-span-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-emerald-400">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">AI Business Assistant</p>
                      <p className="text-[11px] text-slate-500">Grounded in your Cloud Firestore records</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="ml-auto max-w-[85%] rounded-xl bg-slate-900 px-3.5 py-2.5 text-white">
                      What is my estimated net profit this month, and what needs restocking?
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 leading-relaxed text-slate-700">
                      <p className="font-semibold text-slate-900">
                        Estimated Net Profit: <span className="font-mono text-emerald-700">₦1,670,000</span> (34.4% margin)
                      </p>
                      <p className="mt-1.5">
                        Recorded monthly revenue is <span className="font-mono font-medium">₦4,850,000</span> minus{' '}
                        <span className="font-mono font-medium">₦3,180,000</span> in expenses.
                      </p>
                      <p className="mt-1.5">
                        <strong className="text-slate-900">Priority Restocks:</strong> Power Oil 3L (0 left) and Devon
                        King&apos;s Oil 5L (4 left, threshold 12).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 5: CUSTOMER LEDGER INCLUDED (Screenshot 6 Bottom)
        ===================================================================== */}
        <section className="relative isolate overflow-hidden py-20 sm:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-12 bottom-0 -z-10 bg-gradient-to-b from-emerald-50/75 via-teal-50/45 to-white dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-[#090e17]"
          />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="inline-flex items-center gap-1.5 font-hand text-base tracking-wide text-emerald-700">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Customers &amp; Receivables</span>
              </p>
              <h2 className="mt-1.5 font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-950 text-balance sm:text-5xl">
                Your Customer Ledger, Included.
              </h2>
              <p className="mt-4 font-hand text-lg leading-relaxed text-slate-600 sm:text-xl">
                Every sale automatically builds your customer directory—showing repeat buyers,
                contact phone numbers, total spend, and unpaid balances without paying for a
                separate CRM.
              </p>
            </div>

            <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 border-b border-slate-100 pb-5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-xs text-slate-500">Average Order Value</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    ₦148,500
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-xs text-slate-500">Payment Collection Rate</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      87.4%
                    </span>
                    <span className="text-xs font-medium text-emerald-700">Healthy</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-xs text-slate-500">Active Customers</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    38
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] text-slate-400">
                      <th className="pb-2.5 font-medium">Customer</th>
                      <th className="pb-2.5 font-medium">Phone</th>
                      <th className="pb-2.5 text-right font-medium">Orders</th>
                      <th className="pb-2.5 text-right font-medium">Total Spend</th>
                      <th className="pb-2.5 text-right font-medium">Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { name: 'Amaka Nwosu Distributors', phone: '0803 441 9082', orders: 14, spend: '₦2,145,000', standing: 'Settled' },
                      { name: 'Tunde Bakare Stores', phone: '0809 218 5531', orders: 9, spend: '₦1,180,000', standing: '₦60,000 due' },
                      { name: 'Funke Adesanya Bakery', phone: '0812 908 3314', orders: 7, spend: '₦894,000', standing: 'Settled' },
                    ].map((cust) => (
                      <tr key={cust.name}>
                        <td className="py-3 font-medium text-slate-900">{cust.name}</td>
                        <td className="py-3 font-mono text-slate-500 tabular-nums">{cust.phone}</td>
                        <td className="py-3 text-right font-mono text-slate-700 tabular-nums">
                          {cust.orders}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {cust.spend}
                        </td>
                        <td
                          className={`py-3 text-right font-medium ${
                            cust.standing === 'Settled' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {cust.standing}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 6: BETTER INSIGHTS. FEWER TOOLS. (INTERACTIVE TABS — Screenshot 7)
        ===================================================================== */}
        <section id="built-for" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-hand text-base tracking-wide text-emerald-700">Who it&apos;s for</p>
              <h2 className="mt-1.5 font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-950 text-balance sm:text-5xl">
                Better Insights.
                <br />
                Fewer Tools.
              </h2>
              <p className="mt-4 font-hand text-lg leading-relaxed text-slate-600 sm:text-xl">
                When your sales, stock, and expenses are connected, you finally see what&apos;s
                working and what&apos;s draining cash.
              </p>
            </div>

            {/* Interactive Business Segment Filter Bar */}
            <div
              role="tablist"
              aria-label="Business categories"
              className="mt-8 flex flex-wrap items-center justify-center gap-2"
            >
              {BUSINESS_SEGMENTS.map((seg) => {
                const isActive = seg.id === activeSegment.id;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveSegmentId(seg.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? 'border border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>

            {/* Split Segment Showcase Card */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
                <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-6">
                  <div>
                    <h3 className="font-editorial text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                      {activeSegment.headline}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                      {activeSegment.description}
                    </p>
                  </div>

                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <p className="text-xs font-semibold text-slate-900">
                      Replaces:{' '}
                      <span className="font-normal text-slate-500">{activeSegment.replaces}</span>
                    </p>
                    <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                      {activeSegment.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                          </span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Tailored Preview Panel */}
                <div className="border-t border-slate-100 bg-slate-50/70 p-6 sm:p-8 lg:col-span-6 lg:border-t-0 lg:border-l">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                    <p className="text-xs font-semibold text-slate-900">
                      {activeSegment.previewTitle}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2.5">
                      {activeSegment.previewKpis.map((kpi) => (
                        <div
                          key={kpi.label}
                          className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
                        >
                          <p className="truncate text-[10px] text-slate-500">{kpi.label}</p>
                          <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-900 tabular-nums sm:text-sm">
                            {kpi.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 divide-y divide-slate-100 text-xs">
                      {activeSegment.previewRows.map((row) => (
                        <div key={row.primary} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{row.primary}</p>
                            <p className="truncate text-[11px] text-slate-500">{row.secondary}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono font-semibold text-slate-900 tabular-nums">
                              {row.amount}
                            </p>
                            <p
                              className={`text-[10px] font-medium ${
                                row.status === 'Paid'
                                  ? 'text-emerald-700'
                                  : row.status === 'Partial'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                              }`}
                            >
                              {row.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 7: FAQ ACCORDION ("Totally fair to ask." — Screenshot 8 Top)
        ===================================================================== */}
        <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <p className="font-hand text-base tracking-wide text-emerald-700">FAQs</p>
              <h2 className="mt-1.5 font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-950 text-balance sm:text-5xl">
                Totally fair to ask.
              </h2>
              <p className="mt-3 font-hand text-lg text-slate-600 sm:text-xl">
                Answers to common questions about VendorPilot AI:
              </p>
            </div>

            <div className="mt-10 divide-y divide-slate-200/80 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={item.question}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/70 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:px-6"
                    >
                      <span className="text-sm font-semibold text-slate-900">{item.question}</span>
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"
                      >
                        {isOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm leading-relaxed text-slate-600 sm:px-6">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================================
            SECTION 8: CLOSING CTA & FEATURE CHECKLIST (Screenshots 7 & 8 Bottom)
        ===================================================================== */}
        <section className="relative isolate overflow-hidden py-20 sm:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white via-emerald-50/75 to-emerald-100/70 dark:from-[#090e17] dark:via-emerald-950/35 dark:to-emerald-950/65"
          />
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-5">
                <BrandLogo />
              </div>
              <h2 className="font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-950 text-balance sm:text-5xl">
                Protect Your Margins.
                <br />
                Cut The Chaos.
              </h2>
              <p className="mt-4 font-hand text-lg leading-relaxed text-slate-600 sm:text-xl">
                VendorPilot AI keeps your sales, expenses, inventory, and AI financial insights
                running smoothly from one secure account.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
              {FEATURE_CHECKLIST_COLUMNS.map((col, colIdx) => (
                <ul key={colIdx} className="space-y-3 text-sm text-slate-700">
                  {col.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-3 w-3" strokeWidth={2.8} aria-hidden="true" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-8 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 whitespace-nowrap"
              >
                <span>Log in / Sign up</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                Existing account? Sign in
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#090e17]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <BrandLogo />
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a href="#getting-started" className="hover:text-slate-900">
              How it works
            </a>
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#built-for" className="hover:text-slate-900">
              Who it&apos;s for
            </a>
            <a href="#faq" className="hover:text-slate-900">
              FAQ
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              className="font-medium text-emerald-700 hover:text-emerald-800"
            >
              Log in / Sign up
            </button>
          </div>
          <p>&copy; {new Date().getFullYear()} VendorPilot AI</p>
        </div>
      </footer>
    </div>
    </VendorPilotMotionProvider>
  );
}
