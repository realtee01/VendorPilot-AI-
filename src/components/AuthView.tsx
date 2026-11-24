import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

export function AuthView() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in was cancelled before completing. Click below to try again.');
      } else if (code === 'auth/popup-blocked') {
        setError('Your browser blocked the Google Sign-In popup. Please allow popups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase Authentication settings yet.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to complete Google Sign-In right now. Please try again.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-12 lg:px-10">
        {/* Left Editorial / Product Column */}
        <div className="space-y-8 lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-emerald-400"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              VendorPilot <span className="text-emerald-600">AI</span>
            </span>
          </div>

          <div className="max-w-xl space-y-4">
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Run your SME sales, expenses, and stock from one secure ledger.
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
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

        {/* Right Sign-In Card */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              Sign in to VendorPilot AI
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Use your Google account to access your private business dashboard and cloud ledger.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
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
              <span>{signingIn ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>

            <div className="mt-6 flex items-start gap-2.5 border-t border-slate-100 pt-5 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="leading-relaxed">
                Secured with Firebase Authentication and strict per-user Firestore Security Rules.
                Your sales, expenses, and inventory are accessible only by your signed-in account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
