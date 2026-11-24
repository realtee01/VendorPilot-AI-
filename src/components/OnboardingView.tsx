import React, { useState } from 'react';
import { AlertCircle, LogOut } from 'lucide-react';
import { BUSINESS_TYPE_SUGGESTIONS } from '../data/constants';
import { useBusiness } from '../context/BusinessContext';

export function OnboardingView() {
  const { user, createBusinessProfile, signOutUser } = useBusiness();
  const [name, setName] = useState(user?.displayName ?? '');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPE_SUGGESTIONS[0]);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessName.trim() || !businessType.trim()) {
      setError('Please enter your name, business name, and business type.');
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

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-400"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-display text-base font-bold tracking-tight text-slate-900">
              VendorPilot <span className="text-emerald-600">AI</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-7">
          <p className="text-xs text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold text-slate-900">
            Set up your business workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tell us about your business so we can initialize your private Cloud Firestore ledger.
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

            <div>
              <label htmlFor="onb-biz-type" className="block text-xs font-medium text-slate-700">
                Business Type
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="onb-phone" className="block text-xs font-medium text-slate-700">
                  Business Phone (Optional)
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
                  Location / Address (Optional)
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
