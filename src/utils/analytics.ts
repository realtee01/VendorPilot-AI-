import {
  Expense,
  ExpenseCategory,
  PaymentStatus,
  Product,
  SaleOrder,
  SalesRange,
} from '../types/business';

export interface DashboardMetrics {
  totalRevenue: number;
  collectedRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
  outstandingPayments: number;
  unpaidOrderCount: number;
  totalOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValuation: number;
}

export interface TopProductItem {
  productName: string;
  productId: string | null;
  unitsSold: number;
  revenue: number;
  sharePct: number;
}

export interface ChartPoint {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ExpenseCategorySummary {
  category: ExpenseCategory;
  total: number;
  count: number;
  sharePct: number;
}

export function formatNaira(amount: number, compact = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);

  if (compact) {
    if (abs >= 1_000_000) {
      return `${sign}₦${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}₦${(abs / 1_000).toFixed(0)}k`;
    }
  }

  return `${sign}₦${Math.round(abs).toLocaleString('en-NG')}`;
}

export function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return isoDate;
  }
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getOutstandingBalance(order: Pick<SaleOrder, 'totalAmount' | 'amountPaid' | 'paymentStatus'>): number {
  if (order.paymentStatus === 'Paid') return 0;
  return Math.max(0, order.totalAmount - order.amountPaid);
}

export function getStockStatus(product: Pick<Product, 'stock' | 'reorderLevel'>): 'Out of Stock' | 'Low Stock' | 'In Stock' {
  if (product.stock <= 0) return 'Out of Stock';
  if (product.stock <= product.reorderLevel) return 'Low Stock';
  return 'In Stock';
}

export function calculateDashboardMetrics(
  sales: SaleOrder[],
  expenses: Expense[],
  products: Product[]
): DashboardMetrics {
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const collectedRevenue = sales.reduce(
    (sum, s) => sum + (s.paymentStatus === 'Paid' ? s.totalAmount : Math.min(s.totalAmount, Math.max(0, s.amountPaid))),
    0
  );
  const outstandingPayments = sales.reduce((sum, s) => sum + getOutstandingBalance(s), 0);
  const unpaidOrderCount = sales.filter((s) => getOutstandingBalance(s) > 0).length;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPct = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const lowStockCount = products.filter((p) => p.stock <= p.reorderLevel).length;
  const inventoryValuation = products.reduce((sum, p) => sum + p.stock * p.unitPrice, 0);

  return {
    totalRevenue,
    collectedRevenue,
    totalExpenses,
    netProfit,
    profitMarginPct,
    outstandingPayments,
    unpaidOrderCount,
    totalOrders: sales.length,
    lowStockCount,
    outOfStockCount,
    inventoryValuation,
  };
}

export function getLowStockProducts(products: Product[]): Product[] {
  return products
    .filter((p) => p.stock <= p.reorderLevel)
    .sort((a, b) => {
      if (a.stock === 0 && b.stock > 0) return -1;
      if (b.stock === 0 && a.stock > 0) return 1;
      const ratioA = a.reorderLevel > 0 ? a.stock / a.reorderLevel : a.stock;
      const ratioB = b.reorderLevel > 0 ? b.stock / b.reorderLevel : b.stock;
      return ratioA - ratioB;
    });
}

export function getTopSellingProducts(sales: SaleOrder[], limit = 5): TopProductItem[] {
  const map = new Map<string, { productId: string | null; productName: string; unitsSold: number; revenue: number }>();

  for (const sale of sales) {
    const key = sale.productName.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.unitsSold += sale.quantity;
      existing.revenue += sale.totalAmount;
    } else {
      map.set(key, {
        productId: sale.productId,
        productName: sale.productName,
        unitsSold: sale.quantity,
        revenue: sale.totalAmount,
      });
    }
  }

  const all = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRev = all.reduce((sum, item) => sum + item.revenue, 0);

  return all.slice(0, limit).map((item) => ({
    ...item,
    sharePct: totalRev > 0 ? Number(((item.revenue / totalRev) * 100).toFixed(1)) : 0,
  }));
}

export function getExpenseByCategory(expenses: Expense[]): ExpenseCategorySummary[] {
  const map = new Map<ExpenseCategory, { total: number; count: number }>();
  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  for (const exp of expenses) {
    const prev = map.get(exp.category) ?? { total: 0, count: 0 };
    map.set(exp.category, { total: prev.total + exp.amount, count: prev.count + 1 });
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      sharePct: grandTotal > 0 ? Number(((data.total / grandTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildSalesPerformanceSeries(
  sales: SaleOrder[],
  expenses: Expense[],
  range: SalesRange,
  anchorIsoDate = new Date().toISOString().slice(0, 10)
): ChartPoint[] {
  const anchor = parseUtcDate(anchorIsoDate);

  if (range === '7d') {
    const points: ChartPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor.getTime() - i * 86_400_000);
      const iso = toIsoDate(d);
      const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const revenue = sales.filter((s) => s.date === iso).reduce((sum, s) => sum + s.totalAmount, 0);
      const exp = expenses.filter((e) => e.date === iso).reduce((sum, e) => sum + e.amount, 0);
      points.push({ label, revenue, expenses: exp, profit: revenue - exp });
    }
    return points;
  }

  if (range === '30d') {
    // 5 rolling 6-day buckets over the last 30 days
    const buckets: ChartPoint[] = [];
    for (let b = 4; b >= 0; b--) {
      const end = new Date(anchor.getTime() - b * 6 * 86_400_000);
      const start = new Date(end.getTime() - 5 * 86_400_000);
      const startIso = toIsoDate(start);
      const endIso = toIsoDate(end);
      const label = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}`;

      const revenue = sales
        .filter((s) => s.date >= startIso && s.date <= endIso)
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const exp = expenses
        .filter((e) => e.date >= startIso && e.date <= endIso)
        .reduce((sum, e) => sum + e.amount, 0);
      buckets.push({ label, revenue, expenses: exp, profit: revenue - exp });
    }
    return buckets;
  }

  // 6m monthly buckets
  const months: ChartPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const revenue = sales.filter((s) => s.date.startsWith(ym)).reduce((sum, s) => sum + s.totalAmount, 0);
    const exp = expenses.filter((e) => e.date.startsWith(ym)).reduce((sum, e) => sum + e.amount, 0);
    months.push({ label, revenue, expenses: exp, profit: revenue - exp });
  }
  return months;
}

export function applyNewSaleToInventory(
  products: Product[],
  productId: string | null,
  quantity: number,
  date: string
): Product[] {
  if (!productId || quantity <= 0) return products;
  return products.map((p) =>
    p.id === productId
      ? {
          ...p,
          stock: Math.max(0, p.stock - quantity),
          updatedAt: date,
        }
      : p
  );
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateSaleInput(input: {
  productName: string;
  quantity: number;
  unitPrice: number;
  customerName: string;
  paymentStatus: PaymentStatus;
  amountPaid: number;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.productName.trim()) {
    errors.productName = 'Select a product or enter a product name.';
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    errors.quantity = 'Quantity must be greater than 0.';
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    errors.unitPrice = 'Unit price must be greater than ₦0.';
  }
  if (!input.customerName.trim()) {
    errors.customerName = 'Customer name is required.';
  }
  const total = input.quantity * input.unitPrice;
  if (input.paymentStatus === 'Partial') {
    if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) {
      errors.amountPaid = 'Enter the partial amount received.';
    } else if (input.amountPaid >= total) {
      errors.amountPaid = 'Partial amount must be less than total order amount.';
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateExpenseInput(input: {
  description: string;
  vendor: string;
  amount: number;
  date: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.description.trim()) {
    errors.description = 'Expense description is required.';
  }
  if (!input.vendor.trim()) {
    errors.vendor = 'Vendor or payee name is required.';
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    errors.amount = 'Amount must be greater than ₦0.';
  }
  if (!input.date.trim()) {
    errors.date = 'Date is required.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateProductInput(input: {
  name: string;
  sku: string;
  unitPrice: number;
  costPrice: number;
  stock: number;
  reorderLevel: number;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) {
    errors.name = 'Product name is required.';
  }
  if (!input.sku.trim()) {
    errors.sku = 'SKU code is required.';
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    errors.unitPrice = 'Selling price must be greater than ₦0.';
  }
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) {
    errors.costPrice = 'Cost price cannot be negative.';
  }
  if (!Number.isFinite(input.stock) || input.stock < 0) {
    errors.stock = 'Stock quantity cannot be negative.';
  }
  if (!Number.isFinite(input.reorderLevel) || input.reorderLevel < 0) {
    errors.reorderLevel = 'Reorder threshold cannot be negative.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
