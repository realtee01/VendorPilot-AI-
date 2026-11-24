import React, { useMemo, useState } from 'react';
import { Search, Pencil, PackagePlus, Trash2 } from 'lucide-react';
import { Product, ProductCategory } from '../types/business';
import { PRODUCT_CATEGORIES } from '../data/constants';
import { useBusiness } from '../context/BusinessContext';
import { formatNaira, getStockStatus, validateProductInput } from '../utils/analytics';
import { Modal } from './Modal';

interface InventoryViewProps {
  isAddModalOpen: boolean;
  onOpenAddModal: () => void;
  onCloseAddModal: () => void;
  onRequestRestock: (product: Product) => void;
}

type StockFilter = 'All' | 'In Stock' | 'Low Stock' | 'Out of Stock';
const STOCK_FILTERS: StockFilter[] = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

export function InventoryView({
  isAddModalOpen,
  onOpenAddModal,
  onCloseAddModal,
  onRequestRestock,
}: InventoryViewProps) {
  const { state, metrics, addProduct, updateProduct, deleteProduct } = useBusiness();
  const currencySymbol = state.settings.currencySymbol || '₦';
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('All');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Product form state (shared by Add and Edit)
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Grains & Staples');
  const [unit, setUnit] = useState('Carton');
  const [costPrice, setCostPrice] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [stock, setStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState(String(state.settings.defaultReorderLevel));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const modalOpen = isAddModalOpen || editingProduct !== null;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.products.filter((prod) => {
      const status = getStockStatus(prod);
      if (stockFilter !== 'All' && status !== stockFilter) return false;
      if (!q) return true;
      return (
        prod.name.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q) ||
        prod.category.toLowerCase().includes(q)
      );
    });
  }, [state.products, search, stockFilter]);

  const resetForm = () => {
    setName('');
    setSku('');
    setCategory('Grains & Staples');
    setUnit('Carton');
    setCostPrice('');
    setUnitPrice('');
    setStock('');
    setReorderLevel(String(state.settings.defaultReorderLevel));
    setFormErrors({});
    setSubmitError(null);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setCategory(product.category);
    setUnit(product.unit);
    setCostPrice(String(product.costPrice));
    setUnitPrice(String(product.unitPrice));
    setStock(String(product.stock));
    setReorderLevel(String(product.reorderLevel));
    setFormErrors({});
    setSubmitError(null);
  };

  const handleCloseModal = () => {
    setEditingProduct(null);
    resetForm();
    onCloseAddModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      sku,
      category,
      unit,
      costPrice: Number(costPrice || 0),
      unitPrice: Number(unitPrice),
      stock: Number(stock),
      reorderLevel: Number(reorderLevel),
    };

    const validation = validateProductInput(payload);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        setFeedback(`Updated "${payload.name}" in inventory.`);
      } else {
        const created = await addProduct(payload);
        setFeedback(
          `Added "${created.name}" (${created.sku}) with ${created.stock} ${created.unit}(s) in stock.`
        );
      }
      handleCloseModal();
    } catch {
      setSubmitError('Unable to save product to Firestore. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct(productId);
    } catch {
      setFeedback('Could not delete product. Please try again.');
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
      <section aria-label="Inventory summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Total Products</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {state.products.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active SKUs in catalogue</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Retail Stock Value</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatNaira(metrics.inventoryValuation, false, currencySymbol)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Valued at current selling price</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Low-Stock Alerts</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {metrics.lowStockCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">At or below reorder threshold</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Out of Stock</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-rose-700 tabular-nums">
            {metrics.outOfStockCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Immediate restock recommended</p>
        </div>
      </section>

      {/* Catalogue Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name, SKU, or category..."
              aria-label="Search inventory products"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter by stock status">
            {STOCK_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStockFilter(filter)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  stockFilter === filter
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">
              {state.products.length === 0
                ? 'Your inventory catalogue is empty'
                : 'No inventory items match your filter'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {state.products.length === 0
                ? 'Add your first product with selling price, stock quantity, and low-stock alert threshold.'
                : 'Try a different search query or add a new product to your catalogue.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(search || stockFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStockFilter('All');
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Add Product
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-3 pl-6 font-medium">Product & SKU</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 text-right font-medium">Cost</th>
                  <th className="px-3 py-3 text-right font-medium">Selling Price</th>
                  <th className="px-3 py-3 text-right font-medium">Margin</th>
                  <th className="px-3 py-3 text-right font-medium">Stock</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="py-3 pr-6 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product);
                  const marginPct =
                    product.unitPrice > 0
                      ? (((product.unitPrice - product.costPrice) / product.unitPrice) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="py-3.5 pr-3 pl-6 align-top">
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {product.sku} · {product.unit}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 align-top text-xs text-slate-600 whitespace-nowrap">
                        {product.category}
                      </td>
                      <td className="px-3 py-3.5 text-right align-top font-mono text-xs text-slate-600 tabular-nums">
                        {formatNaira(product.costPrice, false, currencySymbol)}
                      </td>
                      <td className="px-3 py-3.5 text-right align-top font-mono text-sm font-medium text-slate-900 tabular-nums">
                        {formatNaira(product.unitPrice, false, currencySymbol)}
                      </td>
                      <td className="px-3 py-3.5 text-right align-top font-mono text-xs text-emerald-700 tabular-nums">
                        {marginPct}%
                      </td>
                      <td className="px-3 py-3.5 text-right align-top">
                        <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          {product.stock}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                          Min {product.reorderLevel}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 align-top whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            status === 'In Stock'
                              ? 'text-emerald-700'
                              : status === 'Low Stock'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-6 pl-3 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onRequestRestock(product)}
                            aria-label={`Restock ${product.name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 whitespace-nowrap"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Restock
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            aria-label={`Edit ${product.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(product.id)}
                            aria-label={`Delete ${product.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        subtitle="Saved directly to Cloud Firestore with real-time low-stock monitoring."
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
              <label htmlFor="prod-name" className="block text-xs font-medium text-slate-700">
                Product Name
              </label>
              <input
                id="prod-name"
                type="text"
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Golden Penny Semovita 5kg"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.name && <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="prod-sku" className="block text-xs font-medium text-slate-700">
                SKU Code
              </label>
              <input
                id="prod-sku"
                type="text"
                maxLength={40}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., GP-SEM-5K"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm uppercase text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.sku && <p className="mt-1 text-xs text-rose-600">{formErrors.sku}</p>}
            </div>

            <div>
              <label htmlFor="prod-category" className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <select
                id="prod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prod-cost" className="block text-xs font-medium text-slate-700">
                Cost Price ({currencySymbol})
              </label>
              <input
                id="prod-cost"
                type="number"
                min="0"
                step="50"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="e.g., 7100"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.costPrice && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.costPrice}</p>
              )}
            </div>

            <div>
              <label htmlFor="prod-price" className="block text-xs font-medium text-slate-700">
                Selling Price ({currencySymbol})
              </label>
              <input
                id="prod-price"
                type="number"
                min="1"
                step="50"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g., 8500"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.unitPrice && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.unitPrice}</p>
              )}
            </div>

            <div>
              <label htmlFor="prod-stock" className="block text-xs font-medium text-slate-700">
                Current Stock Qty
              </label>
              <input
                id="prod-stock"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="e.g., 18"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.stock && <p className="mt-1 text-xs text-rose-600">{formErrors.stock}</p>}
            </div>

            <div>
              <label htmlFor="prod-reorder" className="block text-xs font-medium text-slate-700">
                Low-Stock Alert Threshold
              </label>
              <input
                id="prod-reorder"
                type="number"
                min="0"
                step="1"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
              />
              {formErrors.reorderLevel && (
                <p className="mt-1 text-xs text-rose-600">{formErrors.reorderLevel}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="prod-unit" className="block text-xs font-medium text-slate-700">
                Unit Label
              </label>
              <input
                id="prod-unit"
                type="text"
                maxLength={30}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., Bag, Carton, Keg, Tin"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
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
              {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
