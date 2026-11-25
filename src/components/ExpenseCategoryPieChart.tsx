import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { ExpenseCategory } from '../types/business';
import { ExpenseCategorySummary, formatNaira } from '../utils/analytics';
import { useTheme } from '../context/ThemeContext';

interface ExpenseCategoryPieChartProps {
  data: ExpenseCategorySummary[];
  totalExpenses: number;
  currencySymbol: string;
  selectedCategory: 'All' | ExpenseCategory;
  onSelectCategory: (category: 'All' | ExpenseCategory) => void;
  onRecordExpense: () => void;
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Inventory Restock': '#059669', // emerald-600
  'Logistics & Delivery': '#0284c7', // sky-600
  'Rent & Utilities': '#4f46e5', // indigo-600
  'Staff Salaries': '#d97706', // amber-600
  'Power & Generator Fuel': '#e11d48', // rose-600
  'Packaging & Supplies': '#0d9488', // teal-600
  'Marketing & Ads': '#7c3aed', // violet-600
};

const FALLBACK_COLORS = [
  '#059669',
  '#0284c7',
  '#4f46e5',
  '#d97706',
  '#e11d48',
  '#0d9488',
  '#7c3aed',
];

export function getExpenseCategoryColor(category: ExpenseCategory, index = 0): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface PieDatum extends ExpenseCategorySummary {
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: PieDatum }>;
  currencySymbol: string;
  isDark: boolean;
}

function ExpensePieTooltip({ active, payload, currencySymbol, isDark }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) {
    return null;
  }

  const item = payload[0].payload;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs shadow-md ${
        isDark
          ? 'border-slate-700 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-xs"
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
        <span className="font-semibold">{item.category}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-4 font-mono tabular-nums">
        <span className="font-semibold">{formatNaira(item.total, false, currencySymbol)}</span>
        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{item.sharePct}%</span>
      </div>
      <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {item.count} {item.count === 1 ? 'entry' : 'entries'}
      </p>
    </div>
  );
}

export function ExpenseCategoryPieChart({
  data,
  totalExpenses,
  currencySymbol,
  selectedCategory,
  onSelectCategory,
  onRecordExpense,
}: ExpenseCategoryPieChartProps) {
  const { isDark } = useTheme();
  const [hoveredCategory, setHoveredCategory] = useState<ExpenseCategory | null>(null);

  const chartData = useMemo<PieDatum[]>(
    () =>
      data.map((item, index) => ({
        ...item,
        color: getExpenseCategoryColor(item.category, index),
      })),
    [data]
  );

  const focusedItem = useMemo(() => {
    if (hoveredCategory) {
      return chartData.find((d) => d.category === hoveredCategory) ?? null;
    }
    if (selectedCategory !== 'All') {
      return chartData.find((d) => d.category === selectedCategory) ?? null;
    }
    return null;
  }, [chartData, hoveredCategory, selectedCategory]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleToggleCategory = (category: ExpenseCategory) => {
    onSelectCategory(selectedCategory === category ? 'All' : category);
  };

  return (
    <section
      aria-label="Expense breakdown by category"
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Expense Breakdown by Category
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            See where your money is going
            {chartData.length > 0 && (
              <>
                <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span>Click a slice or category to filter the ledger</span>
              </>
            )}
          </p>
        </div>

        {selectedCategory !== 'All' && (
          <button
            type="button"
            onClick={() => onSelectCategory('All')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-400 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/50 whitespace-nowrap"
          >
            Show all categories
          </button>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            <PieChartIcon className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            No category breakdown yet
          </p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Log expenses like Rent &amp; Utilities, Staff Salaries, or Packaging &amp; Supplies to
            visualize your spending distribution in this pie chart.
          </p>
          <button
            type="button"
            onClick={onRecordExpense}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-xs font-medium text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
          >
            Record First Expense
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Interactive Pie / Donut Chart */}
          <div
            className="relative mx-auto h-64 w-full max-w-[280px] sm:h-72 sm:max-w-[300px] lg:col-span-5"
            data-testid="expense-category-pie-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="86%"
                  paddingAngle={chartData.length > 1 ? 2 : 0}
                  stroke={isDark ? '#0f172a' : '#ffffff'}
                  strokeWidth={2}
                  isAnimationActive={!prefersReducedMotion}
                  animationDuration={450}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={(_, index) => {
                    const clicked = chartData[index];
                    if (clicked) {
                      handleToggleCategory(clicked.category);
                    }
                  }}
                >
                  {chartData.map((entry) => {
                    const isSelected = selectedCategory === entry.category;
                    const isHovered = hoveredCategory === entry.category;
                    const hasEmphasis =
                      selectedCategory !== 'All' || hoveredCategory !== null;
                    const dimmed = hasEmphasis && !isSelected && !isHovered;

                    return (
                      <Cell
                        key={entry.category}
                        fill={entry.color}
                        fillOpacity={dimmed ? 0.3 : 1}
                        className="cursor-pointer outline-none transition-opacity duration-150"
                        onMouseEnter={() => setHoveredCategory(entry.category)}
                      />
                    );
                  })}
                </Pie>
                <Tooltip
                  content={
                    <ExpensePieTooltip currencySymbol={currencySymbol} isDark={isDark} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Readout */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="max-w-[130px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {focusedItem ? focusedItem.category : 'Total Spend'}
              </span>
              <span className="mt-0.5 font-mono text-lg font-bold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-xl">
                {formatNaira(focusedItem ? focusedItem.total : totalExpenses, true, currencySymbol)}
              </span>
              <span className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {focusedItem
                  ? `${focusedItem.sharePct}% of total`
                  : `${chartData.length} ${chartData.length === 1 ? 'category' : 'categories'}`}
              </span>
            </div>
          </div>

          {/* Interactive Breakdown Legend & Shares */}
          <div className="space-y-1.5 lg:col-span-7">
            {chartData.map((item) => {
              const active = selectedCategory === item.category;
              const hovered = hoveredCategory === item.category;
              return (
                <button
                  key={item.category}
                  type="button"
                  aria-pressed={active}
                  onMouseEnter={() => setHoveredCategory(item.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onFocus={() => setHoveredCategory(item.category)}
                  onBlur={() => setHoveredCategory(null)}
                  onClick={() => handleToggleCategory(item.category)}
                  className={`flex min-h-[44px] w-full flex-col justify-center rounded-lg px-3.5 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                    active
                      ? 'bg-emerald-50/90 text-emerald-950 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-50 dark:ring-emerald-800/60'
                      : hovered
                        ? 'bg-slate-50 dark:bg-slate-800/70'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.category}
                      </span>
                      <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">
                        · {item.count} {item.count === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-baseline gap-2.5 font-mono tabular-nums">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {formatNaira(item.total, false, currencySymbol)}
                      </span>
                      <span className="w-11 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {item.sharePct}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(3, Math.min(100, item.sharePct))}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
