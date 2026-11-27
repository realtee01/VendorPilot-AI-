import React, { useEffect, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Briefcase,
  Check,
  LogOut,
  Package,
  Receipt,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react';
import {
  CurrencyCode,
  OnboardingExperienceLevel,
  OnboardingPrimaryGoal,
  OnboardingUsageType,
} from '../types/business';
import { BUSINESS_TYPE_SUGGESTIONS, CURRENCY_OPTIONS, getCurrencySymbol } from '../data/constants';
import { useBusiness } from '../context/BusinessContext';
import { ThemeToggleButton } from '../context/ThemeContext';
import {
  extractFirstName,
  formatDisplayName,
  getUserAvatarSeed,
  getUserAvatarUrl,
  getUserInitials,
} from '../utils/avatars';
import { VendorAvatar } from './VendorAvatar';

type OnboardingStep = 'welcome' | 1 | 2 | 3 | 4 | 5 | 'complete';

interface OnboardingDraft {
  step: Exclude<OnboardingStep, 'complete'>;
  name: string;
  usageType: OnboardingUsageType;
  businessName: string;
  businessType: string;
  currencyCode: CurrencyCode;
  experienceLevel: OnboardingExperienceLevel;
  primaryGoal: OnboardingPrimaryGoal;
}

interface OnboardingViewProps {
  onStartCompletion: () => void;
  onEnterDashboard: (initialGoal?: OnboardingPrimaryGoal) => void;
}

const TOTAL_STEPS = 5;

const USAGE_OPTIONS: Array<{
  id: OnboardingUsageType;
  title: string;
  desc: string;
}> = [
  {
    id: 'business',
    title: 'For my business',
    desc: 'Running a retail shop, wholesale store, or growing brand',
  },
  {
    id: 'personal',
    title: 'Just for myself',
    desc: 'Managing my solo hustle, freelance sales, or personal stock',
  },
];

const EXPERIENCE_OPTIONS: Array<{
  id: OnboardingExperienceLevel;
  title: string;
  desc: string;
}> = [
  {
    id: 'beginner',
    title: 'This is my first time',
    desc: 'Keep things simple and show helpful getting-started tips',
  },
  {
    id: 'spreadsheet',
    title: 'Mostly notebooks or spreadsheets',
    desc: 'I track things manually today and want a faster, cleaner way',
  },
  {
    id: 'experienced',
    title: 'Yes, I use business software regularly',
    desc: 'I am comfortable with dashboards and ready to dive right in',
  },
];

const GOAL_OPTIONS: Array<{
  id: OnboardingPrimaryGoal;
  title: string;
  desc: string;
  icon: typeof ShoppingBag;
}> = [
  {
    id: 'sales',
    title: 'Track daily sales & customer orders',
    desc: 'Log paid, partial, or credit sales and watch revenue add up automatically',
    icon: ShoppingBag,
  },
  {
    id: 'inventory',
    title: 'Manage inventory & stock alerts',
    desc: 'Know what is selling fast and get alerts before products run out',
    icon: Package,
  },
  {
    id: 'expenses',
    title: 'Monitor expenses & where money goes',
    desc: 'Log costs like rent, salaries, or supplies with visual category charts',
    icon: Receipt,
  },
  {
    id: 'assistant',
    title: 'Ask the AI Business Assistant',
    desc: 'Get plain-English answers about your profit, cashflow, and stock anytime',
    icon: Bot,
  },
];

const STEP_EASE = [0.22, 1, 0.36, 1] as const;

function readDraft(storageKey: string): Partial<OnboardingDraft> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function OnboardingView({
  onStartCompletion,
  onEnterDashboard,
}: OnboardingViewProps) {
  const { user, createBusinessProfile, signOutUser } = useBusiness();
  const draftKey = user?.uid ? `vp_onboarding_draft_${user.uid}` : 'vp_onboarding_draft_guest';

  const savedDraft = readDraft(draftKey);

  const [step, setStep] = useState<OnboardingStep>(() => {
    const restored = savedDraft?.step;
    if (
      restored === 'welcome' ||
      restored === 1 ||
      restored === 2 ||
      restored === 3 ||
      restored === 4 ||
      restored === 5
    ) {
      return restored;
    }
    return 'welcome';
  });

  const [name, setName] = useState<string>(() => savedDraft?.name ?? user?.displayName ?? '');
  const [usageType, setUsageType] = useState<OnboardingUsageType>(
    () => savedDraft?.usageType ?? 'business'
  );
  const [businessName, setBusinessName] = useState<string>(() => savedDraft?.businessName ?? '');
  const [businessType, setBusinessType] = useState<string>(
    () => savedDraft?.businessType ?? BUSINESS_TYPE_SUGGESTIONS[0]
  );
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(
    () => savedDraft?.currencyCode ?? 'NGN'
  );
  const [experienceLevel, setExperienceLevel] = useState<OnboardingExperienceLevel>(
    () => savedDraft?.experienceLevel ?? 'spreadsheet'
  );
  const [primaryGoal, setPrimaryGoal] = useState<OnboardingPrimaryGoal>(
    () => savedDraft?.primaryGoal ?? 'sales'
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBusinessLabel, setSavedBusinessLabel] = useState('');

  // Persist onboarding progress automatically so users can resume if they leave mid-flow
  useEffect(() => {
    if (step === 'complete' || typeof window === 'undefined') return;
    try {
      const draft: OnboardingDraft = {
        step,
        name,
        usageType,
        businessName,
        businessType,
        currencyCode,
        experienceLevel,
        primaryGoal,
      };
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Ignore storage errors in restricted private browsing
    }
  }, [
    draftKey,
    step,
    name,
    usageType,
    businessName,
    businessType,
    currencyCode,
    experienceLevel,
    primaryGoal,
  ]);

  const firstName = extractFirstName(name, user?.email);
  const fullName = formatDisplayName(name, user?.email);
  const initials = getUserInitials(name, user?.email);
  const seed = getUserAvatarSeed(name, user?.email, user?.uid);
  const avatarUrl = getUserAvatarUrl(name, user?.email, user?.uid);

  const numericStep = typeof step === 'number' ? step : 0;
  const progressPct = numericStep > 0 ? Math.round((numericStep / TOTAL_STEPS) * 100) : 0;

  const fallbackWorkspaceName =
    usageType === 'personal' ? `${firstName}'s Workspace` : `${firstName}'s Business`;

  const goNextFromName = () => {
    if (!name.trim()) {
      setError('Please tell us what we should call you.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const goNextFromUsage = (skipName = false) => {
    setError(null);
    if (skipName && !businessName.trim()) {
      setBusinessName(fallbackWorkspaceName);
    }
    setStep(3);
  };

  const handleCompleteOnboarding = async (overrideGoal?: OnboardingPrimaryGoal) => {
    if (submitting) return;

    const finalName = name.trim() || fullName || 'Business Owner';
    const finalBusinessName = businessName.trim() || fallbackWorkspaceName;
    const finalBusinessType = businessType.trim() || BUSINESS_TYPE_SUGGESTIONS[0];
    const finalGoal = overrideGoal ?? primaryGoal;

    setSubmitting(true);
    setError(null);
    onStartCompletion();

    try {
      await createBusinessProfile({
        name: finalName,
        businessName: finalBusinessName,
        businessType: finalBusinessType,
        currencyCode,
        phone: '',
        address: '',
        usageType,
        experienceLevel,
        primaryGoal: finalGoal,
      });

      setSavedBusinessLabel(finalBusinessName);

      try {
        window.localStorage.removeItem(draftKey);
        if (user?.uid) {
          window.sessionStorage.setItem(`vp_workspace_welcome_${user.uid}`, 'shown');
        }
      } catch {
        // Ignore storage errors
      }

      setStep('complete');
    } catch {
      setError('We could not save your setup right now. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedGoalMeta = GOAL_OPTIONS.find((g) => g.id === primaryGoal) ?? GOAL_OPTIONS[0];

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <div className="vp-dark-auto flex min-h-[100dvh] flex-col justify-between bg-slate-50 px-4 py-6 dark:bg-[#090e17] sm:px-6 sm:py-8">
          {/* Clean Top Bar */}
          <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4.5 w-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-editorial text-base font-semibold tracking-normal text-slate-900 dark:text-white whitespace-nowrap">
                VendorPilot <span className="text-emerald-600 dark:text-emerald-400">AI</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </header>

          {/* Conversational Stage */}
          <main className="mx-auto my-auto w-full max-w-xl py-8">
            {/* Subtle Progress Indicator during the 5 question steps */}
            {numericStep > 0 && (
              <div className="mb-5 px-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>
                    Step {numericStep} of {TOTAL_STEPS}
                  </span>
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {progressPct}%
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
                  role="progressbar"
                  aria-valuenow={numericStep}
                  aria-valuemin={1}
                  aria-valuemax={TOTAL_STEPS}
                  aria-label={`Onboarding step ${numericStep} of ${TOTAL_STEPS}`}
                >
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* WELCOME SCREEN */}
              {step === 'welcome' && (
                <m.section
                  key="welcome"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-11"
                >
                  <div className="mx-auto mb-6 inline-flex rounded-2xl bg-emerald-50/90 p-2.5 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/60">
                    <VendorAvatar
                      seed={seed}
                      src={avatarUrl}
                      alt={`${fullName} (${initials})`}
                      initials={initials}
                      size={68}
                      showInitialsBadge
                      badgeSize="md"
                      className="h-16 w-16 rounded-xl"
                    />
                  </div>

                  <h1 className="font-editorial text-3xl leading-tight font-bold tracking-normal text-slate-900 dark:text-white sm:text-4xl">
                    Welcome aboard! 👋
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    We&apos;re happy to have you here. Let&apos;s get to know you a little better so
                    we can personalize your experience.
                  </p>

                  {user?.email && (
                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                      Signed in as{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {user.email}
                      </span>
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <span>Let&apos;s get started</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                    Takes less than a minute · You can change any answer later
                  </p>
                </m.section>
              )}

              {/* STEP 1: WHAT SHOULD WE CALL YOU? */}
              {step === 1 && (
                <m.section
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <h2 className="font-editorial text-2xl leading-tight font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What should we call you?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    We&apos;ll use your name to greet you in your workspace and personalize your AI
                    assistant.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      goNextFromName();
                    }}
                    className="mt-6"
                    noValidate
                  >
                    <label htmlFor="onb-user-name" className="sr-only">
                      Your name
                    </label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="onb-user-name"
                        type="text"
                        autoFocus
                        maxLength={120}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setError(null);
                        }}
                        placeholder="e.g., Naomi Rose"
                        className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-4 pl-12 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>

                    {error && (
                      <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                      </p>
                    )}

                    <div className="mt-8 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setStep('welcome');
                        }}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Back</span>
                      </button>

                      <button
                        type="submit"
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </form>
                </m.section>
              )}

              {/* STEP 2: YOURSELF OR A BUSINESS + WORKSPACE NAME */}
              {step === 2 && (
                <m.section
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <h2 className="font-editorial text-2xl leading-tight font-bold text-slate-900 dark:text-white sm:text-3xl">
                    Nice to meet you, {firstName}! Are you using this for yourself or a business?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    This helps us tailor your dashboard labels and reports.
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {USAGE_OPTIONS.map((option) => {
                      const selected = usageType === option.id;
                      const Icon = option.id === 'business' ? Briefcase : User;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setUsageType(option.id)}
                          className={`flex min-h-[96px] flex-col justify-between rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/75 text-slate-900 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                selected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                              }`}
                            >
                              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                            </span>
                            {selected && (
                              <Check
                                className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-semibold">{option.title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {option.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      goNextFromUsage(false);
                    }}
                    className="mt-5"
                    noValidate
                  >
                    <label
                      htmlFor="onb-biz-name"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-300"
                    >
                      {usageType === 'business'
                        ? 'What is your business or store name?'
                        : 'What should we name your workspace? (Optional)'}
                    </label>
                    <div className="relative mt-2">
                      <Store
                        className="pointer-events-none absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="onb-biz-name"
                        type="text"
                        maxLength={140}
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder={
                          usageType === 'business'
                            ? 'e.g., RoseMart Retail & Wholesale'
                            : `e.g., ${fallbackWorkspaceName}`
                        }
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pr-4 pl-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        <span>Back</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {!businessName.trim() && (
                          <button
                            type="button"
                            onClick={() => goNextFromUsage(true)}
                            className="inline-flex h-11 items-center rounded-xl px-3.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          >
                            Skip
                          </button>
                        )}
                        <button
                          type="submit"
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                        >
                          <span>Continue</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </form>
                </m.section>
              )}

              {/* STEP 3: BUSINESS TYPE & CURRENCY */}
              {step === 3 && (
                <m.section
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <h2 className="font-editorial text-2xl leading-tight font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What kind of business or trade do you run?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Pick the closest fit and your primary currency so numbers look right from day
                    one.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {BUSINESS_TYPE_SUGGESTIONS.map((type) => {
                      const selected = businessType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setBusinessType(type)}
                          className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/75 text-emerald-950 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="text-xs font-semibold leading-snug sm:text-sm">
                            {type}
                          </span>
                          {selected && (
                            <Check
                              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Currency quick selector */}
                  <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Preferred currency
                    </p>
                    <div
                      className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4"
                      role="group"
                      aria-label="Preferred currency"
                    >
                      {CURRENCY_OPTIONS.map((opt) => {
                        const selected = currencyCode === opt.code;
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setCurrencyCode(opt.code)}
                            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
                              selected
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                            }`}
                          >
                            <span className="font-mono text-sm">{opt.symbol}</span>
                            <span>{opt.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="inline-flex h-11 items-center rounded-xl px-3.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </m.section>
              )}

              {/* STEP 4: EXPERIENCE LEVEL */}
              {step === 4 && (
                <m.section
                  key="step-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <h2 className="font-editorial text-2xl leading-tight font-bold text-slate-900 dark:text-white sm:text-3xl">
                    Have you used a platform like this before?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    No right or wrong answer — this just helps us keep things comfortable for you.
                  </p>

                  <div className="mt-6 space-y-3">
                    {EXPERIENCE_OPTIONS.map((opt) => {
                      const selected = experienceLevel === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setExperienceLevel(opt.id)}
                          className={`flex min-h-[64px] w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/75 text-emerald-950 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold">{opt.title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {opt.desc}
                            </p>
                          </div>
                          {selected && (
                            <Check
                              className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="inline-flex h-11 items-center rounded-xl px-3.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </m.section>
              )}

              {/* STEP 5: FIRST GOAL */}
              {step === 5 && (
                <m.section
                  key="step-5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.24, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <h2 className="font-editorial text-2xl leading-tight font-bold text-slate-900 dark:text-white sm:text-3xl">
                    Last question — what would you like to achieve first?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    We&apos;ll highlight this right on your dashboard so you can get a quick win.
                  </p>

                  <div className="mt-6 space-y-3">
                    {GOAL_OPTIONS.map((goal) => {
                      const selected = primaryGoal === goal.id;
                      const GoalIcon = goal.icon;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setPrimaryGoal(goal.id)}
                          className={`flex min-h-[68px] w-full items-center justify-between gap-3.5 rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/75 text-emerald-950 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <span
                              aria-hidden="true"
                              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                selected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                              }`}
                            >
                              <GoalIcon className="h-4.5 w-4.5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">{goal.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                {goal.desc}
                              </p>
                            </div>
                          </div>
                          {selected && (
                            <Check
                              className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="mt-8 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setStep(4)}
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Back</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleCompleteOnboarding('sales')}
                        className="inline-flex h-11 items-center rounded-xl px-3.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleCompleteOnboarding()}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <span>{submitting ? 'Setting up...' : 'Finish Setup'}</span>
                        <VendorAvatar
                          seed={seed}
                          src={avatarUrl}
                          alt=""
                          initials={initials}
                          size={20}
                          className="h-5 w-5 rounded-full ring-1 ring-white/50"
                        />
                      </button>
                    </div>
                  </div>
                </m.section>
              )}

              {/* COMPLETION SCREEN */}
              {step === 'complete' && (
                <m.section
                  key="complete"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.28, ease: STEP_EASE }}
                  className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-11"
                >
                  <div className="mx-auto mb-5 inline-flex rounded-2xl bg-emerald-50/90 p-2.5 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/60">
                    <VendorAvatar
                      seed={seed}
                      src={avatarUrl}
                      alt={`${fullName} (${initials})`}
                      initials={initials}
                      size={68}
                      showInitialsBadge
                      badgeSize="md"
                      className="h-16 w-16 rounded-xl"
                    />
                  </div>

                  <h1 className="font-editorial text-3xl leading-tight font-bold tracking-normal text-slate-900 dark:text-white sm:text-4xl">
                    You&apos;re all set! 🎉
                  </h1>
                  <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    We&apos;ve personalized your experience based on your answers. Welcome to your
                    new workspace,{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {firstName}
                    </span>
                    !
                  </p>

                  {/* Clean unboxed summary of saved personalization */}
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-y border-slate-100 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {savedBusinessLabel || businessName || fallbackWorkspaceName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {currencyCode} ({getCurrencySymbol(currencyCode)})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>First focus: {selectedGoalMeta.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEnterDashboard(primaryGoal)}
                    className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <span>Go to my dashboard</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </m.section>
              )}
            </AnimatePresence>
          </main>

          <footer className="text-center text-xs text-slate-400 dark:text-slate-500">
            VendorPilot AI · Your private business workspace
          </footer>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}
