import React, { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { AlertCircle, CheckCircle2, LogOut, MailCheck, RefreshCw } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import { ThemeToggleButton } from '../context/ThemeContext';
import { mapFirebaseAuthError } from '../utils/authValidation';
import {
  extractFirstName,
  formatDisplayName,
  getUserAvatarSeed,
  getUserAvatarUrl,
  getUserInitials,
} from '../utils/avatars';
import { VendorAvatar } from './VendorAvatar';

export function EmailVerificationView() {
  const { user, refreshAuthUser, signOutUser } = useBusiness();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckVerification = async () => {
    setChecking(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const verified = await refreshAuthUser();
      if (!verified) {
        setErrorMessage(
          'Your email is not verified yet. Open the verification link we sent to your inbox (or check Spam), then click again.'
        );
      }
    } catch (err: unknown) {
      setErrorMessage(mapFirebaseAuthError(err));
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await sendEmailVerification(user);
      setStatusMessage(
        `A fresh verification link has been sent to ${user.email ?? 'your email address'}.`
      );
    } catch (err: unknown) {
      setErrorMessage(mapFirebaseAuthError(err));
    } finally {
      setResending(false);
    }
  };

  const firstName = extractFirstName(user?.displayName, user?.email);
  const fullName = formatDisplayName(user?.displayName, user?.email);
  const initials = getUserInitials(user?.displayName, user?.email);
  const avatarSeed = getUserAvatarSeed(user?.displayName, user?.email, user?.uid);
  const avatarUrl = getUserAvatarUrl(user?.displayName, user?.email, user?.uid);

  return (
    <div className="vp-dark-auto min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-[#090e17] dark:text-slate-100">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-3">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <VendorAvatar
              seed={avatarSeed}
              src={avatarUrl}
              alt={`${fullName} (${initials})`}
              initials={initials}
              size={48}
              showInitialsBadge
              badgeSize="sm"
              className="h-12 w-12 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700"
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <MailCheck className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <h1 className="mt-5 font-editorial text-2xl font-bold tracking-normal text-slate-900 dark:text-white">
            Hi {firstName}, verify your email
          </h1>
          <p className="mt-2 font-hand text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            We sent a verification link to{' '}
            <strong className="font-medium text-slate-900 dark:text-white">{user?.email}</strong>. Please click
            that link to activate your private business ledger, then continue below.
          </p>

          {statusMessage && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-relaxed text-emerald-900"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void handleCheckVerification()}
              disabled={checking}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{checking ? 'Checking verification status...' : "I've Verified My Email — Continue"}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {resending ? 'Sending link...' : 'Resend Verification Email'}
            </button>
          </div>

          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            Email verification is required by VendorPilot AI&apos;s security rules before creating
            or saving business records in Cloud Firestore.
          </p>
        </div>
      </div>
    </div>
  );
}
