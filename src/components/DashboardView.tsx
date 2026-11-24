import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { NavSection, Product, SalesRange } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import {
  buildSalesPerformanceSeries,
  formatNaira,
  formatShortDate,
  getOutstandingBalance,
  getStockStatus,
} from '../utils/analytics';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onQuickRestock: (product: Product) => void;
}

const RANGE_OPTIONS: Array<{ value: SalesRange; label: string }> = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '6m', label: '6 Months' },
];

export function DashboardView({ onNavigate, onQuickRestock }: DashboardViewProps) {
  const { state, metrics, lowStockProducts, topSellingProducts } = useBusiness();
  const [range, setRange] = useState<SalesRange>('6m');

  const chartData = useMemo(
    () => buildSalesPerformanceSeries(state.sales, state.expenses, range),
    [state.sales, state.expenses, range]
  );

  const recentSales = useMemo(() => state.sales.slice(0, 6), [state.sales]);

  const kpis = [
    {
      label: 'Total Revenue',
      value: formatNaira(metrics.totalRevenue),
      detail: `${metrics.totalOrders} orders recorded · ${formatNaira(metrics.collectedRevenue, true)} collected`,
      emphasis: 'text-slate-900',
    },
    {
      label: 'Total Expenses',
      value: formatNaira(metrics.totalExpenses),
      detail: `${state.expenses.length} operational entries logged`,
      emphasis: 'text-slate-900',
    },
    {
      label: 'Net Profit',
      value: formatNaira(metrics.netProfit),
      detail: `${metrics.profitMarginPct}% net margin across recorded period`,
      emphasis: metrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700',
    },
    {
      label: 'Outstanding Payments',
      value: formatNaira(metrics.outstandingPayments),
      detail:
        metrics.unpaidOrderCount === 0
          ? 'All recorded orders fully settled'
          : `${metrics.unpaidOrderCount} order${metrics.unpaidOrderCount > 1 ? 's' : ''} awaiting balance`,
      emphasis: metrics.outstandingPayments > 0 ? 'text-amber-700' : 'text-slate-900',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Business Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 text-sm text-slate-600">
        <p className="leading-snug">
          <strong className="font-semibold text-slate-900">{state.settings.businessName}</strong>
          {state.settings.businessType && (
            <>
              <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
              <span>{state.settings.businessType}</span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('assistant')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 whitespace-nowrap"
        >
          <span>Ask AI Business Assistant</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* 4-Column KPI Row */}
      <section aria-label="Key business metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
            <p className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${kpi.emphasis}`}>
              {kpi.value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{kpi.detail}</p>
          </div>
        ))}
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
                Revenue compared against operating expenses in NGN ({state.settings.currencySymbol})
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
                  tickFormatter={(v: number) => formatNaira(v, true)}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatNaira(Number(value ?? 0)),
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
              <p className="mt-0.5 text-sm text-slate-500">Latest recorded customer sales and payment status</p>
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
              <p className="text-sm font-medium text-slate-900">No sales recorded yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Record your first customer order to start tracking revenue and payment status.
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
                              Due {formatNaira(balance)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right align-top font-mono text-sm font-medium text-slate-900 tabular-nums">
                          {formatNaira(sale.totalAmount)}
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
              <p className="mt-0.5 text-sm text-slate-500">Ranked by total sales revenue</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Inventory
            </button>
          </div>

          {topSellingProducts.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No product rankings yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Your highest-performing products will appear here as orders are logged.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {topSellingProducts.map((item, idx) => (
                <div key={item.productName}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-900">
                      <span className="mr-2 font-mono text-xs text-slate-400">0{idx + 1}.</span>
                      {item.productName}
                    </p>
                    <span className="shrink-0 font-mono text-sm font-medium text-slate-900 tabular-nums">
                      {formatNaira(item.revenue)}
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
