import React, { lazy, Suspense, useState } from 'react';
import { NavSection, Product } from './types/business';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthView } from './components/AuthView';
import { EmailVerificationView } from './components/EmailVerificationView';
import { OnboardingView } from './components/OnboardingView';
import { Layout } from './components/Layout';
import { Modal } from './components/Modal';

const DashboardView = lazy(() =>
  import('./components/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const SalesView = lazy(() =>
  import('./components/SalesView').then((m) => ({ default: m.SalesView }))
);
const ExpensesView = lazy(() =>
  import('./components/ExpensesView').then((m) => ({ default: m.ExpensesView }))
);
const InventoryView = lazy(() =>
  import('./components/InventoryView').then((m) => ({ default: m.InventoryView }))
);
const AIAssistantView = lazy(() =>
  import('./components/AIAssistantView').then((m) => ({ default: m.AIAssistantView }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);

function WorkspaceLoadingScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
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
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function VendorPilotShell() {
  const {
    authReady,
    user,
    emailVerified,
    profileLoading,
    profileExists,
    dataLoading,
    restockProduct,
  } = useBusiness();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // Shared quick restock modal (accessible from Dashboard Low-Stock Alerts AND Inventory)
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('15');
  const [restockError, setRestockError] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  if (!authReady) {
    return <WorkspaceLoadingScreen label="Checking authentication session..." />;
  }

  if (!user) {
    return <AuthView />;
  }

  if (!emailVerified) {
    return <EmailVerificationView />;
  }

  if (profileLoading) {
    return <WorkspaceLoadingScreen label="Loading your business profile..." />;
  }

  if (!profileExists) {
    return <OnboardingView />;
  }

  const handleOpenRestock = (product: Product) => {
    setRestockTarget(product);
    setRestockQty(String(Math.max(10, product.reorderLevel * 2 - product.stock)));
    setRestockError('');
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    const qty = Number(restockQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setRestockError('Enter a restock quantity greater than 0.');
      return;
    }
    if (restockTarget.stock + Math.round(qty) > 10_000_000) {
      setRestockError('Resulting stock exceeds the maximum supported quantity (10,000,000).');
      return;
    }
    setRestockSubmitting(true);
    try {
      await restockProduct(restockTarget.id, qty);
      setRestockTarget(null);
      setRestockError('');
    } catch {
      setRestockError('Could not update stock in Firestore. Please try again.');
    } finally {
      setRestockSubmitting(false);
    }
  };

  let primaryActionLabel: string | undefined;
  let onPrimaryAction: (() => void) | undefined;

  if (activeSection === 'dashboard') {
    primaryActionLabel = 'Record Sale';
    onPrimaryAction = () => {
      setActiveSection('sales');
      setSaleModalOpen(true);
    };
  } else if (activeSection === 'sales') {
    primaryActionLabel = 'Record Sale';
    onPrimaryAction = () => setSaleModalOpen(true);
  } else if (activeSection === 'expenses') {
    primaryActionLabel = 'Record Expense';
    onPrimaryAction = () => setExpenseModalOpen(true);
  } else if (activeSection === 'inventory') {
    primaryActionLabel = 'Add Product';
    onPrimaryAction = () => setProductModalOpen(true);
  }

  return (
    <Layout
      activeSection={activeSection}
      onNavigate={setActiveSection}
      primaryActionLabel={primaryActionLabel}
      onPrimaryAction={onPrimaryAction}
    >
      {dataLoading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading business records">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-3.5 w-24 rounded bg-slate-100" />
                <div className="mt-4 h-7 w-36 rounded bg-slate-100" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="h-80 rounded-xl border border-slate-200 bg-white p-6" />
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="space-y-6" aria-busy="true" aria-label="Loading section">
              <div className="h-32 rounded-xl border border-slate-200 bg-white p-6" />
              <div className="h-72 rounded-xl border border-slate-200 bg-white p-6" />
            </div>
          }
        >
          {activeSection === 'dashboard' && (
            <DashboardView onNavigate={setActiveSection} onQuickRestock={handleOpenRestock} />
          )}
          {activeSection === 'sales' && (
            <SalesView
              isModalOpen={saleModalOpen}
              onOpenModal={() => setSaleModalOpen(true)}
              onCloseModal={() => setSaleModalOpen(false)}
            />
          )}
          {activeSection === 'expenses' && (
            <ExpensesView
              isModalOpen={expenseModalOpen}
              onOpenModal={() => setExpenseModalOpen(true)}
              onCloseModal={() => setExpenseModalOpen(false)}
            />
          )}
          {activeSection === 'inventory' && (
            <InventoryView
              isAddModalOpen={productModalOpen}
              onOpenAddModal={() => setProductModalOpen(true)}
              onCloseAddModal={() => setProductModalOpen(false)}
              onRequestRestock={handleOpenRestock}
            />
          )}
          {activeSection === 'assistant' && <AIAssistantView />}
          {activeSection === 'settings' && <SettingsView />}
        </Suspense>
      )}

      {/* Shared Restock Modal */}
      <Modal
        isOpen={restockTarget !== null}
        onClose={() => setRestockTarget(null)}
        title="Restock Inventory Item"
        subtitle={restockTarget ? `${restockTarget.name} (${restockTarget.sku})` : undefined}
        maxWidthClass="max-w-md"
      >
        {restockTarget && (
          <form onSubmit={(e) => void handleRestockSubmit(e)} className="space-y-4" noValidate>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-600">Current Stock</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {restockTarget.stock} {restockTarget.unit}(s)
              </span>
            </div>

            <div>
              <label htmlFor="restock-qty-input" className="block text-xs font-medium text-slate-700">
                Quantity Received ({restockTarget.unit}s)
              </label>
              <input
                id="restock-qty-input"
                type="number"
                min="1"
                step="1"
                value={restockQty}
                onChange={(e) => {
                  setRestockQty(e.target.value);
                  setRestockError('');
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {restockError && <p className="mt-1 text-xs text-rose-600">{restockError}</p>}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>New Stock Balance</span>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                {restockTarget.stock + Math.max(0, Number(restockQty) || 0)} {restockTarget.unit}(s)
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                disabled={restockSubmitting}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={restockSubmitting}
                className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {restockSubmitting ? 'Updating...' : 'Confirm Restock'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BusinessProvider>
        <VendorPilotShell />
      </BusinessProvider>
    </ErrorBoundary>
  );
}
