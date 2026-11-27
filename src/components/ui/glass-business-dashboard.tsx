import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  animate,
  domMax,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
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
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Gauge,
  Layers,
  LayoutGrid,
  Lock,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  DashboardPeriod,
  NavSection,
  OnboardingPrimaryGoal,
  Product,
  SaleOrder,
  SalesRange,
} from '../../types/business';
import {
  ChartPoint,
  DashboardMetrics,
  RevenueGrowthSummary,
  TopProductItem,
  formatNaira,
  formatShortDate,
  getOutstandingBalance,
  getStockStatus,
} from '../../utils/analytics';
import { VendorAvatar } from '../VendorAvatar';

const GLASS_BACKDROP_SRC = '/src/assets/images/glass_dashboard_backdrop_1795789298074.jpg';

type GlassTab = 'overview' | 'growth' | 'actions';
type DialMetric = 'margin' | 'collection' | 'stock';

const TONES = {
  green: { bg: '#63cc87', ink: '#0b2415' },
  coral: { bg: '#f39a7c', ink: '#3b150a' },
  amber: { bg: '#f3c35c', ink: '#33230a' },
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 30 };

const PERIOD_OPTIONS: Array<{ id: DashboardPeriod; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'all', label: 'All Time' },
];

const RANGE_OPTIONS: Array<{ id: SalesRange; label: string }> = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '6m', label: '6 Months' },
];

const GLASS_TABS: Array<{ id: GlassTab; label: string; short: string; slug: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', short: 'Overview', slug: 'overview', icon: LayoutGrid },
  { id: 'growth', label: 'Revenue Growth', short: 'Growth', slug: 'revenue-growth', icon: TrendingUp },
  { id: 'actions', label: 'Quick Actions', short: 'Actions', slug: 'quick-actions', icon: Zap },
];

const cardIn = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const loadColor = (v: number, max: number) => {
  if (max <= 0 || v <= 0) return 'var(--hv-line2)';
  const ratio = v / max;
  if (ratio > 0.72) return TONES.coral.bg;
  if (ratio > 0.4) return TONES.amber.bg;
  return TONES.green.bg;
};

/* ---------- Animated Spring Segmented Control (Hovira style) ---------- */
function GlassSegment<T extends string>({
  value,
  options,
  onChange,
  label,
  uid,
  compact = false,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
  uid: string;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full p-1"
      style={{ background: 'var(--hv-well)' }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`relative rounded-full font-semibold transition-colors whitespace-nowrap shrink-0 ${
              compact ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-xs'
            }`}
            style={{ color: active ? 'var(--hv-ink)' : 'var(--hv-muted)' }}
          >
            {active && (
              <m.span
                layoutId={`${uid}-seg`}
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'var(--hv-card2)',
                  boxShadow: 'inset 0 0 0 1px var(--hv-line2)',
                }}
                transition={SPRING}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Pastel-Matte KPI Tile (Hovira EnergyView signature) ---------- */
function GlassToneKpi({
  icon: Icon,
  label,
  value,
  foot,
  bg,
  ink,
  isGlass = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  foot: string;
  bg?: string;
  ink?: string;
  isGlass?: boolean;
}) {
  return (
    <m.div
      variants={cardIn}
      className={`flex min-h-[124px] flex-col rounded-[22px] p-4 sm:p-[18px] ${isGlass ? 'hv-card' : ''}`}
      style={isGlass ? undefined : { background: bg, color: ink }}
    >
      <span className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="truncate opacity-90">{label}</span>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{
            background: isGlass ? 'var(--hv-card2)' : 'rgba(255, 255, 255, 0.24)',
          }}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </span>
      <span className="mt-2.5 font-mono text-2xl leading-tight font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className={`mt-auto pt-2.5 text-[11.5px] font-medium ${isGlass ? 'hv-muted' : 'opacity-85'}`}>
        {foot}
      </span>
    </m.div>
  );
}

/* ---------- 240° Radial Business Health Dial (Hovira ClimateCard signature) ---------- */
const A0 = 150;
const SWEEP = 240;
const CX = 150;
const CY = 140;
const R = 108;
const dialPt = (a: number): [number, number] => [
  CX + R * Math.cos((a * Math.PI) / 180),
  CY + R * Math.sin((a * Math.PI) / 180),
];
const DIAL_ARC = (() => {
  const [x0, y0] = dialPt(A0);
  const [x1, y1] = dialPt(A0 + SWEEP);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
})();

function HealthDialCard({
  metrics,
  symbol,
  uid,
}: {
  metrics: DashboardMetrics;
  symbol: string;
  uid: string;
}) {
  const [mode, setMode] = useState<DialMetric>('margin');
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);

  const collectionRate =
    metrics.totalRevenue > 0
      ? Number(((metrics.collectedRevenue / metrics.totalRevenue) * 100).toFixed(1))
      : 0;
  const stockHealthRate =
    metrics.totalProducts > 0
      ? Number((((metrics.totalProducts - metrics.lowStockCount) / metrics.totalProducts) * 100).toFixed(1))
      : 100;

  const currentMetric = useMemo(() => {
    if (mode === 'margin') {
      const clamped = clamp(metrics.profitMarginPct, 0, 100);
      return {
        title: 'Profit Margin',
        subtitle: 'Estimated net return on period revenue',
        eyebrow: 'Net margin',
        pct: metrics.profitMarginPct,
        fraction: clamped / 100,
        footnote:
          metrics.totalRevenue > 0
            ? `${formatNaira(metrics.netProfit, true, symbol)} net profit`
            : 'Record sales to measure',
      };
    }
    if (mode === 'collection') {
      return {
        title: 'Collection Rate',
        subtitle: 'Settled payments vs total billed revenue',
        eyebrow: 'Cash collected',
        pct: collectionRate,
        fraction: clamp(collectionRate, 0, 100) / 100,
        footnote:
          metrics.totalRevenue > 0
            ? `${formatNaira(metrics.collectedRevenue, true, symbol)} collected`
            : 'No billed orders yet',
      };
    }
    return {
      title: 'Stock Health',
      subtitle: 'Catalog SKUs above reorder threshold',
      eyebrow: 'Healthy stock',
      pct: metrics.totalProducts > 0 ? stockHealthRate : 0,
      fraction: metrics.totalProducts > 0 ? clamp(stockHealthRate, 0, 100) / 100 : 0,
      footnote:
        metrics.totalProducts > 0
          ? `${metrics.totalProducts - metrics.lowStockCount} of ${metrics.totalProducts} SKUs healthy`
          : 'Add products to monitor',
    };
  }, [mode, metrics, collectionRate, stockHealthRate, symbol]);

  const dashOffset = useTransform(progress, (v) => 1 - v);
  const knobX = useTransform(progress, (v) => dialPt(A0 + SWEEP * v)[0]);
  const knobY = useTransform(progress, (v) => dialPt(A0 + SWEEP * v)[1]);

  useEffect(() => {
    if (reduce) {
      progress.set(currentMetric.fraction);
      return;
    }
    const ctl = animate(progress, currentMetric.fraction, { duration: 0.7, ease: EASE });
    return () => ctl.stop();
  }, [currentMetric.fraction, reduce, progress]);

  const [x0, y0] = dialPt(A0);
  const [x1, y1] = dialPt(A0 + SWEEP);
  const [xm, ym] = dialPt(A0 + SWEEP / 2);
  const gradId = `${uid}-dial-grad`;

  const modeButtons: Array<{ id: DialMetric; label: string; icon: LucideIcon }> = [
    { id: 'margin', label: 'Margin', icon: TrendingUp },
    { id: 'collection', label: 'Cashflow', icon: Wallet },
    { id: 'stock', label: 'Stock', icon: Package },
  ];

  return (
    <section className="hv-card flex h-full flex-col gap-2 p-5">
      <div>
        <h3 className="text-base font-semibold tracking-tight">{currentMetric.title}</h3>
        <p className="hv-muted mt-0.5 text-xs">{currentMetric.subtitle}</p>
      </div>

      <div className="relative mx-auto my-auto w-[min(100%,260px)] pt-2 pb-1">
        <svg viewBox="0 0 300 225" className="h-auto w-full overflow-visible select-none" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="260" y2="0">
              <stop offset="0" stopColor="#3aa0f0" />
              <stop offset="0.45" stopColor="#4fd08a" />
              <stop offset="0.75" stopColor="#f1d24a" />
              <stop offset="1" stopColor="#f39436" />
            </linearGradient>
          </defs>
          <path d={DIAL_ARC} fill="none" stroke={`url(#${gradId})`} strokeWidth={10} strokeLinecap="round" opacity={0.22} />
          <m.path
            d={DIAL_ARC}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={10}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            style={{ strokeDashoffset: dashOffset }}
          />
          <circle cx={CX} cy={CY} r={R - 25} fill="none" stroke="var(--hv-line)" strokeWidth={1.5} />
          <g fill="var(--hv-muted)" fontSize={11} fontWeight={600}>
            <text x={x0 - 4} y={y0 + 18} textAnchor="middle">0%</text>
            <text x={xm} y={ym - 14} textAnchor="middle">50%</text>
            <text x={x1 + 4} y={y1 + 18} textAnchor="middle">100%</text>
          </g>
          <m.circle cx={knobX} cy={knobY} r={13} fill="var(--hv-accent)" fillOpacity={0.26} />
          <m.circle
            cx={knobX}
            cy={knobY}
            r={8.5}
            fill="#ffffff"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' }}
          />
          <m.circle cx={knobX} cy={knobY} r={4.5} fill="var(--hv-accent-fill)" />
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-[34%] flex flex-col items-center text-center">
          <span className="hv-muted text-[11px] font-semibold">{currentMetric.eyebrow}</span>
          <strong className="mt-1 font-mono text-[42px] leading-none font-semibold tracking-tight tabular-nums">
            {currentMetric.pct}%
          </strong>
          <span className="hv-muted mt-1.5 max-w-[175px] truncate text-xs">{currentMetric.footnote}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Business health gauge metric">
        {modeButtons.map((btn) => {
          const active = mode === btn.id;
          return (
            <m.button
              key={btn.id}
              type="button"
              aria-pressed={active}
              whileTap={{ scale: 0.96 }}
              onClick={() => setMode(btn.id)}
              className="relative flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[18px] text-xs font-semibold transition-colors"
              style={{
                background: active ? 'transparent' : 'var(--hv-well)',
                color: active ? 'var(--hv-on-accent)' : 'var(--hv-ink2)',
              }}
            >
              {active && (
                <m.span
                  layoutId={`${uid}-dial-mode`}
                  className="absolute inset-0 rounded-[18px]"
                  style={{ background: 'var(--hv-accent-fill)' }}
                  transition={SPRING}
                />
              )}
              <btn.icon className="relative size-4.5" strokeWidth={1.9} aria-hidden="true" />
              <span className="relative">{btn.label}</span>
            </m.button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Interactive Revenue Growth Chart (Bars + Cumulative Curve) ---------- */
function RevenueGrowthCard({
  growth,
  range,
  onRangeChange,
  currencyCode,
  symbol,
  isDark,
  uid,
  onRecordSale,
  defaultMode = 'bars',
}: {
  growth: RevenueGrowthSummary;
  range: SalesRange;
  onRangeChange: (r: SalesRange) => void;
  currencyCode: string;
  symbol: string;
  isDark: boolean;
  uid: string;
  onRecordSale: () => void;
  defaultMode?: 'bars' | 'curve';
}) {
  const [chartMode, setChartMode] = useState<'bars' | 'curve'>(defaultMode);
  const points = growth.points;
  const lastIdx = Math.max(0, points.length - 1);
  const [selectedIdx, setSelectedIdx] = useState<number>(lastIdx);
  const barAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIdx(Math.max(0, points.length - 1));
  }, [range, points.length]);

  const safeIdx = clamp(selectedIdx, 0, Math.max(0, points.length - 1));
  const selected = points[safeIdx] ?? {
    label: '—',
    revenue: 0,
    cumulativeRevenue: 0,
    expenses: 0,
    profit: 0,
    growthPct: null,
  };
  const maxRevenue = Math.max(...points.map((p) => p.revenue), 0);

  const pickFromPointer = (clientX: number) => {
    const rect = barAreaRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const idx = clamp(Math.floor(((clientX - rect.left) / rect.width) * points.length), 0, points.length - 1);
    setSelectedIdx(idx);
  };

  const growthLabel =
    growth.growthRatePct === null
      ? 'No sales recorded in this range yet'
      : growth.growthRatePct > 0
        ? `+${growth.growthRatePct}% vs prior ${range === '7d' ? '7 days' : range === '30d' ? '30 days' : '6 months'}`
        : growth.growthRatePct < 0
          ? `${growth.growthRatePct}% vs prior ${range === '7d' ? '7 days' : range === '30d' ? '30 days' : '6 months'}`
          : `Flat (0%) vs prior window`;

  const gridStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.09)';
  const tickColor = isDark ? '#9fb0bc' : '#526071';

  return (
    <section
      aria-label="Revenue growth chart"
      data-testid="revenue-growth-chart"
      className="hv-card flex h-full flex-col p-5 sm:p-6"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold tracking-tight sm:text-[17px]">Revenue Growth</h2>
            {growth.growthRatePct !== null && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums"
                style={{
                  color:
                    growth.growthRatePct >= 0
                      ? isDark
                        ? '#63cc87'
                        : '#047857'
                      : isDark
                        ? '#f39a7c'
                        : '#be123c',
                }}
              >
                {growth.growthRatePct >= 0 ? (
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="size-3.5" aria-hidden="true" />
                )}
                <span>{growthLabel}</span>
              </span>
            )}
          </div>
          <p className="hv-muted mt-0.5 text-xs">
            Interactive revenue trajectory &amp; cumulative growth in {currencyCode} ({symbol})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GlassSegment
            value={chartMode}
            onChange={setChartMode}
            label="Revenue growth display mode"
            uid={`${uid}-growth-mode`}
            compact
            options={[
              { id: 'bars', label: 'Growth Bars' },
              { id: 'curve', label: 'Growth Curve' },
            ]}
          />
          <GlassSegment
            value={range}
            onChange={onRangeChange}
            label="Revenue growth date range"
            uid={`${uid}-growth-range`}
            compact
            options={RANGE_OPTIONS}
          />
        </div>
      </div>

      {/* Live Readout Strip */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <strong className="font-mono text-3xl leading-none font-semibold tracking-tight tabular-nums">
            {formatNaira(
              chartMode === 'bars' ? selected.revenue : growth.totalRevenue,
              false,
              symbol
            )}
          </strong>
          <span className="hv-muted text-xs font-medium">
            {chartMode === 'bars' ? (
              <>
                {selected.label}
                <span className="mx-1.5" aria-hidden="true">·</span>
                Cumulative {formatNaira(selected.cumulativeRevenue, true, symbol)}
                {selected.growthPct !== null && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span
                      style={{
                        color:
                          selected.growthPct >= 0
                            ? isDark
                              ? '#63cc87'
                              : '#047857'
                            : isDark
                              ? '#f39a7c'
                              : '#be123c',
                      }}
                    >
                      {selected.growthPct >= 0 ? `+${selected.growthPct}%` : `${selected.growthPct}%`} vs prev
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                Total in {range === '7d' ? 'last 7 days' : range === '30d' ? 'last 30 days' : 'last 6 months'}
                <span className="mx-1.5" aria-hidden="true">·</span>
                Peak {growth.peakRevenue > 0 ? `${formatNaira(growth.peakRevenue, true, symbol)} (${growth.peakLabel})` : '—'}
              </>
            )}
          </span>
        </div>

        <span className="hv-muted text-xs font-mono tabular-nums">
          Avg {formatNaira(growth.averageBucketRevenue, true, symbol)} / period
        </span>
      </div>

      {/* Chart Canvas */}
      {!growth.hasRevenue ? (
        <div
          className="mt-5 flex min-h-[210px] flex-1 flex-col items-center justify-center rounded-[18px] px-4 py-8 text-center"
          style={{ background: 'var(--hv-well)' }}
        >
          <BarChart3 className="hv-muted size-8 opacity-75" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold">No revenue growth data in this range yet</p>
          <p className="hv-muted mt-1 max-w-sm text-xs leading-relaxed">
            Record your first customer sale and watch daily, 30-day, and 6-month revenue growth populate automatically.
          </p>
          <button
            type="button"
            onClick={onRecordSale}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ background: 'var(--hv-accent-fill)', color: 'var(--hv-on-accent)' }}
          >
            <span>Record First Sale</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : chartMode === 'bars' ? (
        <div className="mt-4 flex flex-1 flex-col justify-end">
          <div
            ref={barAreaRef}
            role="slider"
            tabIndex={0}
            aria-label="Inspect revenue growth by period"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, points.length - 1)}
            aria-valuenow={safeIdx}
            aria-valuetext={`${selected.label}, ${formatNaira(selected.revenue, false, symbol)}`}
            onPointerDown={(e) => pickFromPointer(e.clientX)}
            onPointerMove={(e) => {
              if (e.buttons > 0 || e.pointerType === 'mouse') {
                pickFromPointer(e.clientX);
              }
            }}
            onKeyDown={(e) => {
              const delta =
                e.key === 'ArrowRight' || e.key === 'ArrowUp'
                  ? 1
                  : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
                    ? -1
                    : 0;
              if (!delta) return;
              e.preventDefault();
              setSelectedIdx((prev) => clamp(prev + delta, 0, Math.max(0, points.length - 1)));
            }}
            className="flex min-h-[190px] flex-1 items-end gap-2 rounded-xl pt-2 sm:gap-3"
          >
            {points.map((pt, i) => {
              const heightPct = maxRevenue > 0 ? Math.max(pt.revenue > 0 ? 10 : 4, (pt.revenue / maxRevenue) * 100) : 4;
              const isSelected = i === safeIdx;
              const barColor = loadColor(pt.revenue, maxRevenue);
              return (
                <button
                  key={`${range}-${pt.label}-${i}`}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  aria-label={`${pt.label}: ${formatNaira(pt.revenue, false, symbol)}`}
                  className="group relative flex h-[186px] min-w-0 flex-1 flex-col justify-end focus-visible:outline-none"
                >
                  <m.span
                    className="block w-full origin-bottom rounded-[10px] sm:rounded-[12px]"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.55, delay: i * 0.04, ease: EASE }}
                    style={{
                      height: `${heightPct}%`,
                      background: pt.revenue > 0 ? barColor : 'transparent',
                      boxShadow:
                        pt.revenue <= 0
                          ? 'inset 0 0 0 1.5px var(--hv-line2)'
                          : isSelected
                            ? '0 0 0 2px var(--hv-ink)'
                            : 'none',
                      opacity: isSelected || pt.revenue <= 0 ? 1 : 0.8,
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="hv-muted mt-2.5 flex gap-2 text-[11px] font-semibold sm:gap-3" aria-hidden="true">
            {points.map((pt, i) => (
              <span
                key={`lbl-${pt.label}-${i}`}
                className="min-w-0 flex-1 truncate text-center"
                style={{ color: i === safeIdx ? 'var(--hv-ink)' : undefined }}
              >
                {pt.label}
              </span>
            ))}
          </div>

          <div className="hv-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold" aria-hidden="true">
            {(
              [
                ['Base', TONES.green.bg],
                ['Steady', TONES.amber.bg],
                ['Peak', TONES.coral.bg],
              ] as const
            ).map(([labelText, dotColor]) => (
              <span key={labelText} className="inline-flex items-center gap-1.5">
                <i className="size-2.5 rounded-full" style={{ background: dotColor }} />
                {labelText}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="mb-2 flex items-center gap-5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Cumulative Revenue
            </span>
            <span className="hv-muted inline-flex items-center gap-1.5 font-medium">
              <span className="size-2.5 rounded-full" style={{ background: TONES.amber.bg }} aria-hidden="true" />
              Period Revenue
            </span>
          </div>
          <div className="h-[224px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${uid}-cum-rev`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={`${uid}-per-rev`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f3c35c" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#f3c35c" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11.5 }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatNaira(v, true, symbol)}
                  tick={{ fill: tickColor, fontSize: 11.5 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatNaira(Number(value ?? 0), false, symbol),
                    name === 'cumulativeRevenue' ? 'Cumulative Revenue' : 'Period Revenue',
                  ]}
                  contentStyle={{
                    borderRadius: '14px',
                    border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(15,23,42,0.1)',
                    background: isDark ? 'rgba(15,23,28,0.94)' : 'rgba(255,255,255,0.95)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeRevenue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill={`url(#${uid}-cum-rev)`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f3c35c"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill={`url(#${uid}-per-rev)`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Main Glass Business Dashboard Component ---------- */
export interface GlassBusinessDashboardProps {
  theme: 'light' | 'dark';
  businessName: string;
  businessType?: string;
  currencyCode: string;
  currencySymbol: string;
  firstName: string;
  fullName: string;
  initials: string;
  avatarSeed: string;
  avatarUrl: string;
  isFreshWorkspace: boolean;
  preferredGoal?: OnboardingPrimaryGoal;
  period: DashboardPeriod;
  periodLabel: string;
  onPeriodChange: (p: DashboardPeriod) => void;
  range: SalesRange;
  onRangeChange: (r: SalesRange) => void;
  metrics: DashboardMetrics;
  expenseCount: number;
  chartData: ChartPoint[];
  revenueGrowth: RevenueGrowthSummary;
  lowStockProducts: Product[];
  recentSales: SaleOrder[];
  topProducts: TopProductItem[];
  downloaded: boolean;
  onDownloadReport: () => void;
  onNavigate: (section: NavSection) => void;
  onQuickRestock: (product: Product) => void;
}

export function GlassBusinessDashboard({
  theme,
  businessName,
  businessType,
  currencyCode,
  currencySymbol,
  firstName,
  fullName,
  initials,
  avatarSeed,
  avatarUrl,
  isFreshWorkspace,
  preferredGoal,
  period,
  periodLabel,
  onPeriodChange,
  range,
  onRangeChange,
  metrics,
  expenseCount,
  chartData,
  revenueGrowth,
  lowStockProducts,
  recentSales,
  topProducts,
  downloaded,
  onDownloadReport,
  onNavigate,
  onQuickRestock,
}: GlassBusinessDashboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [activeTab, setActiveTab] = useState<GlassTab>('overview');
  const [backdropFailed, setBackdropFailed] = useState(false);
  const isDark = theme === 'dark';

  const activeTabMeta = GLASS_TABS.find((t) => t.id === activeTab) ?? GLASS_TABS[0];
  const businessSlug =
    businessName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vendorpilot';

  const stepTab = (delta: number) => {
    const idx = GLASS_TABS.findIndex((t) => t.id === activeTab);
    const next = GLASS_TABS[(idx + delta + GLASS_TABS.length) % GLASS_TABS.length];
    setActiveTab(next.id);
  };

  const quickStarts: Array<{
    id: OnboardingPrimaryGoal;
    section: NavSection;
    icon: LucideIcon;
    title: string;
    desc: string;
    tone: { bg: string; ink: string };
  }> = [
    {
      id: 'inventory',
      section: 'inventory',
      icon: Package,
      title: 'Add your first product',
      desc: `Set unit cost, selling price, and low-stock alert levels for ${businessName || 'your store'}.`,
      tone: TONES.green,
    },
    {
      id: 'sales',
      section: 'sales',
      icon: ShoppingBag,
      title: 'Log your first sale',
      desc: 'Record paid, partial, or pending orders and watch stock auto-deduct cleanly.',
      tone: TONES.amber,
    },
    {
      id: 'expenses',
      section: 'expenses',
      icon: Receipt,
      title: 'Record your first expense',
      desc: 'Log rent, salaries, or supplies and unlock your category spending breakdown.',
      tone: TONES.coral,
    },
    {
      id: 'assistant',
      section: 'assistant',
      icon: Bot,
      title: 'Chat with your AI Assistant',
      desc: `Ask how to track margins, cashflow, or generate summaries anytime, ${firstName}.`,
      tone: TONES.green,
    },
  ];

  const prioritizedQuickStarts = preferredGoal
    ? [
        ...quickStarts.filter((q) => q.id === preferredGoal),
        ...quickStarts.filter((q) => q.id !== preferredGoal),
      ].slice(0, 3)
    : quickStarts.filter((q) => q.id !== 'expenses');

  const topProductMaxRev = topProducts[0]?.revenue ?? 1;
  const gridStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.09)';
  const tickColor = isDark ? '#9fb0bc' : '#526071';

  const quickActionCards: Array<{
    id: string;
    title: string;
    blurb: string;
    lines: string[];
    icon: LucideIcon;
    color: string;
    ink: string;
    target: NavSection;
  }> = [
    {
      id: 'record-sale',
      title: 'Record a Sale',
      blurb: 'Log customer orders and update revenue growth immediately.',
      lines: [
        'Auto-calculates order totals and balance due',
        'Deducts linked product stock cleanly',
        'Updates live Revenue Growth and cashflow metrics',
      ],
      icon: ShoppingBag,
      color: 'var(--hv-accent-fill)',
      ink: 'var(--hv-on-accent)',
      target: 'sales',
    },
    {
      id: 'log-expense',
      title: 'Log an Expense',
      blurb: 'Keep rent, logistics, power, and payroll organized.',
      lines: [
        'Tracks spend by category with pie chart breakdown',
        'Recalculates estimated net profit instantly',
        'Ready for CSV export anytime',
      ],
      icon: Receipt,
      color: TONES.amber.bg,
      ink: TONES.amber.ink,
      target: 'expenses',
    },
    {
      id: 'manage-stock',
      title: 'Manage Inventory',
      blurb: 'Add catalog SKUs, restock thresholds, and unit margins.',
      lines: [
        'Monitors reorder alerts automatically',
        'Calculates total inventory valuation',
        'One-click restock from low-stock cards',
      ],
      icon: Package,
      color: TONES.green.bg,
      ink: TONES.green.ink,
      target: 'inventory',
    },
    {
      id: 'ask-ai',
      title: 'Ask AI Assistant',
      blurb: 'Get answers calculated strictly from your real ledger.',
      lines: [
        'Generates weekly & monthly business summaries',
        'Surfaces top products and overdue receivables',
        'Zero fabricated figures or guesswork',
      ],
      icon: Bot,
      color: TONES.coral.bg,
      ink: TONES.coral.ink,
      target: 'assistant',
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <div
          data-hv-theme={theme}
          className="hv-root relative isolate overflow-hidden rounded-[28px] p-3 sm:rounded-[34px] sm:p-5"
        >
          {/* Ambient Blurred Architectural Studio Backdrop + Resilient CSS Fallback */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div
              className="absolute inset-0"
              style={{
                background: isDark
                  ? 'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.22), transparent 55%), radial-gradient(circle at 82% 75%, rgba(243,195,92,0.16), transparent 55%), linear-gradient(145deg, #0d1619 0%, #111c22 50%, #0b1116 100%)'
                  : 'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(circle at 80% 70%, rgba(243,195,92,0.2), transparent 55%), linear-gradient(145deg, #dce6e0 0%, #e7ece9 50%, #d8e1dc 100%)',
              }}
            />
            {!backdropFailed && (
              <img
                src={GLASS_BACKDROP_SRC}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setBackdropFailed(true)}
                className="absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] scale-105 object-cover blur-[6px] opacity-65 dark:opacity-50"
              />
            )}
            <div className="absolute inset-0 transition-colors duration-300" style={{ background: 'var(--hv-scrim)' }} />
          </div>

          {/* Browser-Style Floating Glass Chrome Bar */}
          <div className="relative z-10 mb-3.5 flex flex-wrap items-center justify-between gap-2.5 sm:mb-4">
            <div className="hv-chrome flex items-center gap-1 rounded-full p-1">
              <button
                type="button"
                aria-label="Previous dashboard view"
                onClick={() => stepTab(-1)}
                className="hv-hover grid size-9 place-items-center rounded-full"
                style={{ background: 'var(--hv-card2)' }}
              >
                <ChevronLeft className="size-4.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next dashboard view"
                onClick={() => stepTab(1)}
                className="hv-hover grid size-9 place-items-center rounded-full"
              >
                <ChevronRight className="size-4.5" aria-hidden="true" />
              </button>
            </div>

            <div
              className="hv-chrome hidden h-11 min-w-0 flex-[0_1_360px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold md:flex"
              style={{ background: 'var(--hv-addr)' }}
            >
              <Lock className="hv-muted size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{businessSlug}</span>
              <span className="hv-muted shrink-0">/ {activeTabMeta.slug}</span>
            </div>

            <div className="hv-chrome flex items-center gap-1.5 rounded-full p-1">
              <button
                type="button"
                onClick={onDownloadReport}
                title={`Export ${periodLabel} performance data as CSV`}
                className="hv-hover inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold whitespace-nowrap shrink-0"
                style={{ background: 'var(--hv-card2)' }}
              >
                {downloaded ? (
                  <Check className="size-3.5" style={{ color: 'var(--hv-accent-text)' }} aria-hidden="true" />
                ) : (
                  <Download className="size-3.5" style={{ color: 'var(--hv-accent-text)' }} aria-hidden="true" />
                )}
                <span>{downloaded ? 'Report Downloaded' : 'Download Report'}</span>
              </button>
            </div>
          </div>

          {/* Main Frosted Glass Window */}
          <div className="hv-glass relative rounded-[26px] p-3 sm:rounded-[30px] sm:p-4 lg:p-5">
            {/* Glass Header Capsule (Personalized Owner Welcome + Period Switcher) */}
            <header className="hv-card flex flex-col gap-4 rounded-[22px] p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3.5 sm:items-center">
                <VendorAvatar
                  seed={avatarSeed}
                  src={avatarUrl}
                  alt={`${fullName} (${initials})`}
                  initials={initials}
                  size={56}
                  showInitialsBadge
                  badgeSize="md"
                  className="h-14 w-14 shrink-0 rounded-2xl ring-2 ring-white/50 shadow-sm dark:ring-white/15"
                />
                <div className="min-w-0">
                  <h2 className="font-editorial text-2xl leading-tight font-bold tracking-normal sm:text-[1.65rem]">
                    Hi {firstName}!
                  </h2>
                  <p className="hv-muted mt-0.5 text-sm">
                    {isFreshWorkspace
                      ? `Welcome to ${businessName || 'your business'} — your private ledger is ready.`
                      : `Welcome back to ${businessName || 'your business'} · ${metrics.totalOrders} order${metrics.totalOrders === 1 ? '' : 's'} · ${formatNaira(metrics.collectedRevenue, true, currencySymbol)} collected`}
                  </p>
                  <p className="hv-muted mt-1 text-xs">
                    <strong className="font-semibold" style={{ color: 'var(--hv-ink)' }}>
                      {fullName} ({initials})
                    </strong>
                    {businessType && (
                      <>
                        <span className="mx-1.5 opacity-60" aria-hidden="true">·</span>
                        <span>{businessType}</span>
                      </>
                    )}
                    <span className="mx-1.5 opacity-60" aria-hidden="true">·</span>
                    <span>Showing {periodLabel}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <GlassSegment
                  value={period}
                  onChange={onPeriodChange}
                  label="Dashboard performance period"
                  uid={`${uid}-period`}
                  options={PERIOD_OPTIONS}
                />
                <button
                  type="button"
                  onClick={() => onNavigate('assistant')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                  style={{ background: 'var(--hv-accent-fill)', color: 'var(--hv-on-accent)' }}
                >
                  <span>Ask AI Assistant</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Tab Views */}
            <div className="mt-4">
              <AnimatePresence mode="wait" initial={false}>
                {activeTab === 'overview' && (
                  <m.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="space-y-4"
                  >
                    {/* First-Time Guided Quick-Start Strip */}
                    {isFreshWorkspace && (
                      <section aria-label="Getting started quick actions" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {prioritizedQuickStarts.map((item, idx) => {
                          const ItemIcon = item.icon;
                          const isRecommended = preferredGoal === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onNavigate(item.section)}
                              className="hv-card hv-hover group flex items-start gap-3.5 p-4 text-left transition-transform active:scale-[0.99]"
                              style={
                                isRecommended
                                  ? { boxShadow: 'inset 0 0 0 1.5px var(--hv-accent-text)' }
                                  : undefined
                              }
                            >
                              <span
                                className="grid size-10 shrink-0 place-items-center rounded-[14px]"
                                style={{ background: item.tone.bg, color: item.tone.ink }}
                              >
                                <ItemIcon className="size-4.5" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">
                                  {idx + 1}. {item.title}
                                </span>
                                {isRecommended && (
                                  <span
                                    className="mt-0.5 block text-[11px] font-semibold"
                                    style={{ color: 'var(--hv-accent-text)' }}
                                  >
                                    Recommended from your setup
                                  </span>
                                )}
                                <span className="hv-muted mt-1 block text-xs leading-relaxed">
                                  {item.desc}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </section>
                    )}

                    {/* 4 Signature Pastel-Matte Financial KPI Cards (Hovira EnergyView style) */}
                    <m.section
                      aria-label="Primary financial metrics"
                      initial="hidden"
                      animate="show"
                      transition={{ staggerChildren: 0.04 }}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    >
                      <GlassToneKpi
                        icon={Wallet}
                        label="Total Revenue"
                        value={formatNaira(metrics.totalRevenue, false, currencySymbol)}
                        foot={`${metrics.totalOrders} order${metrics.totalOrders === 1 ? '' : 's'} · ${formatNaira(metrics.collectedRevenue, true, currencySymbol)} collected`}
                        bg="var(--hv-accent-fill)"
                        ink="var(--hv-on-accent)"
                      />
                      <GlassToneKpi
                        icon={TrendingUp}
                        label="Estimated Net Profit"
                        value={formatNaira(metrics.netProfit, false, currencySymbol)}
                        foot={`${metrics.profitMarginPct}% estimated margin`}
                        bg={metrics.netProfit >= 0 ? TONES.green.bg : TONES.coral.bg}
                        ink={metrics.netProfit >= 0 ? TONES.green.ink : TONES.coral.ink}
                      />
                      <GlassToneKpi
                        icon={Receipt}
                        label="Total Expenses"
                        value={formatNaira(metrics.totalExpenses, false, currencySymbol)}
                        foot={`${expenseCount} operational entr${expenseCount === 1 ? 'y' : 'ies'} logged`}
                        bg={TONES.amber.bg}
                        ink={TONES.amber.ink}
                      />
                      <GlassToneKpi
                        icon={Clock}
                        label="Outstanding Payments"
                        value={formatNaira(metrics.outstandingPayments, false, currencySymbol)}
                        foot={
                          metrics.unpaidOrderCount === 0
                            ? 'All orders in period settled'
                            : `${metrics.unpaidOrderCount} order${metrics.unpaidOrderCount > 1 ? 's' : ''} awaiting balance`
                        }
                        bg={TONES.coral.bg}
                        ink={TONES.coral.ink}
                      />
                    </m.section>

                    {/* 2 Secondary Frosted Inventory Summary Tiles */}
                    <section aria-label="Inventory metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="hv-card flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span
                            className="grid size-11 shrink-0 place-items-center rounded-[15px]"
                            style={{ background: 'var(--hv-card2)' }}
                          >
                            <Package className="size-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="hv-muted text-xs font-medium">Total Products</p>
                            <p className="font-mono text-xl font-semibold tabular-nums">{metrics.totalProducts}</p>
                          </div>
                        </div>
                        <p className="hv-muted text-right text-xs font-mono tabular-nums">
                          Stock value {formatNaira(metrics.inventoryValuation, true, currencySymbol)}
                        </p>
                      </div>

                      <div className="hv-card flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span
                            className="grid size-11 shrink-0 place-items-center rounded-[15px]"
                            style={{
                              background: metrics.lowStockCount > 0 ? TONES.amber.bg : 'var(--hv-card2)',
                              color: metrics.lowStockCount > 0 ? TONES.amber.ink : 'var(--hv-accent-text)',
                            }}
                          >
                            <AlertTriangle className="size-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="hv-muted text-xs font-medium">Low-Stock Products</p>
                            <p className="font-mono text-xl font-semibold tabular-nums">{metrics.lowStockCount}</p>
                          </div>
                        </div>
                        <p className="hv-muted text-right text-xs">
                          {metrics.outOfStockCount > 0
                            ? `${metrics.outOfStockCount} out of stock`
                            : metrics.lowStockCount > 0
                              ? 'Below reorder threshold'
                              : 'All inventory healthy'}
                        </p>
                      </div>
                    </section>

                    {/* Primary Analytical Bento: Revenue Growth Chart (8 cols) + Radial Health Dial (4 cols) */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      <div className="lg:col-span-8">
                        <RevenueGrowthCard
                          growth={revenueGrowth}
                          range={range}
                          onRangeChange={onRangeChange}
                          currencyCode={currencyCode}
                          symbol={currencySymbol}
                          isDark={isDark}
                          uid={`${uid}-ov`}
                          onRecordSale={() => onNavigate('sales')}
                        />
                      </div>
                      <div className="lg:col-span-4">
                        <HealthDialCard metrics={metrics} symbol={currencySymbol} uid={`${uid}-dial`} />
                      </div>
                    </div>

                    {/* Secondary Split: Sales vs Expenses Performance + Low-Stock Alerts */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      <section
                        aria-label="Sales performance chart"
                        className="hv-card p-5 sm:p-6 lg:col-span-8"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-base font-semibold tracking-tight">Sales vs Expenses</h2>
                            <p className="hv-muted mt-0.5 text-xs">
                              Revenue compared against operating expenses in {currencyCode} ({currencySymbol})
                            </p>
                          </div>
                          <GlassSegment
                            value={range}
                            onChange={onRangeChange}
                            label="Sales performance chart date range"
                            uid={`${uid}-perf-range`}
                            compact
                            options={RANGE_OPTIONS}
                          />
                        </div>

                        <div className="mt-3.5 flex items-center gap-5 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            Revenue
                          </span>
                          <span className="hv-muted inline-flex items-center gap-1.5 font-medium">
                            <span className="size-2.5 rounded-full" style={{ background: TONES.coral.bg }} aria-hidden="true" />
                            Expenses
                          </span>
                        </div>

                        <div className="mt-3 h-64 w-full" data-testid="sales-performance-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`${uid}-rev-grad`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                                </linearGradient>
                                <linearGradient id={`${uid}-exp-grad`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f39a7c" stopOpacity={0.22} />
                                  <stop offset="95%" stopColor="#f39a7c" stopOpacity={0.01} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                              <XAxis
                                dataKey="label"
                                tick={{ fill: tickColor, fontSize: 11.5 }}
                                axisLine={{ stroke: gridStroke }}
                                tickLine={false}
                              />
                              <YAxis
                                tickFormatter={(v: number) => formatNaira(v, true, currencySymbol)}
                                tick={{ fill: tickColor, fontSize: 11.5 }}
                                axisLine={false}
                                tickLine={false}
                                width={64}
                              />
                              <Tooltip
                                formatter={(value: unknown, name: unknown) => [
                                  formatNaira(Number(value ?? 0), false, currencySymbol),
                                  name === 'revenue' ? 'Revenue' : 'Expenses',
                                ]}
                                contentStyle={{
                                  borderRadius: '14px',
                                  border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(15,23,42,0.1)',
                                  background: isDark ? 'rgba(15,23,28,0.94)' : 'rgba(255,255,255,0.95)',
                                  color: isDark ? '#f8fafc' : '#0f172a',
                                  boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
                                  fontSize: '12px',
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#10b981"
                                strokeWidth={2.3}
                                fill={`url(#${uid}-rev-grad)`}
                              />
                              <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke="#f39a7c"
                                strokeWidth={1.9}
                                strokeDasharray="4 4"
                                fill={`url(#${uid}-exp-grad)`}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </section>

                      {/* Low-Stock Alerts */}
                      <section
                        aria-label="Low-stock alerts"
                        className="hv-card flex flex-col p-5 sm:p-6 lg:col-span-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-base font-semibold tracking-tight">Low-Stock Alerts</h2>
                            <p className="hv-muted mt-0.5 text-xs">
                              {lowStockProducts.length} item{lowStockProducts.length === 1 ? '' : 's'} at or below reorder level
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('inventory')}
                            className="text-xs font-semibold hover:underline whitespace-nowrap"
                            style={{ color: 'var(--hv-accent-text)' }}
                          >
                            Manage all
                          </button>
                        </div>

                        {lowStockProducts.length === 0 ? (
                          <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-[18px] px-4 py-8 text-center" style={{ background: 'var(--hv-well)' }}>
                            <p className="text-sm font-semibold">Inventory levels are healthy</p>
                            <p className="hv-muted mt-1 text-xs">
                              All products are currently above their reorder threshold.
                            </p>
                          </div>
                        ) : (
                          <ul className="mt-4 flex flex-col gap-2">
                            {lowStockProducts.slice(0, 5).map((item) => {
                              const status = getStockStatus(item);
                              const isOut = status === 'Out of Stock';
                              return (
                                <li
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5"
                                  style={{ background: 'var(--hv-well)' }}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{item.name}</p>
                                    <p className="mt-0.5 text-xs">
                                      <span
                                        className="font-semibold"
                                        style={{ color: isOut ? '#f39a7c' : '#f3c35c' }}
                                      >
                                        {isOut ? 'Out of stock' : `${item.stock} left`}
                                      </span>
                                      <span className="hv-muted mx-1.5" aria-hidden="true">·</span>
                                      <span className="hv-muted font-mono tabular-nums">
                                        Reorder at {item.reorderLevel}
                                      </span>
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onQuickRestock(item)}
                                    aria-label={`Restock ${item.name}`}
                                    className="hv-hover shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                                    style={{
                                      background: 'var(--hv-card2)',
                                      boxShadow: 'inset 0 0 0 1px var(--hv-line2)',
                                    }}
                                  >
                                    Restock
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    </div>

                    {/* Bottom Split: Recent Transactions + Top-Selling Products (Hovira bar list style) */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      {/* Recent Transactions */}
                      <section
                        aria-label="Recent transactions"
                        className="hv-card p-5 sm:p-6 lg:col-span-7"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-base font-semibold tracking-tight">Recent Transactions</h2>
                            <p className="hv-muted mt-0.5 text-xs">
                              Recorded customer sales for {periodLabel.toLowerCase()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('sales')}
                            className="text-xs font-semibold hover:underline whitespace-nowrap"
                            style={{ color: 'var(--hv-accent-text)' }}
                          >
                            View all sales
                          </button>
                        </div>

                        {recentSales.length === 0 ? (
                          <div className="mt-5 flex flex-col items-center justify-center rounded-[18px] px-4 py-9 text-center" style={{ background: 'var(--hv-well)' }}>
                            <p className="text-sm font-semibold">No sales in this period</p>
                            <p className="hv-muted mt-1 text-xs">
                              Record a customer order or switch to All Time to view older transactions.
                            </p>
                            <button
                              type="button"
                              onClick={() => onNavigate('sales')}
                              className="mt-4 inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition-opacity hover:opacity-90"
                              style={{ background: 'var(--hv-accent-fill)', color: 'var(--hv-on-accent)' }}
                            >
                              Go to Sales &amp; Orders
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                              <thead>
                                <tr className="hv-muted text-xs" style={{ borderBottom: '1px solid var(--hv-line)' }}>
                                  <th className="pb-2.5 pr-3 font-semibold">Order / Date</th>
                                  <th className="pb-2.5 px-3 font-semibold">Customer &amp; Item</th>
                                  <th className="pb-2.5 px-3 font-semibold">Status</th>
                                  <th className="pb-2.5 pl-3 text-right font-semibold">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recentSales.map((sale) => {
                                  const balance = getOutstandingBalance(sale);
                                  return (
                                    <tr
                                      key={sale.id}
                                      className="hv-hover"
                                      style={{ borderBottom: '1px solid var(--hv-line)' }}
                                    >
                                      <td className="py-3 pr-3 align-top">
                                        <p className="font-mono text-xs font-semibold tabular-nums">
                                          {sale.orderNumber}
                                        </p>
                                        <p className="hv-muted mt-0.5 text-xs">{formatShortDate(sale.date)}</p>
                                      </td>
                                      <td className="py-3 px-3 align-top">
                                        <p className="font-semibold">{sale.customerName}</p>
                                        <p className="hv-muted mt-0.5 text-xs">
                                          {sale.productName} · Qty {sale.quantity}
                                        </p>
                                      </td>
                                      <td className="py-3 px-3 align-top">
                                        <span
                                          className="text-xs font-semibold"
                                          style={{
                                            color:
                                              sale.paymentStatus === 'Paid'
                                                ? isDark
                                                  ? '#63cc87'
                                                  : '#047857'
                                                : sale.paymentStatus === 'Partial'
                                                  ? isDark
                                                    ? '#f3c35c'
                                                    : '#b45309'
                                                  : isDark
                                                    ? '#f39a7c'
                                                    : '#be123c',
                                          }}
                                        >
                                          {sale.paymentStatus}
                                        </span>
                                        {balance > 0 && (
                                          <p className="hv-muted mt-0.5 font-mono text-[11px] tabular-nums">
                                            Due {formatNaira(balance, false, currencySymbol)}
                                          </p>
                                        )}
                                      </td>
                                      <td className="py-3 pl-3 text-right align-top font-mono text-sm font-semibold tabular-nums">
                                        {formatNaira(sale.totalAmount, false, currencySymbol)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>

                      {/* Top-Selling Products (Hovira horizontal progress bar list) */}
                      <section
                        aria-label="Top-selling products"
                        className="hv-card p-5 sm:p-6 lg:col-span-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-base font-semibold tracking-tight">Top-Selling Products</h2>
                            <p className="hv-muted mt-0.5 text-xs">Ranked by sales revenue in period</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('inventory')}
                            className="text-xs font-semibold hover:underline whitespace-nowrap"
                            style={{ color: 'var(--hv-accent-text)' }}
                          >
                            Inventory
                          </button>
                        </div>

                        {topProducts.length === 0 ? (
                          <div className="mt-5 flex flex-col items-center justify-center rounded-[18px] px-4 py-9 text-center" style={{ background: 'var(--hv-well)' }}>
                            <p className="text-sm font-semibold">No product rankings yet</p>
                            <p className="hv-muted mt-1 text-xs">
                              Your highest-performing products will appear here as orders are logged.
                            </p>
                          </div>
                        ) : (
                          <ul className="mt-4 flex flex-col gap-3">
                            {topProducts.map((item, idx) => {
                              const barColors = [
                                'var(--hv-accent-fill)',
                                TONES.green.bg,
                                TONES.amber.bg,
                                TONES.coral.bg,
                                '#3aa0f0',
                              ];
                              const fillPct = Math.max(8, (item.revenue / topProductMaxRev) * 100);
                              return (
                                <li key={item.productName} className="flex items-center gap-3">
                                  <span
                                    className="grid size-9 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold"
                                    style={{ background: 'var(--hv-card2)' }}
                                  >
                                    0{idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2 text-xs font-semibold">
                                      <span className="truncate text-sm">{item.productName}</span>
                                      <span className="shrink-0 font-mono tabular-nums">
                                        {formatNaira(item.revenue, false, currencySymbol)}
                                      </span>
                                    </div>
                                    <div
                                      className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                                      style={{ background: 'var(--hv-well)' }}
                                    >
                                      <m.div
                                        className="h-full rounded-full"
                                        style={{ background: barColors[idx % barColors.length] }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${fillPct}%` }}
                                        transition={{ duration: 0.65, delay: 0.06 * idx, ease: EASE }}
                                      />
                                    </div>
                                    <p className="hv-muted mt-1 font-mono text-[11px] tabular-nums">
                                      {item.unitsSold} sold · {item.sharePct}% of period sales
                                    </p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    </div>
                  </m.div>
                )}

                {activeTab === 'growth' && (
                  <m.div
                    key="growth"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="space-y-4"
                  >
                    {/* 4 Revenue Growth KPI Cards */}
                    <m.div
                      initial="hidden"
                      animate="show"
                      transition={{ staggerChildren: 0.05 }}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    >
                      <GlassToneKpi
                        icon={TrendingUp}
                        label="Range Revenue"
                        value={formatNaira(revenueGrowth.totalRevenue, false, currencySymbol)}
                        foot={`Total across ${range === '7d' ? 'last 7 days' : range === '30d' ? 'last 30 days' : 'last 6 months'}`}
                        bg="var(--hv-accent-fill)"
                        ink="var(--hv-on-accent)"
                      />
                      <GlassToneKpi
                        icon={Activity}
                        label="Period Growth Rate"
                        value={
                          revenueGrowth.growthRatePct === null
                            ? '—'
                            : `${revenueGrowth.growthRatePct >= 0 ? '+' : ''}${revenueGrowth.growthRatePct}%`
                        }
                        foot={
                          revenueGrowth.previousPeriodRevenue > 0
                            ? `Prior window: ${formatNaira(revenueGrowth.previousPeriodRevenue, true, currencySymbol)}`
                            : 'Baseline comparison window'
                        }
                        bg={
                          revenueGrowth.growthRatePct !== null && revenueGrowth.growthRatePct < 0
                            ? TONES.coral.bg
                            : TONES.green.bg
                        }
                        ink={
                          revenueGrowth.growthRatePct !== null && revenueGrowth.growthRatePct < 0
                            ? TONES.coral.ink
                            : TONES.green.ink
                        }
                      />
                      <GlassToneKpi
                        icon={Gauge}
                        label="Peak Period"
                        value={formatNaira(revenueGrowth.peakRevenue, false, currencySymbol)}
                        foot={revenueGrowth.peakLabel}
                        bg={TONES.amber.bg}
                        ink={TONES.amber.ink}
                      />
                      <GlassToneKpi
                        icon={Layers}
                        label="Average per Period"
                        value={formatNaira(revenueGrowth.averageBucketRevenue, false, currencySymbol)}
                        foot={`Across ${revenueGrowth.points.length} reporting buckets`}
                        bg={TONES.coral.bg}
                        ink={TONES.coral.ink}
                      />
                    </m.div>

                    {/* Side-by-side Revenue Growth Curve + Interactive Bar Scrubber */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      <div className="lg:col-span-7">
                        <RevenueGrowthCard
                          growth={revenueGrowth}
                          range={range}
                          onRangeChange={onRangeChange}
                          currencyCode={currencyCode}
                          symbol={currencySymbol}
                          isDark={isDark}
                          uid={`${uid}-gd-curve`}
                          onRecordSale={() => onNavigate('sales')}
                          defaultMode="curve"
                        />
                      </div>
                      <div className="lg:col-span-5">
                        <RevenueGrowthCard
                          growth={revenueGrowth}
                          range={range}
                          onRangeChange={onRangeChange}
                          currencyCode={currencyCode}
                          symbol={currencySymbol}
                          isDark={isDark}
                          uid={`${uid}-gd-bars`}
                          onRecordSale={() => onNavigate('sales')}
                          defaultMode="bars"
                        />
                      </div>
                    </div>
                  </m.div>
                )}

                {activeTab === 'actions' && (
                  <m.div
                    key="actions"
                    initial="hidden"
                    animate="show"
                    transition={{ staggerChildren: 0.06 }}
                    className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
                  >
                    {quickActionCards.map((action) => (
                      <m.button
                        key={action.id}
                        type="button"
                        variants={cardIn}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate(action.target)}
                        className="hv-card hv-hover flex min-h-[248px] flex-col p-5 text-left"
                      >
                        <span
                          className="grid size-14 place-items-center rounded-[18px]"
                          style={{ background: action.color, color: action.ink }}
                        >
                          <action.icon className="size-7" strokeWidth={1.85} aria-hidden="true" />
                        </span>
                        <span className="mt-4 text-lg font-semibold tracking-tight">{action.title}</span>
                        <span className="hv-muted mt-1 text-xs leading-relaxed">{action.blurb}</span>
                        <span className="mt-4 flex flex-col gap-1.5">
                          {action.lines.map((line) => (
                            <span
                              key={line}
                              className="flex items-start gap-2 text-xs font-medium"
                              style={{ color: 'var(--hv-ink2)' }}
                            >
                              <i
                                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                                style={{ background: 'var(--hv-accent-text)' }}
                                aria-hidden="true"
                              />
                              <span>{line}</span>
                            </span>
                          ))}
                        </span>
                        <span
                          className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold"
                          style={{ color: 'var(--hv-accent-text)' }}
                        >
                          <span>Open workspace</span>
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </span>
                      </m.button>
                    ))}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Floating Frosted Bottom Pill Dock (Hovira RoomBar signature) */}
          <nav
            aria-label="Dashboard views"
            className="hv-dock relative z-20 mx-auto -mt-5 flex w-fit max-w-full items-center gap-1 rounded-full p-1.5"
          >
            {GLASS_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors whitespace-nowrap sm:h-11 sm:px-5 sm:text-sm"
                  style={{ color: active ? 'var(--hv-ink)' : 'var(--hv-muted)' }}
                >
                  {active && (
                    <m.span
                      layoutId={`${uid}-dock`}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'var(--hv-card2)',
                        boxShadow: 'inset 0 0 0 1px var(--hv-line2)',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <tab.icon className="relative size-4" strokeWidth={1.9} aria-hidden="true" />
                  <span className="relative sm:hidden">{tab.short}</span>
                  <span className="relative hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}

export default GlassBusinessDashboard;
