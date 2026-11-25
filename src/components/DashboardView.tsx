import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Download,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { DashboardPeriod, NavSection, Product, SalesRange } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import {
  buildSalesPerformanceSeries,
  calculateDashboardMetrics,
  filterRecordsByPeriod,
  formatNaira,
  formatShortDate,
  getOutstandingBalance,
  getStockStatus,
  getTopSellingProducts,
} from '../utils/analytics';
import {
  buildDashboardReportCsv,
  buildDashboardReportFilename,
  triggerCsvDownload,
} from '../utils/reportCsv';
import {
  extractFirstName,
  formatDisplayName,
  getUserAvatarSeed,
  getUserAvatarUrl,
  getUserInitials,
} from '../utils/avatars';
import { VendorAvatar } from './VendorAvatar';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onQuickRestock: (product: Product) => void;
}

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'all', label: 'All Time' },
];

const RANGE_OPTIONS: Array<{ value: SalesRange; label: string }> = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '6m', label: '6 Months' },
];

export function DashboardView({ onNavigate, onQuickRestock }: DashboardViewProps) {
  const { user, state, lowStockProducts } = useBusiness();
  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [range, setRange] = useState<SalesRange>('30d');
  const [downloaded, setDownloaded] = useState(false);
  const downloadTimerRef = useRef<number | null>(null);
  const symbol = state.settings.currencySymbol || '₦';

  const ownerRawName = state.settings.ownerName || user?.displayName || '';
  const ownerEmail = state.settings.email || user?.email || '';
  const firstName = extractFirstName(ownerRawName, ownerEmail);
  const fullName = formatDisplayName(ownerRawName, ownerEmail);
  const initials = getUserInitials(ownerRawName, ownerEmail);
  const avatarSeed = getUserAvatarSeed(ownerRawName, ownerEmail, user?.uid);
  const avatarUrl = getUserAvatarUrl(ownerRawName, ownerEmail, user?.uid);
  const isFreshWorkspace =
    state.sales.length === 0 && state.expenses.length === 0 && state.products.length === 0;

  useEffect(() => {
    return () => {
      if (downloadTimerRef.current !== null) {
        window.clearTimeout(downloadTimerRef.current);
      }
    };
  }, []);

  const handlePeriodChange = (nextPeriod: DashboardPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === 'daily' || nextPeriod === 'weekly') {
      setRange('7d');
    } else if (nextPeriod === 'monthly') {
      setRange('30d');
    } else {
      setRange('6m');
    }
  };

  const periodData = useMemo(
    () => filterRecordsByPeriod(state.sales, state.expenses, period),
    [state.sales, state.expenses, period]
  );

  const periodMetrics = useMemo(
    () => calculateDashboardMetrics(periodData.sales, periodData.expenses, state.products),
    [periodData.sales, periodData.expenses, state.products]
  );

  const periodTopProducts = useMemo(
    () => getTopSellingProducts(periodData.sales, 5),
    [periodData.sales]
  );

  const chartData = useMemo(
    () => buildSalesPerformanceSeries(state.sales, state.expenses, range),
    [state.sales, state.expenses, range]
  );

  const recentSales = useMemo(() => periodData.sales.slice(0, 6), [periodData.sales]);

  const handleDownloadReport = () => {
    const now = new Date();
    const csv = buildDashboardReportCsv({
      settings: state.settings,
      period,
      periodLabel: periodData.periodLabel,
      chartRange: range,
      metrics: periodMetrics,
      chartData,
      topProducts: periodTopProducts,
      sales: periodData.sales,
      expenses: periodData.expenses,
      lowStockProducts,
      generatedAt: now,
    });
    const filename = buildDashboardReportFilename(state.settings.businessName, period, now);
    triggerCsvDownload(csv, filename);

    setDownloaded(true);
    if (downloadTimerRef.current !== null) {
      window.clearTimeout(downloadTimerRef.current);
    }
    downloadTimerRef.current = window.setTimeout(() => {
      setDownloaded(false);
      downloadTimerRef.current = null;
    }, 2500);
  };

  const kpis = [
    {
      label: 'Total Revenue',
      value: formatNaira(periodMetrics.totalRevenue, false, symbol),
      detail: `${periodMetrics.totalOrders} order${periodMetrics.totalOrders === 1 ? '' : 's'} · ${formatNaira(periodMetrics.collectedRevenue, true, symbol)} collected`,
      emphasis: 'text-slate-900 dark:text-white',
      icon: Wallet,
      iconTone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
    {
      label: 'Total Expenses',
      value: formatNaira(periodMetrics.totalExpenses, false, symbol),
      detail: `${periodData.expenses.length} operational entr${periodData.expenses.length === 1 ? 'y' : 'ies'} logged`,
      emphasis: 'text-slate-900 dark:text-white',
      icon: Receipt,
      iconTone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      label: 'Estimated Net Profit',
      value: formatNaira(periodMetrics.netProfit, false, symbol),
      detail: `${periodMetrics.profitMarginPct}% estimated margin`,
      emphasis:
        periodMetrics.netProfit >= 0
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-rose-700 dark:text-rose-400',
      icon: TrendingUp,
      iconTone:
        periodMetrics.netProfit >= 0
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400',
    },
    {
      label: 'Outstanding Payments',
      value: formatNaira(periodMetrics.outstandingPayments, false, symbol),
      detail:
        periodMetrics.unpaidOrderCount === 0
          ? 'All orders in period settled'
          : `${periodMetrics.unpaidOrderCount} order${periodMetrics.unpaidOrderCount > 1 ? 's' : ''} awaiting balance`,
      emphasis:
        periodMetrics.outstandingPayments > 0
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-slate-900 dark:text-white',
      icon: Clock,
      iconTone:
        periodMetrics.outstandingPayments > 0
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      label: 'Total Products',
      value: String(periodMetrics.totalProducts),
      detail: `Stock value ${formatNaira(periodMetrics.inventoryValuation, true, symbol)}`,
      emphasis: 'text-slate-900 dark:text-white',
      icon: Package,
      iconTone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      label: 'Low-Stock Products',
      value: String(periodMetrics.lowStockCount),
      detail:
        periodMetrics.outOfStockCount > 0
          ? `${periodMetrics.outOfStockCount} out of stock right now`
          : periodMetrics.lowStockCount > 0
            ? 'At or below reorder threshold'
            : 'All inventory levels healthy',
      emphasis:
        periodMetrics.lowStockCount > 0
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-emerald-700 dark:text-emerald-400',
      icon: AlertTriangle,
      iconTone:
        periodMetrics.lowStockCount > 0
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Personalized Welcome Banner + Period & Report Controls */}
      <section
        aria-label="Business owner welcome"
        className="relative overflow-hidden rounded-2xl border border-emerald-200/75 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/55 p-5 sm:p-6 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.22),transparent_70%)] blur-2xl"
        />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <VendorAvatar
              seed={avatarSeed}
              src={avatarUrl}
              alt={`${fullName} (${initials})`}
              initials={initials}
              size={58}
              showInitialsBadge
              badgeSize="md"
              className="h-14 w-14 rounded-2xl ring-2 ring-white shadow-sm dark:ring-slate-800"
            />
            <div className="min-w-0">
              <h2 className="font-editorial text-2xl leading-tight font-bold tracking-normal text-slate-950 dark:text-white sm:text-[1.7rem]">
                Hi {firstName}!
              </h2>
              <p className="mt-1 font-hand text-lg leading-snug text-slate-700 dark:text-slate-300">
                {isFreshWorkspace
                  ? `Welcome to ${state.settings.businessName || 'your business'} — your private ledger is ready.`
                  : `Welcome back to ${state.settings.businessName || 'your business'}. Here is your live snapshot.`}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  {fullName} ({initials})
                </strong>
                {state.settings.businessType && (
                  <>
                    <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                    <span>{state.settings.businessType}</span>
                  </>
                )}
                <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                <span>Showing {periodData.periodLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-950/70"
              role="group"
              aria-label="Dashboard performance period"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePeriodChange(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    period === opt.value
                      ? 'bg-slate-900 text-white shadow-2xs dark:bg-emerald-600 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadReport}
              title={`Export ${periodData.periodLabel} performance data as CSV`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-700 whitespace-nowrap"
            >
              {downloaded ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              )}
              <span>{downloaded ? 'Report Downloaded' : 'Download Report'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600/10 px-3.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 whitespace-nowrap"
            >
              <span>Ask AI Assistant</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* First-Time Guided Quick-Start Strip (visible only when workspace has 0 records) */}
      {isFreshWorkspace && (
        <section
          aria-label="Getting started quick actions"
          className="grid grid-cols-1 gap-3.5 md:grid-cols-3"
        >
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/35 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Package className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                1. Add your first product
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Set unit cost, selling price, and low-stock alert levels for {state.settings.businessName}.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/35 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <ShoppingBag className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                2. Log your first sale
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Record paid, partial, or pending orders and watch stock auto-deduct cleanly.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="group flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/35 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Bot className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                3. Chat with your AI Assistant
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Ask how to track margins, cashflow, or generate summaries anytime, {firstName}.
              </span>
            </span>
          </button>
        </section>
      )}

      {/* 6-Card KPI Grid (Revenue, Expenses, Estimated Net Profit, Outstanding, Total Products, Low-Stock) */}
      <section aria-label="Key business metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const KpiIcon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 transition-colors hover:border-emerald-200/90 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kpi.iconTone}`}
                >
                  <KpiIcon className="h-4 w-4" />
                </span>
              </div>
              <p className={`mt-2.5 font-mono text-2xl font-semibold tracking-tight tabular-nums ${kpi.emphasis}`}>
                {kpi.value}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{kpi.detail}</p>
            </div>
          );
        })}
      </section>

      {/* Main Chart + Low-Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sales Performance Chart */}
        <section
          aria-label="Sales performance chart"
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sales Performance</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Revenue compared against operating expenses in {state.settings.currencyCode} ({symbol})
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Chart date range">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    range === opt.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" aria-hidden="true" />
              Revenue
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-slate-400" aria-hidden="true" />
              Expenses
            </span>
          </div>

          <div className="mt-4 h-72 w-full" data-testid="sales-performance-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="vpRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="vpExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatNaira(v, true, symbol)}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatNaira(Number(value ?? 0), false, symbol),
                    name === 'revenue' ? 'Revenue' : 'Expenses',
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#059669"
                  strokeWidth={2.2}
                  fill="url(#vpRevenueGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#64748b"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  fill="url(#vpExpenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Low-Stock Alerts */}
        <section
          aria-label="Low-stock alerts"
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Low-Stock Alerts</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {lowStockProducts.length} item{lowStockProducts.length === 1 ? '' : 's'} at or below reorder threshold
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Manage all
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-slate-900">Inventory levels are healthy</p>
              <p className="mt-1 text-xs text-slate-500">
                All products are currently above their reorder threshold.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {lowStockProducts.slice(0, 5).map((item) => {
                const status = getStockStatus(item);
                const isOut = status === 'Out of Stock';
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className={isOut ? 'font-medium text-rose-700' : 'font-medium text-amber-700'}>
                          {isOut ? 'Out of stock' : `${item.stock} left`}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-500">
                          Reorder at {item.reorderLevel}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickRestock(item)}
                      aria-label={`Restock ${item.name}`}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 whitespace-nowrap"
                    >
                      Restock
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {lowStockProducts.length > 0 && (
            <div className="mt-auto border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>Restocking fast-moving items prevents missed wholesale orders.</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Bottom Split: Recent Transactions + Top-Selling Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Transactions */}
        <section
          aria-label="Recent transactions"
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Transactions</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Recorded customer sales for {periodData.periodLabel.toLowerCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              View all sales
            </button>
          </div>

          {recentSales.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No sales in this period</p>
              <p className="mt-1 text-xs text-slate-500">
                Record a customer order or switch to All Time to view older transactions.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Go to Sales & Orders
              </button>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="pb-3 pr-3 font-medium">Order / Date</th>
                    <th className="pb-3 px-3 font-medium">Customer & Item</th>
                    <th className="pb-3 px-3 font-medium">Status</th>
                    <th className="pb-3 pl-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map((sale) => {
                    const balance = getOutstandingBalance(sale);
                    return (
                      <tr key={sale.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="py-3 pr-3 align-top">
                          <p className="font-mono text-xs font-medium text-slate-900 tabular-nums">
                            {sale.orderNumber}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatShortDate(sale.date)}</p>
                        </td>
                        <td className="py-3 px-3 align-top">
                          <p className="font-medium text-slate-900">{sale.customerName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {sale.productName} · Qty {sale.quantity}
                          </p>
                        </td>
                        <td className="py-3 px-3 align-top">
                          <span
                            className={`text-xs font-medium ${
                              sale.paymentStatus === 'Paid'
                                ? 'text-emerald-700'
                                : sale.paymentStatus === 'Partial'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {sale.paymentStatus}
                          </span>
                          {balance > 0 && (
                            <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                              Due {formatNaira(balance, false, symbol)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right align-top font-mono text-sm font-medium text-slate-900 tabular-nums">
                          {formatNaira(sale.totalAmount, false, symbol)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top-Selling Products */}
        <section
          aria-label="Top-selling products"
          className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Top-Selling Products</h2>
              <p className="mt-0.5 text-sm text-slate-500">Ranked by sales revenue in period</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Inventory
            </button>
          </div>

          {periodTopProducts.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No product rankings yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Your highest-performing products will appear here as orders are logged.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {periodTopProducts.map((item, idx) => (
                <div key={item.productName}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-900">
                      <span className="mr-2 font-mono text-xs text-slate-400">0{idx + 1}.</span>
                      {item.productName}
                    </p>
                    <span className="shrink-0 font-mono text-sm font-medium text-slate-900 tabular-nums">
                      {formatNaira(item.revenue, false, symbol)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${Math.max(6, Math.min(100, item.sharePct * 2.2))}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-xs text-slate-500 tabular-nums">
                      {item.unitsSold} sold · {item.sharePct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
