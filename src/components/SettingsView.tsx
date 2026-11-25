import React, { useEffect, useState } from 'react';
import { Download, LogOut } from 'lucide-react';
import { BusinessSettings } from '../types/business';
import { CURRENCY_OPTIONS, getCurrencySymbol } from '../data/constants';
import { useBusiness } from '../context/BusinessContext';
import { formatShortDate } from '../utils/analytics';
import { isValidEmailFormat } from '../utils/authValidation';

export function SettingsView() {
  const { state, user, updateSettings, signOutUser } = useBusiness();
  const [form, setForm] = useState<BusinessSettings>(() => ({ ...state.settings }));
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    setForm({ ...state.settings });
  }, [state.settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim() || !form.ownerName.trim() || !form.businessType.trim()) {
      setErrorNotice('Business Name, Owner Name, and Business Type are required.');
      return;
    }
    if (!isValidEmailFormat(form.email)) {
      setErrorNotice('Please enter a valid business email address (for example, owner@business.ng).');
      return;
    }

    setSaving(true);
    setErrorNotice(null);
    setSavedNotice(null);
    try {
      await updateSettings({
        ...form,
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        businessType: form.businessType.trim(),
        defaultReorderLevel: Math.max(0, Number(form.defaultReorderLevel) || 0),
        vatRate: Math.max(0, Number(form.vatRate) || 0),
      });
      setSavedNotice('Business profile and operational preferences saved to Cloud Firestore.');
    } catch {
      setErrorNotice('Unable to save settings right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vendorpilot-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSavedNotice('Exported your business ledger backup as JSON.');
  };

  return (
    <div className="max-w-4xl space-y-6">
      {savedNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span>{savedNotice}</span>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorNotice && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span>{errorNotice}</span>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-xs font-medium text-rose-700 hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        {/* Business Profile */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Business Profile</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Stored securely in Cloud Firestore under your authenticated account.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="set-biz-name" className="block text-xs font-medium text-slate-700">
                Business Name
              </label>
              <input
                id="set-biz-name"
                type="text"
                required
                maxLength={140}
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="set-owner-name" className="block text-xs font-medium text-slate-700">
                Owner / Managing Director
              </label>
              <input
                id="set-owner-name"
                type="text"
                required
                maxLength={120}
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="set-biz-type" className="block text-xs font-medium text-slate-700">
                Business Type
              </label>
              <input
                id="set-biz-type"
                type="text"
                required
                maxLength={120}
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="set-rc" className="block text-xs font-medium text-slate-700">
                CAC Registration / RC Number
              </label>
              <input
                id="set-rc"
                type="text"
                maxLength={40}
                value={form.rcNumber}
                onChange={(e) => setForm({ ...form, rcNumber: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="set-address" className="block text-xs font-medium text-slate-700">
                Store / Office Address
              </label>
              <input
                id="set-address"
                type="text"
                maxLength={240}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="set-phone" className="block text-xs font-medium text-slate-700">
                Business Phone
              </label>
              <input
                id="set-phone"
                type="tel"
                maxLength={40}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="set-email" className="block text-xs font-medium text-slate-700">
                Business Email
              </label>
              <input
                id="set-email"
                type="email"
                maxLength={160}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Operational Preferences */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Operations & Inventory Rules</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Configure default currency display, VAT reference, and stock alert thresholds.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="set-currency" className="block text-xs font-medium text-slate-700">
                Business Currency
              </label>
              <select
                id="set-currency"
                value={form.currencyCode}
                onChange={(e) => {
                  const code = e.target.value as BusinessSettings['currencyCode'];
                  setForm({
                    ...form,
                    currencyCode: code,
                    currencySymbol: getCurrencySymbol(code),
                  });
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="set-reorder" className="block text-xs font-medium text-slate-700">
                Default Reorder Threshold
              </label>
              <input
                id="set-reorder"
                type="number"
                min="0"
                value={form.defaultReorderLevel}
                onChange={(e) =>
                  setForm({ ...form, defaultReorderLevel: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="set-vat" className="block text-xs font-medium text-slate-700">
                Standard VAT Rate (%)
              </label>
              <input
                id="set-vat"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) || 0 })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.vatEnabled}
                onChange={(e) => setForm({ ...form, vatEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <span>Include Nigerian VAT ({form.vatRate}%) reference on financial reports</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </section>
      </form>

      {/* Account & Data Export */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-base font-semibold text-slate-900">Account & Data Export</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
            {state.settings.createdAt && (
              <>
                <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
                <span>Workspace created {formatShortDate(state.settings.createdAt)}</span>
              </>
            )}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Ledger JSON
          </button>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
