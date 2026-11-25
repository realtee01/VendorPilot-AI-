import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, Trash2, Pencil } from 'lucide-react';
import { PaymentMethod, PaymentStatus, SaleOrder } from '../types/business';
import { getTodayIsoDate, PAYMENT_METHODS } from '../data/constants';
import { generateDocumentId } from '../firebase';
import { useBusiness } from '../context/BusinessContext';
import {
  formatNaira,
  formatShortDate,
  getOutstandingBalance,
  validateSaleInput,
} from '../utils/analytics';
import { Modal } from './Modal';

interface SalesViewProps {
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
}

const STATUS_FILTERS: Array<'All' | PaymentStatus> = ['All', 'Paid', 'Pending', 'Partial'];

export function SalesView({ isModalOpen, onOpenModal, onCloseModal }: SalesViewProps) {
  const { state, metrics, recordSale, updateSale, markOrderPaid, deleteSale } = useBusiness();
  const symbol = state.settings.currencySymbol || '₦';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PaymentStatus>('All');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingSale, setEditingSale] = useState<SaleOrder | null>(null);
  const [draftSaleId, setDraftSaleId] = useState<string>(() => generateDocumentId('sale'));

  // Record / Edit Sale form state
  const [selectedProductId, setSelectedProductId] = useState<string>(state.products[0]?.id ?? 'custom');
  const [customProductName, setCustomProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState(
    state.products[0] ? String(state.products[0].unitPrice) : ''
  );
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const modalVisible = isModalOpen || editingSale !== null;
  const wasNewModalOpenRef = useRef(false);

  // Generate a fresh idempotency draftSaleId only when opening a new sale modal
  // (never reset user input on background Firestore product snapshots)
  useEffect(() => {
    const isNewModalOpen = isModalOpen && !editingSale;
    if (isNewModalOpen && !wasNewModalOpenRef.current) {
      setDraftSaleId(generateDocumentId('sale'));
      const first = state.products[0];
      setSelectedProductId(first ? first.id : 'custom');
      setCustomProductName('');
      setUnitPrice(first ? String(first.unitPrice) : '');
      setQuantity('1');
      setCustomerName('');
      setCustomerPhone('');
      setPaymentStatus('Paid');
      setAmountPaid('');
      setPaymentMethod('Bank Transfer');
      setDate(getTodayIsoDate());
      setNotes('');
      setFormErrors({});
      setSubmitError(null);
    }
    wasNewModalOpenRef.current = isNewModalOpen;
  }, [isModalOpen, editingSale, state.products]);

  const selectedProduct = useMemo(
    () => state.products.find((p) => p.id === selectedProductId) ?? null,
    [state.products, selectedProductId]
  );

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.sales.filter((order) => {
      if (statusFilter !== 'All' && order.paymentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.productName.toLowerCase().includes(q) ||
        order.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [state.sales, search, statusFilter]);

  const parsedQty = Number(quantity) || 0;
  const parsedPrice = Number(unitPrice) || 0;
  const liveTotal = parsedQty * parsedPrice;

  const handleProductChange = (val: string) => {
    setSelectedProductId(val);
    if (val === 'custom') {
      if (!editingSale) setUnitPrice('');
    } else {
      const prod = state.products.find((p) => p.id === val);
      if (prod) {
        setUnitPrice(String(prod.unitPrice));
      }
    }
    setFormErrors((prev) => ({ ...prev, productName: '', unitPrice: '' }));
  };

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value);
    const matched = state.customers.find(
      (c) => c.name.trim().toLowerCase() === value.trim().toLowerCase()
    );
    if (matched && matched.phone && !customerPhone) {
      setCustomerPhone(matched.phone);
    }
  };

  const openEditModal = (order: SaleOrder) => {
    setEditingSale(order);
    const hasLinkedProduct = Boolean(
      order.productId && state.products.some((p) => p.id === order.productId)
    );
    setSelectedProductId(hasLinkedProduct && order.productId ? order.productId : 'custom');
    setCustomProductName(hasLinkedProduct ? '' : order.productName);
    setQuantity(String(order.quantity));
    setUnitPrice(String(order.unitPrice));
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone === 'Not provided' ? '' : order.customerPhone);
    setPaymentStatus(order.paymentStatus);
    setAmountPaid(order.paymentStatus === 'Partial' ? String(order.amountPaid) : '');
    setPaymentMethod(order.paymentMethod);
    setDate(order.date);
    setNotes(order.notes ?? '');
    setFormErrors({});
    setSubmitError(null);
  };

  const handleClose = () => {
    setEditingSale(null);
    setFormErrors({});
    setSubmitError(null);
    onCloseModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const productName = selectedProduct ? selectedProduct.name : customProductName;
    const qtyNum = Number(quantity);
    const priceNum = Number(unitPrice);
    const paidNum =
      paymentStatus === 'Partial'
        ? Number(amountPaid)
        : paymentStatus === 'Paid'
          ? qtyNum * priceNum
          : 0;

    const validation = validateSaleInput({
      productName,
      quantity: qtyNum,
      unitPrice: priceNum,
      customerName,
      paymentStatus,
      amountPaid: paidNum,
      date,
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingSale) {
        await updateSale(editingSale.id, {
          productId: selectedProduct ? selectedProduct.id : null,
          productName,
          quantity: qtyNum,
          unitPrice: priceNum,
          customerName,
          customerPhone,
          paymentStatus,
          amountPaid: paidNum,
          paymentMethod,
          date: date || getTodayIsoDate(),
          notes,
        });
        setFeedback(`Updated order ${editingSale.orderNumber} in Cloud Firestore.`);
      } else {
        const created = await recordSale({
          draftSaleId,
          productId: selectedProduct ? selectedProduct.id : null,
          productName,
          quantity: qtyNum,
          unitPrice: priceNum,
          customerName,
          customerPhone,
          paymentStatus,
          amountPaid: paidNum,
          paymentMethod,
          date: date || getTodayIsoDate(),
          notes,
        });
        setFeedback(
          `Order ${created.orderNumber} saved to Firestore for ${created.customerName} (${formatNaira(created.totalAmount, false, symbol)}).`
        );
      }

      handleClose();
    } catch {
      setSubmitError('Unable to save sale right now. Please verify your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (orderId: string, orderNumber: string) => {
    try {
      await markOrderPaid(orderId);
      setFeedback(`Marked order ${orderNumber} as fully paid.`);
    } catch {
      setFeedback('Could not update payment status. Please try again.');
    }
  };

  const handleDelete = async (order: SaleOrder) => {
    try {
      await deleteSale(order.id);
      setFeedback(`Deleted order ${order.orderNumber} and restored any linked stock.`);
    } catch {
      setFeedback('Could not delete order. Please try again.');
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

      {/* Summary Strip */}
      <section aria-label="Sales summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Total Sales Value</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatNaira(metrics.totalRevenue, false, symbol)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {metrics.totalOrders} total orders · {state.customers.length} customer{state.customers.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Payments Collected</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatNaira(metrics.collectedRevenue, false, symbol)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Settled via bank transfer, POS, cash & mobile</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Outstanding Receivables</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {formatNaira(metrics.outstandingPayments, false, symbol)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {metrics.unpaidOrderCount} order{metrics.unpaidOrderCount === 1 ? '' : 's'} with balance due
          </p>
        </div>
      </section>

      {/* Toolbar & Orders Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID, customer, or product..."
              aria-label="Search sales and orders"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter by payment status">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === status
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">
              {state.sales.length === 0 ? 'No sales recorded yet' : 'No matching orders found'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {state.sales.length === 0
                ? 'Record your first customer sale to track revenue, customers, and receivables in Firestore.'
                : 'Adjust your search or status filter, or record a new customer sale.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(search || statusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('All');
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={onOpenModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Record Sale
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-3 pl-6 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Product & Qty</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="py-3 pr-6 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((order) => {
                  const balance = getOutstandingBalance(order);
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="py-3.5 pr-3 pl-6 align-top">
                        <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {order.orderNumber}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatShortDate(order.date)}</p>
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <p className="font-medium text-slate-900">{order.customerName}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                          {order.customerPhone || 'No phone'}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <p className="font-medium text-slate-900">{order.productName}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                          {order.quantity} × {formatNaira(order.unitPrice, false, symbol)}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`font-medium ${
                              order.paymentStatus === 'Paid'
                                ? 'text-emerald-700'
                                : order.paymentStatus === 'Partial'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-500">{order.paymentMethod}</span>
                        </div>
                        {balance > 0 && (
                          <p className="mt-0.5 font-mono text-xs text-amber-700 tabular-nums">
                            Balance: {formatNaira(balance, false, symbol)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right align-top font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {formatNaira(order.totalAmount, false, symbol)}
                      </td>
                      <td className="py-3.5 pr-6 pl-3 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {balance > 0 && (
                            <button
                              type="button"
                              onClick={() => void handleMarkPaid(order.id, order.orderNumber)}
                              aria-label={`Mark ${order.orderNumber} as paid`}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(order)}
                            aria-label={`Edit order ${order.orderNumber}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(order)}
                            aria-label={`Delete order ${order.orderNumber}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Record / Edit Sale Modal */}
      <Modal
        isOpen={modalVisible}
        onClose={handleClose}
        title={editingSale ? `Edit Sale ${editingSale.orderNumber}` : 'Record New Sale'}
        subtitle={
          editingSale
            ? 'Updates the transaction and adjusts linked inventory by the exact quantity difference.'
            : 'Saved atomically to Cloud Firestore with duplicate-safe inventory deduction.'
        }
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          {submitError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {submitError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="sale-product" className="block text-xs font-medium text-slate-700">
                Product
              </label>
              <select
                id="sale-product"
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {state.products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} — {formatNaira(prod.unitPrice, false, symbol)} ({prod.stock} in stock)
                  </option>
                ))}
                <option value="custom">+ Custom / unlisted item</option>
              </select>
            </div>

            {selectedProductId === 'custom' && (
              <div className="sm:col-span-2">
                <label htmlFor="sale-custom-name" className="block text-xs font-medium text-slate-700">
                  Product Name
                </label>
                <input
                  id="sale-custom-name"
                  type="text"
                  maxLength={160}
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                  placeholder="e.g., Mama Gold Parboiled Rice (50kg)"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                {formErrors.productName && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.productName}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="sale-qty" className="block text-xs font-medium text-slate-700">
                Quantity
              </label>
              <input
                id="sale-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.quantity && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.quantity}</p>
              )}
            </div>

            <div>
              <label htmlFor="sale-unit-price" className="block text-xs font-medium text-slate-700">
                Unit Price ({symbol})
              </label>
              <input
                id="sale-unit-price"
                type="number"
                min="1"
                step="50"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.unitPrice && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.unitPrice}</p>
              )}
            </div>

            <div>
              <label htmlFor="sale-customer-name" className="block text-xs font-medium text-slate-700">
                Customer Name
              </label>
              <input
                id="sale-customer-name"
                type="text"
                list="sale-customer-suggestions"
                maxLength={140}
                value={customerName}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                placeholder="e.g., Chinedu Okafor"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              <datalist id="sale-customer-suggestions">
                {state.customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
              {formErrors.customerName && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.customerName}</p>
              )}
            </div>

            <div>
              <label htmlFor="sale-customer-phone" className="block text-xs font-medium text-slate-700">
                Customer Phone
              </label>
              <input
                id="sale-customer-phone"
                type="tel"
                maxLength={40}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g., 0803 412 8890"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sale-status" className="block text-xs font-medium text-slate-700">
                Payment Status
              </label>
              <select
                id="sale-status"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="Paid">Paid (Full payment received)</option>
                <option value="Partial">Partial (Deposit received)</option>
                <option value="Pending">Pending (Invoice / Credit)</option>
              </select>
            </div>

            <div>
              <label htmlFor="sale-method" className="block text-xs font-medium text-slate-700">
                Payment Channel
              </label>
              <select
                id="sale-method"
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

            {paymentStatus === 'Partial' && (
              <div>
                <label htmlFor="sale-amount-paid" className="block text-xs font-medium text-slate-700">
                  Amount Received So Far ({symbol})
                </label>
                <input
                  id="sale-amount-paid"
                  type="number"
                  min="1"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter deposit received"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                />
                {formErrors.amountPaid && (
                  <p className="mt-1 text-xs text-rose-600">{formErrors.amountPaid}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="sale-date" className="block text-xs font-medium text-slate-700">
                Sale Date
              </label>
              <input
                id="sale-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.date && <p className="mt-1 text-xs text-rose-600">{formErrors.date}</p>}
            </div>

            <div className={paymentStatus === 'Partial' ? 'sm:col-span-2' : ''}>
              <label htmlFor="sale-notes" className="block text-xs font-medium text-slate-700">
                Delivery / Order Note (Optional)
              </label>
              <input
                id="sale-notes"
                type="text"
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Pickup at Surulere branch"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Live Order Total Bar */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 border border-slate-200">
            <span className="text-sm font-medium text-slate-600">Calculated Order Total</span>
            <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {formatNaira(liveTotal, false, symbol)}
            </span>
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
              {submitting ? 'Saving...' : editingSale ? 'Update Sale' : 'Save Sale'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
