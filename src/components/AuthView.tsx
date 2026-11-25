import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { ThemeToggleButton } from '../context/ThemeContext';
import {
  mapFirebaseAuthError,
  validateResetEmail,
  validateSignInForm,
  validateSignUpForm,
} from '../utils/authValidation';

type AuthMode = 'signin' | 'signup' | 'reset';

interface AuthViewProps {
  initialMode?: 'signin' | 'signup';
  onBackToHome?: () => void;
}

export function AuthView({ initialMode = 'signin', onBackToHome }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = submittingEmail || submittingGoogle;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleGoogleAuth = async () => {
    setSubmittingGoogle(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmittingGoogle(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'reset') {
      const check = validateResetEmail(email);
      if (!check.valid) {
        setFieldErrors(check.errors);
        return;
      }
      setFieldErrors({});
      setSubmittingEmail(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice(
          'If an account exists for that email address, a password reset link has been sent to your inbox.'
        );
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'auth/user-not-found') {
          setNotice(
            'If an account exists for that email address, a password reset link has been sent to your inbox.'
          );
        } else {
          setError(mapFirebaseAuthError(err));
        }
      } finally {
        setSubmittingEmail(false);
      }
      return;
    }

    if (mode === 'signin') {
      const check = validateSignInForm({ email, password });
      if (!check.valid) {
        setFieldErrors(check.errors);
        return;
      }
      setFieldErrors({});
      setSubmittingEmail(true);
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (err: unknown) {
        setError(mapFirebaseAuthError(err));
      } finally {
        setSubmittingEmail(false);
      }
      return;
    }

    // Sign Up flow
    const check = validateSignUpForm({ fullName, email, password, confirmPassword });
    if (!check.valid) {
      setFieldErrors(check.errors);
      return;
    }
    setFieldErrors({});
    setSubmittingEmail(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Verification view allows resending if initial send hits a transient limit
      }
    } catch (err: unknown) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmittingEmail(false);
    }
  };

  return (
    <div className="vp-dark-auto min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090e17] dark:text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-12 lg:px-10">
        {/* Left Editorial / Product Column */}
        <div className="space-y-8 lg:col-span-6">
          <div className="flex items-center justify-between gap-4">
            {onBackToHome ? (
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Back to overview</span>
              </button>
            ) : (
              <span />
            )}
            <ThemeToggleButton />
          </div>

          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-editorial text-lg font-semibold tracking-normal text-slate-900 dark:text-white">
              VendorPilot <span className="text-emerald-600 dark:text-emerald-400">AI</span>
            </span>
          </div>

          <div className="max-w-xl space-y-4">
            <h1 className="font-editorial text-3xl leading-[1.15] font-bold tracking-normal text-slate-900 sm:text-4xl">
              Run your SME sales, expenses, and stock from one secure ledger.
            </h1>
            <p className="font-hand text-xl leading-relaxed text-slate-600">
              Built for Nigerian wholesale and retail businesses. Track every Naira of revenue,
              monitor unpaid customer balances, control reorder levels, and get AI business insights
              backed by your private cloud records.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-1 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-3">
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">Sales & Receivables</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Log paid, partial, and credit orders with automatic stock deduction.
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">Expenses & Stock</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Track diesel, logistics, and restock costs alongside low-stock alerts.
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">Private Cloud Sync</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Every record is stored in Cloud Firestore and isolated to your account.
              </p>
            </div>
          </div>
        </div>

        {/* Right Authentication Card */}
        <div className="lg:col-span-6 lg:pl-4">
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-7 sm:p-8">
            {/* Mode Switcher Tabs (Sign In / Sign Up) */}
            {mode !== 'reset' && (
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  onClick={() => switchMode('signin')}
                  disabled={busy}
                  className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                    mode === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signup'}
                  onClick={() => switchMode('signup')}
                  disabled={busy}
                  className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            <h2 className="font-display text-xl font-semibold text-slate-900">
              {mode === 'signin'
                ? 'Welcome back'
                : mode === 'signup'
                  ? 'Create your VendorPilot account'
                  : 'Reset your password'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'signin'
                ? 'Sign in with Google (Gmail) or your email and password.'
                : mode === 'signup'
                  ? 'Register with Google (Gmail) or create a new email and password login.'
                  : 'Enter the email address for your account and we will send a reset link.'}
            </p>

            {notice && (
              <div
                role="status"
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-relaxed text-emerald-900"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Google / Gmail OAuth Button */}
            {mode !== 'reset' && (
              <>
                <button
                  type="button"
                  onClick={() => void handleGoogleAuth()}
                  disabled={busy}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95Z"
                    />
                  </svg>
                  <span>
                    {submittingGoogle
                      ? 'Connecting to Google...'
                      : mode === 'signin'
                        ? 'Continue with Google (Gmail)'
                        : 'Sign up with Google (Gmail)'}
                  </span>
                </button>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-400">
                    or use email &amp; password
                  </span>
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                </div>
              </>
            )}

            {/* Email & Password Form */}
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-full-name" className="block text-xs font-medium text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="auth-full-name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    placeholder="e.g., Chinedu Okafor"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.fullName}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700">
                  Email Address (Gmail or Business Email)
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  maxLength={160}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  placeholder="name@gmail.com"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>
                )}
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      maxLength={128}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, password: '' }));
                      }}
                      placeholder={mode === 'signin' ? 'Enter your password' : 'At least 8 characters'}
                      className="h-10 w-full rounded-lg border border-slate-200 pr-10 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute top-1/2 right-2.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>
                  ) : mode === 'signup' ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Use at least 8 characters with at least one letter and one number.
                    </p>
                  ) : null}
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }}
                    placeholder="Re-enter your password"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {submittingEmail
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : mode === 'signup'
                      ? 'Creating account...'
                      : 'Sending reset link...'
                  : mode === 'signin'
                    ? 'Sign In with Email'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="flex h-9 w-full items-center justify-center text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Back to Sign In
                </button>
              )}
            </form>

            <div className="mt-6 flex items-start gap-2.5 border-t border-slate-100 pt-5 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="leading-relaxed">
                Secured with Firebase Authentication and strict per-user Firestore Security Rules.
                Your sales, expenses, and inventory are accessible only by your verified account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
