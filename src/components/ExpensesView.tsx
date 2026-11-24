import React, { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { ExpenseCategory, PaymentMethod } from '../types/business';
import { EXPENSE_CATEGORIES, getTodayIsoDate, PAYMENT_METHODS } from '../data/constants';
import { useBusiness } from '../context/BusinessContext';
import { formatNaira, formatShortDate, validateExpenseInput } from '../utils/analytics';
import { Modal } from './Modal';

interface ExpensesViewProps {
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
}

export function ExpensesView({ isModalOpen, onOpenModal, onCloseModal }: ExpensesViewProps) {
  const { state, metrics, expenseByCategory, recordExpense, deleteExpense } = useBusiness();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ExpenseCategory>('All');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Record Expense form state
  const [category, setCategory] = useState<ExpenseCategory>('Logistics & Delivery');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.expenses.filter((exp) => {
      if (categoryFilter !== 'All' && exp.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        exp.description.toLowerCase().includes(q) ||
        exp.vendor.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q)
      );
    });
  }, [state.expenses, search, categoryFilter]);

  const topCategory = expenseByCategory[0] ?? null;

  const resetForm = () => {
    setCategory('Logistics & Delivery');
    setAmount('');
    setDescription('');
    setVendor('');
    setPaymentMethod('Bank Transfer');
    setDate(getTodayIsoDate());
    setFormErrors({});
    setSubmitError(null);
  };

  const handleClose = () => {
    setFormErrors({});
    setSubmitError(null);
    onCloseModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    const validation = validateExpenseInput({
      description,
      vendor,
      amount: numAmount,
      date,
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await recordExpense({
        date,
        category,
        description,
        vendor,
        amount: numAmount,
        paymentMethod,
      });

      setFeedback(`Recorded ${created.category} expense of ${formatNaira(created.amount)}.`);
      resetForm();
      onCloseModal();
    } catch {
      setSubmitError('Unable to save expense right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
    } catch {
      setFeedback('Could not delete expense entry. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <section aria-label="Expense summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Total Operating Expenses</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatNaira(metrics.totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {state.expenses.length} recorded transaction{state.expenses.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Highest Cost Driver</p>
          <p className="mt-1.5 truncate text-lg font-semibold text-slate-900">
            {topCategory ? topCategory.category : 'None yet'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {topCategory
              ? `${formatNaira(topCategory.total)} (${topCategory.sharePct}% of total spend)`
              : 'Log your first operating cost'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Expense-to-Revenue Ratio</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.totalRevenue > 0
              ? `${((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(1)}%`
              : '0.0%'}
          </p>
          <p className="mt-1 text-xs text-slate-500">Net margin retained: {metrics.profitMarginPct}%</p>
        </div>
      </section>

      {/* Spend Breakdown by Category */}
      {expenseByCategory.length > 0 && (
        <section aria-label="Spend by category" className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Spend by Category</h2>
              <p className="mt-0.5 text-sm text-slate-500">Click any category to filter the ledger below</p>
            </div>
            {categoryFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('All')}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Show all categories
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-1.5 md:grid-cols-2">
            {expenseByCategory.map((item) => {
              const active = categoryFilter === item.category;
              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setCategoryFilter(active ? 'All' : item.category)}
                  className={`rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-emerald-50/80 text-emerald-950' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm font-medium ${active ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {item.category}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatNaira(item.total)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                        style={{ width: `${Math.max(4, item.sharePct)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-[11px] text-slate-500 tabular-nums">
                      {item.sharePct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Expense History Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor, description, or category..."
              aria-label="Search expenses"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="expense-category-filter" className="sr-only">
              Filter by expense category
            </label>
            <select
              id="expense-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'All' | ExpenseCategory)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">
              {state.expenses.length === 0
                ? 'No expenses logged yet'
                : 'No expense entries match your filter'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {state.expenses.length === 0
                ? 'Record your operating expenses such as stock restock, fuel, logistics, or rent.'
                : 'Clear your filters or log a new operational expense.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(search || categoryFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('All');
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              )}
              <button
                type="button"
                onClick={onOpenModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Record Expense
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-3 pl-6 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Description & Vendor</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Payment Channel</th>
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                  <th className="py-3 pr-6 pl-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="py-3.5 pr-3 pl-6 align-top font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatShortDate(exp.date)}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <p className="font-medium text-slate-900">{exp.description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{exp.vendor}</p>
                    </td>
                    <td className="px-3 py-3.5 align-top text-xs font-medium text-slate-700 whitespace-nowrap">
                      {exp.category}
                    </td>
                    <td className="px-3 py-3.5 align-top text-xs text-slate-500 whitespace-nowrap">
                      {exp.paymentMethod}
                    </td>
                    <td className="px-3 py-3.5 text-right align-top font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {formatNaira(exp.amount)}
                    </td>
                    <td className="py-3.5 pr-6 pl-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() => void handleDelete(exp.id)}
                        aria-label={`Delete expense ${exp.description}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Record Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="Record Expense"
        subtitle="Log an operating cost directly to your Cloud Firestore ledger."
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          {submitError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {submitError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="exp-category" className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-slate-700">
                Amount (₦)
              </label>
              <input
                id="exp-amount"
                type="number"
                min="1"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 45000"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.amount && <p className="mt-1 text-xs text-rose-600">{formErrors.amount}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="exp-description" className="block text-xs font-medium text-slate-700">
                Description
              </label>
              <input
                id="exp-description"
                type="text"
                maxLength={240}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dispatch rider bulk delivery to Lekki"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.description && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.description}</p>
              )}
            </div>

            <div>
              <label htmlFor="exp-vendor" className="block text-xs font-medium text-slate-700">
                Vendor / Payee
              </label>
              <input
                id="exp-vendor"
                type="text"
                maxLength={140}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g., GIG Logistics"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.vendor && <p className="mt-1 text-xs text-rose-600">{formErrors.vendor}</p>}
            </div>

            <div>
              <label htmlFor="exp-date" className="block text-xs font-medium text-slate-700">
                Expense Date
              </label>
              <input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.date && <p className="mt-1 text-xs text-rose-600">{formErrors.date}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="exp-method" className="block text-xs font-medium text-slate-700">
                Payment Channel
              </label>
              <select
                id="exp-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
