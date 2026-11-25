import React, { useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, LogOut, Sparkles, Store, User } from 'lucide-react';
import { CurrencyCode } from '../types/business';
import { BUSINESS_TYPE_SUGGESTIONS, CURRENCY_OPTIONS } from '../data/constants';
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

const GOAL_OPTIONS = [
  { id: 'sales', title: 'Track daily sales & revenue', desc: 'Monitor daily income and order logs effortlessly' },
  { id: 'inventory', title: 'Manage inventory & stock alerts', desc: 'Prevent stockouts and track products in real-time' },
  { id: 'expenses', title: 'Log operating expenses & profit', desc: 'Keep tabs on business costs and net profit margins' },
  { id: 'assistant', title: 'Ask AI Business Assistant', desc: 'Get instant answers and financial insights from AI' },
];

export function OnboardingView() {
  const { user, createBusinessProfile, signOutUser } = useBusiness();
  const [step, setStep] = useState<'welcome' | 1 | 2 | 3 | 4 | 5 | 'complete'>('welcome');
  
  const [name, setName] = useState(user?.displayName ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPE_SUGGESTIONS[0]);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('NGN');
  const [primaryGoal, setPrimaryGoal] = useState('sales');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = extractFirstName(name, user?.email);
  const fullName = formatDisplayName(name, user?.email);
  const initials = getUserInitials(name, user?.email);
  const seed = getUserAvatarSeed(name, user?.email, user?.uid);
  const avatarUrl = getUserAvatarUrl(name, user?.email, user?.uid);

  const handleFinishOnboarding = async () => {
    if (!name.trim() || !businessName.trim()) {
      setError('Please provide your name and business name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createBusinessProfile({
        name: name.trim(),
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        currencyCode,
        phone: '',
        address: '',
      });
      setStep('complete');
    } catch {
      setError('Could not save your business profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <div className="vp-dark-auto flex min-h-[100dvh] flex-col justify-between bg-slate-50 px-4 py-8 dark:bg-[#090e17] sm:px-6">
          {/* Top Bar */}
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700 shadow-sm"
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-editorial text-base font-semibold tracking-normal text-slate-900 dark:text-white">
                VendorPilot <span className="text-emerald-600 dark:text-emerald-400">AI</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggleButton />
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>

          {/* Center Card Container */}
          <div className="mx-auto my-auto w-full max-w-xl py-6">
            <AnimatePresence mode="wait">
              {/* WELCOME SCREEN */}
              {step === 'welcome' && (
                <m.div
                  key="welcome"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <div className="mx-auto mb-6 inline-flex rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/50">
                    <VendorAvatar
                      seed={seed}
                      src={avatarUrl}
                      alt={fullName}
                      initials={initials}
                      size={64}
                      showInitialsBadge
                      badgeSize="md"
                      className="h-16 w-16 rounded-xl"
                    />
                  </div>

                  <h1 className="font-editorial text-3xl font-bold tracking-normal text-slate-900 dark:text-white sm:text-4xl">
                    Welcome aboard! 👋
                  </h1>
                  <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                    We&apos;re happy to have you here. Let&apos;s get to know you a little better so we can personalize your experience.
                  </p>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <span>Let&apos;s get started</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </m.div>
              )}

              {/* STEP 1: NAME */}
              {step === 1 && (
                <m.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-9"
                >
                  <div className="mb-6 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Step 1 of 5</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/60">Personal Info</span>
                  </div>

                  <h2 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What should we call you?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    We&apos;ll use your name to personalize your dashboard and AI assistant greetings.
                  </p>

                  <div className="mt-6">
                    <div className="relative">
                      <User className="absolute top-3.5 left-3.5 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Tobi Akala"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-base text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>
                  </div>

                  {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep('welcome')}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!name.trim()) {
                          setError('Please enter your name.');
                          return;
                        }
                        setError(null);
                        setStep(2);
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </m.div>
              )}

              {/* STEP 2: BUSINESS NAME */}
              {step === 2 && (
                <m.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-9"
                >
                  <div className="mb-6 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Step 2 of 5</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/60">Business Setup</span>
                  </div>

                  <h2 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What is your business name?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Hi {firstName}, this will appear on your financial ledgers and reports.
                  </p>

                  <div className="mt-6">
                    <div className="relative">
                      <Store className="absolute top-3.5 left-3.5 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        maxLength={140}
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g., EkoMart Wholesale Store"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-base text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>
                  </div>

                  {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!businessName.trim()) {
                          setError('Please enter your business name.');
                          return;
                        }
                        setError(null);
                        setStep(3);
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </m.div>
              )}

              {/* STEP 3: BUSINESS CATEGORY */}
              {step === 3 && (
                <m.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-9"
                >
                  <div className="mb-6 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Step 3 of 5</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/60">Category</span>
                  </div>

                  <h2 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What type of business do you run?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Select the industry that best matches your operations.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {BUSINESS_TYPE_SUGGESTIONS.map((type) => {
                      const selected = businessType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setBusinessType(type)}
                          className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                          }`}
                        >
                          <span className="text-sm font-semibold">{type}</span>
                          {selected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </m.div>
              )}

              {/* STEP 4: CURRENCY */}
              {step === 4 && (
                <m.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-9"
                >
                  <div className="mb-6 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Step 4 of 5</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/60">Currency</span>
                  </div>

                  <h2 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What currency do you transact in?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    All sales, expenses, and profit reports will use your selected currency symbol.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {CURRENCY_OPTIONS.map((opt) => {
                      const selected = currencyCode === opt.code;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setCurrencyCode(opt.code as CurrencyCode)}
                          className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                          }`}
                        >
                          <div>
                            <p className="text-base font-bold font-mono">{opt.symbol}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{opt.label}</p>
                          </div>
                          {selected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md transition-all hover:bg-emerald-700"
                    >
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </m.div>
              )}

              {/* STEP 5: PRIMARY GOAL */}
              {step === 5 && (
                <m.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-9"
                >
                  <div className="mb-6 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Step 5 of 5</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-950/60">Primary Goal</span>
                  </div>

                  <h2 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    What would you like to achieve first?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    We&apos;ll customize your dashboard highlights based on your priority.
                  </p>

                  <div className="mt-5 space-y-3">
                    {GOAL_OPTIONS.map((goal) => {
                      const selected = primaryGoal === goal.id;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setPrimaryGoal(goal.id)}
                          className={`flex w-full items-start justify-between rounded-xl border p-4 text-left transition-all ${
                            selected
                              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                              : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold">{goal.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{goal.desc}</p>
                          </div>
                          {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleFinishOnboarding()}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md transition-all hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <span>{submitting ? 'Personalizing...' : 'Complete Setup'}</span>
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                </m.div>
              )}

              {/* COMPLETION SCREEN */}
              {step === 'complete' && (
                <m.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-10"
                >
                  <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900/50">
                    <Sparkles className="h-8 w-8" />
                  </div>

                  <h1 className="font-editorial text-3xl font-bold tracking-normal text-slate-900 dark:text-white sm:text-4xl">
                    You&apos;re all set! 🎉
                  </h1>
                  <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                    We&apos;ve personalized your experience based on your answers. Welcome to your new workspace, <span className="font-semibold text-slate-900 dark:text-white">{firstName}</span>!
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      // Trigger state refresh/navigation to dashboard
                      window.location.reload();
                    }}
                    className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-lg"
                  >
                    <span>Go to my dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </m.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-center text-xs text-slate-400 dark:text-slate-600">
            VendorPilot AI · Secure Cloud Ledger
          </div>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}
