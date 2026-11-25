import React, { useState } from 'react';
import { AlertCircle, LogOut } from 'lucide-react';
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

export function OnboardingView() {
  const { user, createBusinessProfile, signOutUser } = useBusiness();
  const [name, setName] = useState(user?.displayName ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPE_SUGGESTIONS[0]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>('NGN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessName.trim() || !businessType.trim()) {
      setError('Please enter your name, business name, and business category.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createBusinessProfile({
        name: name.trim(),
        businessName: businessName.trim(),
        businessType: businessType.trim(),
        address: address.trim(),
        phone: phone.trim(),
        currencyCode,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? 'Could not create your business profile. Please try again.'
          : 'Could not save your workspace setup.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewFirstName = extractFirstName(name, user?.email);
  const previewFullName = formatDisplayName(name, user?.email);
  const previewInitials = getUserInitials(name, user?.email);
  const previewSeed = getUserAvatarSeed(name, user?.email, user?.uid);
  const previewAvatarUrl = getUserAvatarUrl(name, user?.email, user?.uid);

  return (
    <div className="vp-dark-auto flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 dark:bg-[#090e17] sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3.5 rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 p-3.5 dark:border-emerald-900/50 dark:from-emerald-950/35 dark:via-slate-900 dark:to-slate-900">
            <VendorAvatar
              seed={previewSeed}
              src={previewAvatarUrl}
              alt={`${previewFullName} (${previewInitials})`}
              initials={previewInitials}
              size={48}
              showInitialsBadge
              badgeSize="sm"
              className="h-12 w-12 rounded-xl ring-2 ring-white shadow-xs dark:ring-slate-800"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {previewFullName} ({previewInitials})
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Signed in as <span className="font-medium text-slate-700 dark:text-slate-200">{user?.email}</span>
              </p>
            </div>
          </div>

          <h1 className="mt-5 font-editorial text-2xl font-bold tracking-normal text-slate-900 dark:text-white">
            Hi {previewFirstName}, let&apos;s set up your business
          </h1>
          <p className="mt-1 font-hand text-lg text-slate-500 dark:text-slate-400">
            Enter your details below so VendorPilot AI can personalize your private cloud ledger.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="onb-name" className="block text-xs font-medium text-slate-700">
                Your Full Name
              </label>
              <input
                id="onb-name"
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Adewale Ogunleye"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="onb-biz-name" className="block text-xs font-medium text-slate-700">
                Business Name
              </label>
              <input
                id="onb-biz-name"
                type="text"
                required
                maxLength={140}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., EkoMart Wholesale & Retail"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="onb-biz-type" className="block text-xs font-medium text-slate-700">
                  Business Category
                </label>
                <select
                  id="onb-biz-type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  {BUSINESS_TYPE_SUGGESTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="onb-currency" className="block text-xs font-medium text-slate-700">
                  Business Currency
                </label>
                <select
                  id="onb-currency"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value as CurrencyCode)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="onb-phone" className="block text-xs font-medium text-slate-700">
                  Business Phone Number
                </label>
                <input
                  id="onb-phone"
                  type="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., +234 803 519 4420"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="onb-address" className="block text-xs font-medium text-slate-700">
                  Business Location
                </label>
                <input
                  id="onb-address"
                  type="text"
                  maxLength={240}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., Surulere, Lagos"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-11 w-full rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating workspace...' : 'Create Business Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
