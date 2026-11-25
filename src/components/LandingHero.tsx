import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  animate,
  domMax,
  m,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'motion/react';
import {
  ArrowUpRight,
  BatteryFull,
  Bot,
  Check,
  ChevronRight,
  Package,
  ShoppingBag,
  Signal,
  Star,
  Wifi,
} from 'lucide-react';
import { CURATED_AVATARS } from '../utils/avatars';
import { VendorAvatar } from './VendorAvatar';

export type HeroRange = '7d' | '30d' | '6m';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const SPLASH_TIMING = {
  hold: 1.45,
  shrink: 0.78,
  fade: 0.38,
};

const INTRO_AT = SPLASH_TIMING.hold + SPLASH_TIMING.shrink * 0.52;

// Persists for the active SPA visit so returning from AuthView does not re-trigger the full-screen splash,
// while any fresh page load plays the signature preloader cleanly.
let introPlayedThisVisit = false;

const HERO_PHRASES = [
  'not guesswork.',
  'in one ledger.',
  'every Naira clear.',
  'ready to grow.',
];

const HUB_TICKER = [
  { city: 'Lagos', ledgers: 1840 },
  { city: 'Abuja', ledgers: 920 },
  { city: 'Kano', ledgers: 1150 },
  { city: 'Onitsha', ledgers: 1380 },
  { city: 'Port Harcourt', ledgers: 760 },
  { city: 'Ibadan', ledgers: 690 },
];

const PHONE_RANGE_METRICS: Record<
  HeroRange,
  {
    period: string;
    revenue: string;
    margin: string;
    receivables: string;
    orders: string;
    spark: number[];
  }
> = {
  '7d': {
    period: 'Last 7 days',
    revenue: '₦1.28M',
    margin: '63.7%',
    receivables: '₦172K',
    orders: '19 orders',
    spark: [22, 34, 28, 46, 42, 58, 66],
  },
  '30d': {
    period: 'This month',
    revenue: '₦4.85M',
    margin: '34.4%',
    receivables: '₦612K',
    orders: '68 orders',
    spark: [28, 46, 38, 54, 68, 60, 72],
  },
  '6m': {
    period: 'Last 6 months',
    revenue: '₦26.4M',
    margin: '31.4%',
    receivables: '₦612K',
    orders: '412 orders',
    spark: [24, 38, 34, 52, 62, 58, 76],
  },
};

const AI_QUICK_QA = [
  {
    q: 'Top seller this month?',
    a: 'Mama Gold Rice (50kg) leads with ₦1.27M across 15 bags sold.',
  },
  {
    q: 'Who owes a balance?',
    a: 'Tunde Bakare Stores has ₦60,000 pending on invoice VP-1051.',
  },
];

const subscribeNever = () => () => {};
const numberFormatter = new Intl.NumberFormat('en-US');

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false
  );
}

/**
 * Exact VendorPilot AI chart-arrow logo mark used consistently across
 * the intro preloader, floating navbar, phone cockpit, and auth views.
 */
export function VendorPilotLogoMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Shared Motion provider for the landing splash, floating navbar hover indicator, and hero choreography.
 */
export function VendorPilotMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>{children}</LazyMotion>
    </MotionConfig>
  );
}

interface RollingCtaButtonProps {
  label: string;
  hoverLabel: string;
  onClick: () => void;
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * Rolling emerald-fill primary CTA button:
 * Dark slate container with an emerald arrow tile on the right that sweeps
 * across the entire button on hover while rolling the label cleanly upward.
 */
export function RollingCtaButton({
  label,
  hoverLabel,
  onClick,
  size = 'md',
  className = '',
}: RollingCtaButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`vp-cta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
        size === 'sm' ? 'vp-cta-sm' : ''
      } ${className}`}
    >
      <span aria-hidden="true" className="vp-cta-fill" />
      <span className="relative grid overflow-hidden text-left">
        <span className="vp-cta-label vp-cta-label-rest">{label}</span>
        <span aria-hidden="true" className="vp-cta-label vp-cta-label-hover">
          {hoverLabel}
        </span>
      </span>
      <span aria-hidden="true" className="vp-cta-tile">
        <ArrowUpRight className="vp-cta-arrow" strokeWidth={2.4} />
      </span>
    </button>
  );
}

/**
 * Full-screen VendorPilot AI intro preloader (mobile, tablet, and desktop):
 * Displays the springing VendorPilot AI logo mark, wordmark, tagline, and gliding progress bar,
 * then morph-shrinks via clip-path into the Hero phone screen (.vp-splash-target) on desktop,
 * or transitions smoothly upward with a rounded frame lift on mobile screens.
 */
export function VendorPilotIntroSplash() {
  const [done, setDone] = useState(() => introPlayedThisVisit);
  const layerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const skip = done || reduceMotion;

  useEffect(() => {
    if (skip) {
      introPlayedThisVisit = true;
      return;
    }

    const layer = layerRef.current;
    const content = contentRef.current;
    if (!layer || !content) return;

    let cancelled = false;
    let currentAnim: { stop: () => void } | null = null;

    const runIntro = async () => {
      await new Promise((resolve) => setTimeout(resolve, SPLASH_TIMING.hold * 1000));
      if (cancelled) return;

      const targetRect = document.querySelector('.vp-splash-target')?.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const canMorphIntoPhone =
        vw >= 768 &&
        targetRect &&
        targetRect.width > 80 &&
        targetRect.top >= -40 &&
        targetRect.bottom < vh + 140;

      if (canMorphIntoPhone && targetRect) {
        const insetValues = [
          Math.max(0, targetRect.top),
          Math.max(0, vw - targetRect.right),
          Math.max(0, vh - targetRect.bottom),
          Math.max(0, targetRect.left),
        ];
        const radius = Math.round(targetRect.width * 0.11);
        const clipTarget = `inset(${insetValues.map((v) => `${Math.round(v)}px`).join(' ')} round ${radius}px)`;

        animate(
          content,
          { transform: ['scale(1)', 'scale(0.42)'], opacity: 0 },
          { duration: SPLASH_TIMING.shrink * 0.68, ease: EASE_OUT }
        );
        currentAnim = animate(
          layer,
          { clipPath: ['inset(0px 0px 0px 0px round 0px)', clipTarget] },
          { duration: SPLASH_TIMING.shrink, ease: [0.76, 0, 0.24, 1] }
        );
        await currentAnim;
      } else {
        // Mobile & compact viewport exit: crisp rounded frame pull-up revealing the Hero cleanly
        animate(
          content,
          { transform: ['translateY(0px) scale(1)', 'translateY(-18px) scale(0.92)'], opacity: 0 },
          { duration: SPLASH_TIMING.shrink * 0.65, ease: EASE_OUT }
        );
        currentAnim = animate(
          layer,
          {
            clipPath: [
              'inset(0px 0px 0px 0px round 0px)',
              `inset(12px 12px ${vh}px 12px round 28px)`,
            ],
          },
          { duration: SPLASH_TIMING.shrink, ease: [0.76, 0, 0.24, 1] }
        );
        await currentAnim;
      }

      if (cancelled) return;

      layer.style.pointerEvents = 'none';
      currentAnim = animate(layer, { opacity: 0 }, { duration: SPLASH_TIMING.fade, ease: 'easeOut' });
      await currentAnim;

      if (!cancelled) {
        introPlayedThisVisit = true;
        setDone(true);
      }
    };

    void runIntro();

    return () => {
      cancelled = true;
      currentAnim?.stop();
    };
  }, [skip]);

  if (skip) return null;

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-testid="vp-intro-splash"
      className="vp-splash fixed inset-0 z-[70] grid min-h-[100dvh] w-full place-items-center overflow-hidden px-5"
    >
      <div ref={contentRef} className="flex w-full max-w-xs flex-col items-center text-center sm:max-w-md">
        <m.span
          initial={{ opacity: 0, transform: 'scale(0.62) rotate(-12deg)' }}
          animate={{ opacity: 1, transform: 'scale(1) rotate(0deg)' }}
          transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.08 }}
          className="vp-splash-mark grid h-20 w-20 place-items-center rounded-[24px] sm:h-24 sm:w-24 sm:rounded-[28px]"
        >
          <span className="flex h-13 w-13 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 sm:h-16 sm:w-16 sm:rounded-2xl">
            <VendorPilotLogoMark className="h-7 w-7 sm:h-9 sm:w-9" />
          </span>
        </m.span>

        <m.span
          initial={{ opacity: 0, transform: 'translateY(14px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.58, delay: 0.24, ease: EASE_OUT }}
          className="mt-5 font-editorial text-3xl leading-none font-bold tracking-normal text-white sm:mt-6 sm:text-[44px]"
        >
          VendorPilot <span className="text-emerald-200">AI</span>
        </m.span>

        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.92 }}
          transition={{ duration: 0.55, delay: 0.4 }}
          className="mt-2 font-hand text-lg tracking-wide text-emerald-50 sm:text-xl"
        >
          Run On Facts, Not Guesswork.
        </m.span>

        <span className="vp-splash-road relative mt-8 h-0 w-44 sm:mt-10 sm:w-52">
          <span className="vp-splash-glider absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-700 shadow-md sm:h-7 sm:w-7">
              <VendorPilotLogoMark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Angled -12deg architectural trade-grid (inspired by the reference map stage)
 * harmoniously layered with VendorPilot AI's emerald-and-teal billowing cloud aura.
 */
function VendorPilotHeroBackdrop({ start, reduceMotion }: { start: number; reduceMotion: boolean }) {
  const dotPatternId = useId();

  const gridBlocks = useMemo(() => {
    const items: Array<{ i: number; j: number; shade: number }> = [];
    for (let i = -9; i <= 11; i++) {
      for (let j = -7; j <= 8; j++) {
        const raw = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
        const shade = raw - Math.floor(raw);
        if (shade > 0.36) {
          items.push({ i, j, shade });
        }
      }
    }
    return items;
  }, []);

  const gridLines = useMemo(() => Array.from({ length: 23 }, (_, idx) => idx - 11), []);
  const spacing = 54;
  const far = 12 * spacing;
  const greenParks = [
    { i: 2, j: -2 },
    { i: 6, j: 2 },
    { i: -1, j: 3 },
    { i: 5, j: -4 },
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* 1. Reference-inspired angled geometric city/trade grid revealing outward from the phone */}
      <m.div
        initial={{ '--vp-reveal': reduceMotion ? '170%' : '0%' } as Record<string, string>}
        animate={{ '--vp-reveal': '170%' } as Record<string, string>}
        transition={{
          duration: reduceMotion ? 0 : 1.75,
          delay: reduceMotion ? 0 : start,
          ease: EASE_OUT,
        }}
        className="vp-reveal absolute inset-0"
      >
        <div className="vp-plan-mask absolute inset-0 opacity-90 dark:opacity-45">
          <svg
            viewBox="0 0 1440 760"
            preserveAspectRatio="xMidYMid slice"
            className="h-full w-full"
            fill="none"
          >
            <defs>
              <pattern id={dotPatternId} width="8" height="8" patternUnits="userSpaceOnUse">
                <circle
                  cx="4"
                  cy="4"
                  r="0.9"
                  className="fill-emerald-900/20 dark:fill-emerald-300/25"
                />
              </pattern>
            </defs>

            <g transform="translate(860 390) rotate(-12)">
              {gridBlocks.map((b) => (
                <rect
                  key={`${b.i}:${b.j}`}
                  x={b.i * spacing + 5}
                  y={b.j * spacing + 5}
                  width={spacing - 10}
                  height={spacing - 10}
                  rx="4"
                  className="fill-slate-100/90 dark:fill-slate-800/55"
                  fillOpacity={0.35 + b.shade * 0.5}
                />
              ))}

              {greenParks.map((park) => (
                <g key={`park-${park.i}:${park.j}`}>
                  <rect
                    x={park.i * spacing + 5}
                    y={park.j * spacing + 5}
                    width={spacing * 2 - 10}
                    height={spacing - 10}
                    rx="5"
                    className="fill-emerald-100/80 dark:fill-emerald-950/70"
                  />
                  <rect
                    x={park.i * spacing + 5}
                    y={park.j * spacing + 5}
                    width={spacing * 2 - 10}
                    height={spacing - 10}
                    rx="5"
                    fill={`url(#${dotPatternId})`}
                  />
                </g>
              ))}
            </g>

            {/* Subtle teal lagoon/corridor curving gently beneath the phone stage */}
            <path
              d="M -60 660 C 260 560, 560 500, 910 385 S 1300 220, 1520 120"
              strokeWidth="44"
              strokeLinecap="round"
              className="stroke-emerald-100/70 dark:stroke-emerald-950/45"
            />

            <g transform="translate(860 390) rotate(-12)">
              {gridLines.map((k) => {
                const isAvenue = k % 4 === 0;
                return (
                  <g key={`line-${k}`}>
                    <line
                      x1={k * spacing}
                      x2={k * spacing}
                      y1={-far}
                      y2={far}
                      strokeWidth={isAvenue ? 9 : 1}
                      className={
                        isAvenue
                          ? 'stroke-white dark:stroke-slate-900/90'
                          : 'stroke-slate-300/60 dark:stroke-slate-700/40'
                      }
                    />
                    <line
                      x1={-far}
                      x2={far}
                      y1={k * spacing}
                      y2={k * spacing}
                      strokeWidth={isAvenue ? 9 : 1}
                      className={
                        isAvenue
                          ? 'stroke-white dark:stroke-slate-900/90'
                          : 'stroke-slate-300/60 dark:stroke-slate-700/40'
                      }
                    />
                  </g>
                );
              })}

              {/* Cartographic Nigerian SME commercial hub labels aligned with the -12deg city grid */}
              {[
                { name: 'BALOGUN MARKET', x: 164, y: -154 },
                { name: 'COMPUTER VILLAGE', x: -162, y: -210 },
                { name: 'ALABA INT’L', x: -245, y: 120 },
                { name: 'ONITSHA MAIN', x: 256, y: 126 },
                { name: 'WUSE MARKET', x: 48, y: 232 },
              ].map((hub) => (
                <text
                  key={hub.name}
                  x={hub.x}
                  y={hub.y}
                  className="fill-slate-500/55 font-mono text-[9px] font-semibold tracking-[0.22em] dark:fill-emerald-200/35"
                >
                  {hub.name}
                </text>
              ))}
            </g>
          </svg>
        </div>
      </m.div>

      {/* 2. VendorPilot AI emerald & teal billowing cloud aura blooming behind the phone & lower hero */}
      <div className="absolute inset-0 opacity-90 dark:opacity-45">
        <div className="absolute top-12 right-[4%] h-[25rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(16,185,129,0.34)_0%,rgba(45,212,191,0.24)_45%,rgba(167,243,208,0.12)_72%,rgba(255,255,255,0)_88%)] blur-[48px] sm:h-[30rem] sm:w-[32rem]" />
        <div className="absolute -bottom-24 left-1/2 h-[22rem] w-[115%] max-w-[1280px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_66%_56%_at_50%_46%,rgba(5,150,105,0.42)_0%,rgba(20,184,166,0.28)_44%,rgba(167,243,208,0.18)_72%,rgba(255,255,255,0)_90%)] blur-[58px]" />
      </div>
    </div>
  );
}

/**
 * Word-by-word blurred cross-dissolve phrase transition for Line 2 of the Hero Headline.
 */
function KineticPhrase({ text }: { text: string }) {
  return (
    <span className="inline-flex flex-wrap gap-x-[0.26em]">
      {text.split(' ').map((word, index) => (
        <m.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, transform: 'translateY(0.32em)', filter: 'blur(8px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }}
          exit={{
            opacity: 0,
            transform: 'translateY(-0.28em)',
            filter: 'blur(8px)',
            transition: { duration: 0.36, delay: index * 0.04, ease: [0.4, 0, 1, 1] },
          }}
          transition={{ duration: 0.68, delay: 0.12 + index * 0.08, ease: EASE_OUT }}
          className="inline-block"
        >
          {word}
        </m.span>
      ))}
    </span>
  );
}

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(value);

  useMotionValueEvent(mv, 'change', (latest) => {
    if (ref.current) ref.current.textContent = numberFormatter.format(Math.round(latest));
  });

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.85, ease: EASE_OUT });
    return () => controls.stop();
  }, [mv, value]);

  return (
    <span ref={ref} className="font-mono font-semibold tabular-nums">
      {numberFormatter.format(value)}
    </span>
  );
}

/**
 * Press-and-hold interactive button inside the Hero phone cockpit:
 * Sweeps emerald left-to-right while held (or triggers immediately via Enter / Space).
 */
function HoldToRecordButton({
  label,
  onComplete,
}: {
  label: string;
  onComplete: () => void;
}) {
  const runRef = useRef<{ stop: () => void } | null>(null);
  const fill = useMotionValue(0);
  const revealClip = useTransform(fill, (v) => `inset(0 ${100 - v * 100}% 0 0)`);

  const handleStart = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    runRef.current?.stop();
    runRef.current = animate(fill, 1, {
      duration: 0.65 * (1 - fill.get()),
      ease: 'linear',
      onComplete: () => {
        onComplete();
        fill.set(0);
      },
    });
  };

  const handleStop = () => {
    if (fill.get() >= 1) return;
    runRef.current?.stop();
    runRef.current = animate(fill, 0, { duration: 0.22, ease: EASE_OUT });
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onComplete();
  };

  return (
    <button
      type="button"
      onPointerDown={handleStart}
      onPointerUp={handleStop}
      onPointerLeave={handleStop}
      onPointerCancel={handleStop}
      onKeyDown={handleKeyDown}
      aria-label={`${label}. Press and hold, or press Enter`}
      className="vp-hold-btn relative mt-3 flex h-10 w-full items-center justify-center overflow-hidden rounded-[11px] bg-slate-900 text-xs font-semibold text-white select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-slate-800"
    >
      <m.span
        aria-hidden="true"
        style={{ scaleX: fill }}
        className="absolute inset-0 origin-left bg-emerald-500"
      />
      <span className="relative z-10 flex items-center gap-1.5 text-white">{label}</span>
      <m.span
        aria-hidden="true"
        style={{ clipPath: revealClip }}
        className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 bg-transparent font-bold text-slate-950"
      >
        {label}
      </m.span>
    </button>
  );
}

function PhoneSparkline({ values }: { values: number[] }) {
  const width = 220;
  const height = 56;
  const max = Math.max(...values) * 1.1;
  const min = Math.min(...values) * 0.7;
  const span = Math.max(1, max - min);

  const pts = values.map((v, i) => ({
    x: 6 + (i / Math.max(1, values.length - 1)) * (width - 12),
    y: height - 8 - ((v - min) / span) * (height - 16),
  }));

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="vpPhoneSparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#vpPhoneSparkArea)" />
      <path
        d={path}
        fill="none"
        stroke="#059669"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="3.5"
        className="fill-emerald-600 stroke-white dark:fill-emerald-400 dark:stroke-slate-900"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Interactive VendorPilot AI Phone Cockpit in the Hero right column.
 * Houses `.vp-splash-target` so the full-screen emerald intro preloader morphs cleanly into it.
 */
function VendorPilotPhoneCockpit({
  heroRange,
  onRangeChange,
  reduceMotion,
}: {
  heroRange: HeroRange;
  onRangeChange: (r: HeroRange) => void;
  reduceMotion: boolean;
}) {
  const [phoneTab, setPhoneTab] = useState<'sale' | 'stock' | 'ai'>('sale');
  const [saleRecorded, setSaleRecorded] = useState(false);
  const [restockedOil, setRestockedOil] = useState(false);
  const [aiIndex, setAiIndex] = useState(0);

  const metrics = PHONE_RANGE_METRICS[heroRange];
  const aiItem = AI_QUICK_QA[aiIndex];

  useEffect(() => {
    if (!saleRecorded) return;
    const t = setTimeout(() => setSaleRecorded(false), 4200);
    return () => clearTimeout(t);
  }, [saleRecorded]);

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(-36px) rotate(-3deg)' }}
      animate={{ opacity: 1, transform: 'translateY(0px) rotate(0deg)' }}
      transition={{ type: 'spring', stiffness: 125, damping: 18, delay: 0.14 }}
      className="relative mx-auto w-[288px] sm:w-[306px]"
    >
      {/* Luminous emerald halo behind the phone */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-10 top-8 bottom-8 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.28),transparent)] blur-2xl"
      />

      <div className="vp-phone-shell">
        <div className="vp-phone-bezel">
          {/* Exact clip-path landing target for VendorPilotIntroSplash */}
          <div className="vp-splash-target relative flex h-[548px] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {/* Phone Status Bar & Notch */}
            <div className="relative flex items-center justify-between px-5 pt-2.5 pb-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
              <span className="font-mono tabular-nums">9:41</span>
              <span
                aria-hidden="true"
                className="absolute top-2 left-1/2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-950"
              />
              <span className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" aria-hidden="true" />
                <Wifi className="h-2.5 w-2.5" aria-hidden="true" />
                <BatteryFull className="h-3 w-3" aria-hidden="true" />
              </span>
            </div>

            {/* Mini Brand Header + Period Selector */}
            <div className="flex items-center justify-between px-4 pt-1.5 pb-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-emerald-400 dark:bg-slate-800">
                  <VendorPilotLogoMark className="h-3.5 w-3.5" />
                </span>
                <span className="font-editorial text-xs font-semibold text-slate-900 dark:text-white">
                  VendorPilot <span className="text-emerald-600 dark:text-emerald-400">AI</span>
                </span>
              </span>

              <div
                role="group"
                aria-label="Phone cockpit timeframe"
                className="flex items-center gap-0.5 rounded-lg bg-slate-200/75 p-0.5 dark:bg-slate-800/90"
              >
                {(['7d', '30d', '6m'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRangeChange(r)}
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                      heroRange === r
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-emerald-600 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Top Live Revenue Card inside Phone */}
            <div className="mx-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {metrics.period} · NGN (₦)
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums dark:text-white">
                    {saleRecorded && heroRange === '30d' ? '₦4.93M' : metrics.revenue}
                  </p>
                </div>
                <span className="font-mono text-[11px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {metrics.margin} margin
                </span>
              </div>

              <div className="mt-2">
                <PhoneSparkline values={metrics.spark} />
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[10.5px] dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  Receivables:{' '}
                  <strong className="font-mono text-amber-700 tabular-nums dark:text-amber-400">
                    {metrics.receivables}
                  </strong>
                </span>
                <span className="font-mono text-slate-500 tabular-nums dark:text-slate-400">
                  {saleRecorded ? '69 orders' : metrics.orders}
                </span>
              </div>
            </div>

            {/* Interactive Bottom Sheet inside Phone */}
            <div className="mt-auto flex flex-col rounded-t-[24px] border-t border-slate-200/80 bg-white px-4 pt-2.5 pb-3.5 shadow-[0_-10px_24px_-16px_rgba(15,23,42,0.2)] dark:border-slate-800 dark:bg-slate-900">
              <span
                aria-hidden="true"
                className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-slate-200 dark:bg-slate-700"
              />

              {/* Segmented Sheet Mode Switcher */}
              <div
                role="tablist"
                aria-label="Phone quick actions"
                className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/90"
              >
                {(
                  [
                    { id: 'sale', label: 'Sale', Icon: ShoppingBag },
                    { id: 'stock', label: 'Stock', Icon: Package },
                    { id: 'ai', label: 'AI Ask', Icon: Bot },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const active = phoneTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPhoneTab(id)}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-950 dark:text-emerald-400'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Sheet Body */}
              <div className="mt-3 min-h-[154px]">
                <AnimatePresence mode="wait" initial={false}>
                  {phoneTab === 'sale' && !saleRecorded && (
                    <m.div
                      key="quick-sale-draft"
                      initial={{ opacity: 0, transform: 'translateY(8px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0, transform: 'translateY(-6px)' }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                    >
                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/90 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                        <VendorAvatar
                          seed={CURATED_AVATARS[0].seed}
                          src={CURATED_AVATARS[0].url}
                          alt={CURATED_AVATARS[0].label}
                          initials={CURATED_AVATARS[0].initials}
                          className="h-8 w-8 rounded-full ring-1 ring-slate-200 dark:ring-slate-700"
                          size={32}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            Mama Gold Rice (50kg)
                          </p>
                          <p className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">
                            Amaka Nwosu · Transfer · Qty 1
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-900 tabular-nums dark:text-emerald-400">
                          ₦84,500
                        </span>
                      </div>

                      <p className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
                        <span>Stock after sale: 21 bags</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          Auto-deduct ready
                        </span>
                      </p>

                      <HoldToRecordButton
                        label="Hold to log ₦84,500 sale"
                        onComplete={() => setSaleRecorded(true)}
                      />
                    </m.div>
                  )}

                  {phoneTab === 'sale' && saleRecorded && (
                    <m.div
                      key="quick-sale-done"
                      initial={{ opacity: 0, transform: 'translateY(8px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0, transform: 'translateY(-6px)' }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-3.5 text-center dark:border-emerald-900/70 dark:bg-emerald-950/40"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                        <Check className="h-4.5 w-4.5" strokeWidth={2.8} aria-hidden="true" />
                      </span>
                      <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                        Order VP-1053 Recorded
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        ₦84,500 added · Rice stock updated to 21 bags
                      </p>
                      <button
                        type="button"
                        onClick={() => setSaleRecorded(false)}
                        className="mt-2.5 text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                      >
                        Log another sale
                      </button>
                    </m.div>
                  )}

                  {phoneTab === 'stock' && (
                    <m.div
                      key="quick-stock"
                      initial={{ opacity: 0, transform: 'translateY(8px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0, transform: 'translateY(-6px)' }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            Devon King&apos;s Oil (5L)
                          </p>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                            {restockedOil ? '16 kegs in stock · Healthy' : '6 kegs left · Reorder at 12'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRestockedOil((v) => !v)}
                          className={`rounded-lg px-2.5 py-1 text-[10.5px] font-semibold transition-colors whitespace-nowrap ${
                            restockedOil
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                          }`}
                        >
                          {restockedOil ? 'Restocked' : '+10 Kegs'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            Tomato Paste (Carton)
                          </p>
                          <p className="text-[10.5px] text-rose-700 dark:text-rose-400">
                            0 left · Restock urgently
                          </p>
                        </div>
                        <span className="font-mono text-[10.5px] font-semibold text-rose-700 tabular-nums dark:text-rose-400">
                          Min 10
                        </span>
                      </div>
                    </m.div>
                  )}

                  {phoneTab === 'ai' && (
                    <m.div
                      key="quick-ai"
                      initial={{ opacity: 0, transform: 'translateY(8px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)' }}
                      exit={{ opacity: 0, transform: 'translateY(-6px)' }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="space-y-2"
                    >
                      <div className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-medium text-white dark:bg-slate-800">
                        “{aiItem.q}”
                      </div>
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-[11px] leading-relaxed text-slate-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-slate-200">
                        {aiItem.a}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiIndex((i) => (i + 1) % AI_QUICK_QA.length)}
                        className="text-[10.5px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Try next business question →
                      </button>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </m.div>
  );
}

interface LandingHeroProps {
  heroRange: HeroRange;
  onRangeChange: (r: HeroRange) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

const HIDDEN_STATE = { opacity: 0.01, transform: 'translateY(16px)' };

export function LandingHero({ heroRange, onRangeChange, onOpenAuth }: LandingHeroProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [hubIndex, setHubIndex] = useState(0);
  const [ledgerCount, setLedgerCount] = useState(HUB_TICKER[0].ledgers);

  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  // Choreograph the hero copy right as the splash finishes on both mobile and desktop.
  const [waitSplash] = useState(() => !introPlayedThisVisit);
  const start = reduceMotion || !waitSplash ? 0 : INTRO_AT;
  const at = (offset: number) => (reduceMotion ? 0 : start + offset);

  const rise = (delay: number) => ({
    initial: HIDDEN_STATE,
    animate: hydrated ? { opacity: 1, transform: 'translateY(0px)' } : HIDDEN_STATE,
    transition: { duration: 0.68, delay, ease: EASE_OUT },
  });

  // Rotate Line 2 headline phrases smoothly
  useEffect(() => {
    if (reduceMotion) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const initialTimer = setTimeout(() => {
      setPhraseIndex((idx) => (idx + 1) % HERO_PHRASES.length);
      intervalId = setInterval(() => {
        setPhraseIndex((idx) => (idx + 1) % HERO_PHRASES.length);
      }, 3100);
    }, (start + 2.2) * 1000);

    return () => {
      clearTimeout(initialTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [reduceMotion, start]);

  // Rotate Nigerian commercial hub ticker cleanly
  useEffect(() => {
    if (reduceMotion) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      if (tick % 3 === 0) {
        const nextHub = Math.floor(tick / 3) % HUB_TICKER.length;
        setHubIndex(nextHub);
        setLedgerCount(HUB_TICKER[nextHub].ledgers);
      } else {
        setLedgerCount((prev) => prev + Math.round(Math.random() * 8) - 2);
      }
    }, 1400);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const socialProofAvatars = CURATED_AVATARS.slice(0, 4);

  return (
    <div className="relative isolate overflow-x-clip pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20">
      <VendorPilotHeroBackdrop start={start} reduceMotion={reduceMotion} />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Left Column: Choreographed Editorial Copy */}
          <div className="flex flex-col items-start text-left lg:col-span-7">
            {/* Live Nigerian SME Hub Activity Strip (clean unboxed badge + animated ticker, zero pulsing dot) */}
            <m.div
              {...rise(at(0))}
              className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/85 py-1.5 pr-3.5 pl-1.5 text-xs shadow-2xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85"
            >
              <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-emerald-400 dark:bg-emerald-600 dark:text-white">
                ACTIVE
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                <span className="text-slate-950 dark:text-white">
                  <AnimatedCounter value={ledgerCount} />
                </span>{' '}
                <span>ledgers tracked in </span>
                <span className="relative inline-grid overflow-hidden align-bottom">
                  {HUB_TICKER.map((item) => (
                    <span
                      key={item.city}
                      aria-hidden="true"
                      className="invisible col-start-1 row-start-1 font-semibold"
                    >
                      {item.city}
                    </span>
                  ))}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={HUB_TICKER[hubIndex].city}
                      initial={{ transform: 'translateY(100%)', opacity: 0 }}
                      animate={{ transform: 'translateY(0%)', opacity: 1 }}
                      exit={{ transform: 'translateY(-100%)', opacity: 0 }}
                      transition={{ duration: 0.42, ease: EASE_OUT }}
                      className="col-start-1 row-start-1 inline-block font-semibold text-slate-950 dark:text-white"
                    >
                      {HUB_TICKER[hubIndex].city}
                    </m.span>
                  </AnimatePresence>
                </span>
              </span>
            </m.div>

            {/* Kinetic Two-Line Editorial Headline */}
            <h1 className="mt-5 font-editorial text-[2.6rem] leading-[1.08] font-bold tracking-normal text-slate-950 dark:text-white sm:text-[3.5rem] lg:text-[4rem]">
              <span className="block overflow-hidden pb-1">
                <m.span
                  initial={{ transform: 'translateY(105%)' }}
                  animate={{ transform: hydrated ? 'translateY(0%)' : 'translateY(105%)' }}
                  transition={{ duration: 0.85, delay: at(0.08), ease: EASE_OUT }}
                  className="block"
                >
                  Run On Facts,
                </m.span>
              </span>
              <span className="sr-only">not guesswork.</span>
              <span
                aria-hidden="true"
                className="block min-h-[1.15em] pb-1 text-emerald-600 dark:text-emerald-400"
              >
                <m.span
                  initial={{ transform: 'translateY(105%)' }}
                  animate={{ transform: hydrated ? 'translateY(0%)' : 'translateY(105%)' }}
                  transition={{ duration: 0.85, delay: at(0.2), ease: EASE_OUT }}
                  className="block"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <KineticPhrase key={HERO_PHRASES[phraseIndex]} text={HERO_PHRASES[phraseIndex]} />
                  </AnimatePresence>
                </m.span>
              </span>
            </h1>

            {/* Hand-styled Lead Paragraph */}
            <m.p
              {...rise(at(0.3))}
              className="mt-4 max-w-xl font-hand text-xl leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[1.42rem]"
            >
              VendorPilot AI connects your sales, expenses, inventory, and customer balances in one
              private cloud ledger—showing what&apos;s profitable, who owes you, and what needs
              restocking.
            </m.p>

            {/* Primary Rolling-Fill CTA + Secondary Frosted Ghost CTA */}
            <m.div
              {...rise(at(0.42))}
              className="mt-7 grid w-full gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center"
            >
              <RollingCtaButton
                label="Log in / Sign up"
                hoverLabel="Open workspace"
                onClick={() => onOpenAuth('signup')}
                className="w-full justify-between sm:w-auto"
              />
              <a href="#built-for" className="vp-ghost w-full sm:w-auto">
                <span>Who it&apos;s for</span>
                <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </a>
            </m.div>

            {/* Clean Unboxed Capabilities Sub-Caption */}
            <m.p
              {...rise(at(0.48))}
              className="mt-3.5 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              NGN (₦) default <span aria-hidden="true">·</span> Private Cloud Sync{' '}
              <span aria-hidden="true">·</span> AI Business Assistant
            </m.p>

            {/* Social Proof Row with Curated DiceBear Adventurer-Neutral SVG Avatars */}
            <m.div
              {...rise(at(0.56))}
              className="mt-7 flex flex-wrap items-center gap-4 border-t border-slate-200/70 pt-6 dark:border-slate-800/80"
            >
              <div className="flex items-center">
                {socialProofAvatars.map((avatar, index) => {
                  const zClasses = ['z-40', 'z-30', 'z-20', 'z-10'];
                  return (
                    <div
                      key={avatar.id}
                      className={`relative -ml-2.5 first:ml-0 ${zClasses[index] ?? 'z-10'}`}
                    >
                      <VendorAvatar
                        seed={avatar.seed}
                        src={avatar.url}
                        alt={avatar.label}
                        initials={avatar.initials}
                        size={38}
                        className="h-9 w-9 rounded-full border-2 border-white shadow-xs dark:border-[#090e17]"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="flex gap-0.5" aria-label="4.9 out of 5 rating">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <m.span
                        key={idx}
                        initial={{ transform: 'scale(0.45)', opacity: 0.25 }}
                        animate={
                          hydrated
                            ? { transform: 'scale(1)', opacity: 1 }
                            : { transform: 'scale(0.45)', opacity: 0.25 }
                        }
                        transition={{
                          type: 'spring',
                          stiffness: 480,
                          damping: 18,
                          delay: at(0.68 + idx * 0.07),
                        }}
                      >
                        <Star
                          aria-hidden="true"
                          className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500"
                        />
                      </m.span>
                    ))}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                    4.9
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trusted by Nigerian SME owners
                </p>
              </div>

              <span
                aria-hidden="true"
                className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 sm:block"
              />

              <div className="hidden leading-tight sm:block">
                <p className="font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white">
                  &lt; 2 min
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">to first live ledger</p>
              </div>
            </m.div>
          </div>

          {/* Right Column: Interactive VendorPilot AI Phone Cockpit */}
          <div className="flex justify-center lg:col-span-5 lg:justify-end">
            <VendorPilotPhoneCockpit
              heroRange={heroRange}
              onRangeChange={onRangeChange}
              reduceMotion={reduceMotion}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
