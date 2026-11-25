import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  Package,
  Bot,
  Settings,
  Menu,
  X,
  Plus,
  LogOut,
} from 'lucide-react';
import { NavSection } from '../types/business';
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

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sales', label: 'Sales & Orders', icon: ShoppingBag },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'assistant', label: 'AI Business Assistant', icon: Bot },
  { id: 'settings', label: 'Business Settings', icon: Settings },
];

const SECTION_META: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Executive overview of sales, expenses, stock health, and receivables',
  },
  sales: {
    title: 'Sales & Orders',
    subtitle: 'Record customer orders, monitor payments, and settle outstanding balances',
  },
  expenses: {
    title: 'Expenses',
    subtitle: 'Track operational spend across stock, logistics, power, and payroll',
  },
  inventory: {
    title: 'Inventory',
    subtitle: 'Manage product catalogue, unit margins, and low-stock reorder thresholds',
  },
  assistant: {
    title: 'AI Business Assistant',
    subtitle: 'Ask questions grounded in your live sales, expenses, and inventory figures',
  },
  settings: {
    title: 'Business Settings',
    subtitle: 'Manage company details, currency preferences, and account access',
  },
};

export function Layout({
  activeSection,
  onNavigate,
  onPrimaryAction,
  primaryActionLabel,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, state, metrics, signOutUser } = useBusiness();
  const sectionInfo = SECTION_META[activeSection];

  const ownerRawName = state.settings.ownerName || user?.displayName || '';
  const ownerEmail = state.settings.email || user?.email || '';
  const firstName = extractFirstName(ownerRawName, ownerEmail);
  const fullName = formatDisplayName(ownerRawName, ownerEmail);
  const initials = getUserInitials(ownerRawName, ownerEmail);
  const avatarSeed = getUserAvatarSeed(ownerRawName, ownerEmail, user?.uid);
  const avatarUrl = getUserAvatarUrl(ownerRawName, ownerEmail, user?.uid);

  const handleSelectNav = (id: NavSection) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      {/* Brand Wordmark */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleSelectNav('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M4 17L10 7L14 13L20 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 5H20V9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-editorial text-base font-semibold tracking-normal text-slate-900 dark:text-white whitespace-nowrap">
            VendorPilot <span className="text-emerald-600 dark:text-emerald-400">AI</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const showLowStockCount = item.id === 'inventory' && metrics.lowStockCount > 0;
          const showUnpaidCount = item.id === 'sales' && metrics.unpaidOrderCount > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                isActive
                  ? 'bg-emerald-50/95 text-emerald-800 ring-1 ring-emerald-200/75 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60'
                  : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                  }`}
                />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </span>
              {showLowStockCount && (
                <span className="font-mono text-xs tabular-nums text-amber-700 dark:text-amber-400">
                  {metrics.lowStockCount}
                </span>
              )}
              {showUnpaidCount && (
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {metrics.unpaidOrderCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Personalized Business Owner Footer */}
      <div className="border-t border-slate-200/90 p-3.5 space-y-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleSelectNav('settings')}
          className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 p-2.5 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-emerald-800/70 dark:hover:bg-slate-800"
        >
          <VendorAvatar
            seed={avatarSeed}
            src={avatarUrl}
            alt={`${fullName} (${initials})`}
            initials={initials}
            size={40}
            showInitialsBadge
            badgeSize="sm"
            className="h-10 w-10 rounded-xl ring-1 ring-slate-200/90 dark:ring-slate-700"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              Hi, {firstName}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {state.settings.businessName || 'My Business'}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {fullName} <span aria-hidden="true">·</span> {initials}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => void signOutUser()}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5 text-slate-400" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="vp-dark-auto min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090e17] dark:text-slate-100 lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 lg:border-r lg:border-slate-200 dark:lg:border-slate-800">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{state.settings.businessName || 'VendorPilot AI'}</span>
                <span className="hidden sm:inline" aria-hidden="true">/</span>
                <span className="hidden sm:inline font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {sectionInfo.title}
                </span>
              </div>
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                {sectionInfo.title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectNav('settings')}
              title={`${fullName} (${initials}) — Business Settings`}
              className="hidden sm:inline-flex h-10 shrink-0 items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/90 py-1 pr-3 pl-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-800 dark:bg-slate-800/75 dark:text-slate-100 dark:hover:border-emerald-700 whitespace-nowrap"
            >
              <VendorAvatar
                seed={avatarSeed}
                src={avatarUrl}
                alt={`${fullName} (${initials})`}
                initials={initials}
                size={28}
                showInitialsBadge
                badgeSize="sm"
                className="h-7 w-7 rounded-lg"
              />
              <span>Hi, {firstName}</span>
            </button>
            <ThemeToggleButton />
            {onPrimaryAction && primaryActionLabel && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-xs shadow-emerald-600/20 transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>{primaryActionLabel}</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Viewport */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
