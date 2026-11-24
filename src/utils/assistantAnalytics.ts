import {
  BusinessSettings,
  Expense,
  ExpenseCategory,
  Product,
  SaleOrder,
} from '../types/business';
import {
  calculateDashboardMetrics,
  DashboardMetrics,
  ExpenseCategorySummary,
  getExpenseByCategory,
  getLowStockProducts,
  getOutstandingBalance,
  getTopSellingProducts,
  TopProductItem,
} from './analytics';

export interface PeriodSummary {
  label: string;
  startDate: string;
  endDate: string;
  revenue: number;
  collectedRevenue: number;
  outstandingBalance: number;
  expenses: number;
  estimatedNetProfit: number;
  profitMarginPct: number;
  orderCount: number;
  expenseCount: number;
  unitsSold: number;
  previousPeriodRevenue: number;
  previousPeriodExpenses: number;
  revenueChangePct: number | null;
  topProducts: TopProductItem[];
  topExpenseCategories: ExpenseCategorySummary[];
}

export interface CustomerReceivable {
  customerName: string;
  customerPhone: string;
  unpaidOrderCount: number;
  totalOwed: number;
}

export interface LowStockAlertItem {
  productId: string;
  sku: string;
  productName: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  status: 'Out of Stock' | 'Low Stock';
  sellingPrice: number;
  suggestedRestockQty: number;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  estimatedNetProfit: number;
  orderCount: number;
  expenseCount: number;
}

export interface BiggestExpenseItem {
  date: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amount: number;
}

export interface BusinessAnalyticsReport {
  generatedOnDate: string;
  currencyCode: string;
  currencySymbol: string;
  businessProfile: {
    businessName: string;
    businessType: string;
    ownerName: string;
    address: string;
  };
  dataAvailability: {
    hasSales: boolean;
    hasExpenses: boolean;
    hasInventory: boolean;
    hasThisWeekSales: boolean;
    hasThisWeekExpenses: boolean;
    hasThisMonthSales: boolean;
    hasThisMonthExpenses: boolean;
    totalSalesRecords: number;
    totalExpenseRecords: number;
    totalInventoryRecords: number;
  };
  allTime: DashboardMetrics & {
    averageOrderValue: number;
    totalUnitsSold: number;
    cashflowNet: number;
    estimatedGrossProfit: number | null;
    grossProfitCoveragePct: number;
    inventoryCostValuation: number;
  };
  weeklySummary: PeriodSummary;
  monthlySummary: PeriodSummary;
  monthlyTrendLast6Months: MonthlyTrendPoint[];
  topSellingByRevenue: TopProductItem[];
  topSellingByUnits: TopProductItem[];
  expenseByCategoryAllTime: ExpenseCategorySummary[];
  biggestExpensesAllTime: BiggestExpenseItem[];
  outstandingCustomers: CustomerReceivable[];
  lowStockAlerts: LowStockAlertItem[];
  operationalSignals: string[];
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function roundPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(1));
}

function parseUtcIsoDate(isoDate: string): Date {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function formatUtcIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function formatMonthLabel(year: number, monthIndexZeroBased: number): string {
  const d = new Date(Date.UTC(year, monthIndexZeroBased, 1));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function summarizePeriod(
  label: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  sales: SaleOrder[],
  expenses: Expense[]
): PeriodSummary {
  const periodSales = sales.filter((s) => s.date >= startDate && s.date <= endDate);
  const periodExpenses = expenses.filter((e) => e.date >= startDate && e.date <= endDate);

  const prevSales = sales.filter((s) => s.date >= prevStartDate && s.date <= prevEndDate);
  const prevExpenses = expenses.filter((e) => e.date >= prevStartDate && e.date <= prevEndDate);

  const revenue = roundMoney(periodSales.reduce((sum, s) => sum + s.totalAmount, 0));
  const collectedRevenue = roundMoney(
    periodSales.reduce(
      (sum, s) =>
        sum + (s.paymentStatus === 'Paid' ? s.totalAmount : Math.min(s.totalAmount, Math.max(0, s.amountPaid))),
      0
    )
  );
  const outstandingBalance = roundMoney(
    periodSales.reduce((sum, s) => sum + getOutstandingBalance(s), 0)
  );
  const totalExpenses = roundMoney(periodExpenses.reduce((sum, e) => sum + e.amount, 0));
  const estimatedNetProfit = roundMoney(revenue - totalExpenses);
  const profitMarginPct = revenue > 0 ? roundPct((estimatedNetProfit / revenue) * 100) : 0;
  const unitsSold = periodSales.reduce((sum, s) => sum + s.quantity, 0);

  const previousPeriodRevenue = roundMoney(prevSales.reduce((sum, s) => sum + s.totalAmount, 0));
  const previousPeriodExpenses = roundMoney(prevExpenses.reduce((sum, e) => sum + e.amount, 0));
  const revenueChangePct =
    previousPeriodRevenue > 0
      ? roundPct(((revenue - previousPeriodRevenue) / previousPeriodRevenue) * 100)
      : null;

  return {
    label,
    startDate,
    endDate,
    revenue,
    collectedRevenue,
    outstandingBalance,
    expenses: totalExpenses,
    estimatedNetProfit,
    profitMarginPct,
    orderCount: periodSales.length,
    expenseCount: periodExpenses.length,
    unitsSold,
    previousPeriodRevenue,
    previousPeriodExpenses,
    revenueChangePct,
    topProducts: getTopSellingProducts(periodSales, 5),
    topExpenseCategories: getExpenseByCategory(periodExpenses),
  };
}

export function getTopSellingProductsByUnits(sales: SaleOrder[], limit = 5): TopProductItem[] {
  const map = new Map<string, { productId: string | null; productName: string; unitsSold: number; revenue: number }>();

  for (const sale of sales) {
    const key = sale.productName.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.unitsSold += sale.quantity;
      existing.revenue = roundMoney(existing.revenue + sale.totalAmount);
    } else {
      map.set(key, {
        productId: sale.productId,
        productName: sale.productName,
        unitsSold: sale.quantity,
        revenue: roundMoney(sale.totalAmount),
      });
    }
  }

  const all = Array.from(map.values()).sort(
    (a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue
  );
  const totalRev = all.reduce((sum, item) => sum + item.revenue, 0);

  return all.slice(0, limit).map((item) => ({
    ...item,
    sharePct: totalRev > 0 ? roundPct((item.revenue / totalRev) * 100) : 0,
  }));
}

export function getOutstandingCustomers(sales: SaleOrder[], limit = 10): CustomerReceivable[] {
  const map = new Map<string, CustomerReceivable>();

  for (const sale of sales) {
    const owed = getOutstandingBalance(sale);
    if (owed <= 0) continue;
    const key = sale.customerName.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.unpaidOrderCount += 1;
      existing.totalOwed = roundMoney(existing.totalOwed + owed);
      if (!existing.customerPhone && sale.customerPhone) {
        existing.customerPhone = sale.customerPhone;
      }
    } else {
      map.set(key, {
        customerName: sale.customerName,
        customerPhone: sale.customerPhone || '',
        unpaidOrderCount: 1,
        totalOwed: roundMoney(owed),
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalOwed - a.totalOwed)
    .slice(0, limit);
}

export function buildBusinessAnalyticsReport(params: {
  settings: Partial<BusinessSettings>;
  sales: SaleOrder[];
  expenses: Expense[];
  products: Product[];
  referenceIsoDate?: string;
}): BusinessAnalyticsReport {
  const { settings, sales, expenses, products } = params;
  const todayIso = params.referenceIsoDate || new Date().toISOString().slice(0, 10);
  const today = parseUtcIsoDate(todayIso);

  const baseMetrics = calculateDashboardMetrics(sales, expenses, products);
  const totalUnitsSold = sales.reduce((sum, s) => sum + s.quantity, 0);
  const averageOrderValue = sales.length > 0 ? roundMoney(baseMetrics.totalRevenue / sales.length) : 0;
  const cashflowNet = roundMoney(baseMetrics.collectedRevenue - baseMetrics.totalExpenses);

  // Estimate gross profit for sales linked to inventory items with a cost price
  const productById = new Map<string, Product>();
  const productByName = new Map<string, Product>();
  for (const p of products) {
    productById.set(p.id, p);
    productByName.set(p.name.trim().toLowerCase(), p);
  }

  let matchedSalesRevenue = 0;
  let matchedGrossProfit = 0;
  for (const sale of sales) {
    const prod =
      (sale.productId ? productById.get(sale.productId) : undefined) ??
      productByName.get(sale.productName.trim().toLowerCase());
    if (prod && prod.costPrice > 0) {
      matchedSalesRevenue += sale.totalAmount;
      matchedGrossProfit += (sale.unitPrice - prod.costPrice) * sale.quantity;
    }
  }
  const grossProfitCoveragePct =
    baseMetrics.totalRevenue > 0 ? roundPct((matchedSalesRevenue / baseMetrics.totalRevenue) * 100) : 0;
  const estimatedGrossProfit = matchedSalesRevenue > 0 ? roundMoney(matchedGrossProfit) : null;

  const inventoryCostValuation = roundMoney(
    products.reduce((sum, p) => sum + p.stock * p.costPrice, 0)
  );

  // Rolling 7-day weekly summary (inclusive of today) vs previous 7 days
  const weekStart = formatUtcIsoDate(addUtcDays(today, -6));
  const weekEnd = todayIso;
  const prevWeekStart = formatUtcIsoDate(addUtcDays(today, -13));
  const prevWeekEnd = formatUtcIsoDate(addUtcDays(today, -7));
  const weeklySummary = summarizePeriod(
    `Last 7 Days (${weekStart} to ${weekEnd})`,
    weekStart,
    weekEnd,
    prevWeekStart,
    prevWeekEnd,
    sales,
    expenses
  );

  // Current calendar month (month-to-date) vs full previous calendar month
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const monthStart = formatUtcIsoDate(new Date(Date.UTC(year, month, 1)));
  const monthEnd = todayIso;
  const prevMonthStart = formatUtcIsoDate(new Date(Date.UTC(year, month - 1, 1)));
  const prevMonthEnd = formatUtcIsoDate(new Date(Date.UTC(year, month, 0)));
  const monthlySummary = summarizePeriod(
    `${formatMonthLabel(year, month)} (Month-to-Date)`,
    monthStart,
    monthEnd,
    prevMonthStart,
    prevMonthEnd,
    sales,
    expenses
  );

  // Last 6 calendar months trend
  const monthlyTrendLast6Months: MonthlyTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const mSales = sales.filter((s) => s.date.startsWith(ym));
    const mExpenses = expenses.filter((e) => e.date.startsWith(ym));
    const rev = roundMoney(mSales.reduce((sum, s) => sum + s.totalAmount, 0));
    const exp = roundMoney(mExpenses.reduce((sum, e) => sum + e.amount, 0));
    monthlyTrendLast6Months.push({
      monthKey: ym,
      monthLabel: formatMonthLabel(d.getUTCFullYear(), d.getUTCMonth()),
      revenue: rev,
      expenses: exp,
      estimatedNetProfit: roundMoney(rev - exp),
      orderCount: mSales.length,
      expenseCount: mExpenses.length,
    });
  }

  const topSellingByRevenue = getTopSellingProducts(sales, 5);
  const topSellingByUnits = getTopSellingProductsByUnits(sales, 5);
  const expenseByCategoryAllTime = getExpenseByCategory(expenses);

  const biggestExpensesAllTime: BiggestExpenseItem[] = [...expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((e) => ({
      date: e.date,
      category: e.category,
      vendor: e.vendor,
      description: e.description,
      amount: roundMoney(e.amount),
    }));

  const outstandingCustomers = getOutstandingCustomers(sales, 10);

  const lowStockAlerts: LowStockAlertItem[] = getLowStockProducts(products).map((p) => {
    const targetStock = Math.max(p.reorderLevel * 2, p.reorderLevel + 5, 10);
    return {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      category: p.category,
      currentStock: p.stock,
      lowStockThreshold: p.reorderLevel,
      status: p.stock <= 0 ? 'Out of Stock' : 'Low Stock',
      sellingPrice: roundMoney(p.unitPrice),
      suggestedRestockQty: Math.max(1, targetStock - p.stock),
    };
  });

  // Deterministic operational signals (application logic)
  const operationalSignals: string[] = [];
  if (sales.length === 0) {
    operationalSignals.push('No sales orders have been recorded yet.');
  }
  if (expenses.length === 0) {
    operationalSignals.push('No business expenses have been recorded yet.');
  }
  if (products.length === 0) {
    operationalSignals.push('No inventory products have been added yet.');
  }
  if (baseMetrics.outOfStockCount > 0) {
    operationalSignals.push(
      `${baseMetrics.outOfStockCount} product(s) are completely out of stock and require immediate restocking.`
    );
  } else if (baseMetrics.lowStockCount > 0) {
    operationalSignals.push(
      `${baseMetrics.lowStockCount} product(s) are at or below their low-stock threshold.`
    );
  }
  if (baseMetrics.outstandingPayments > 0 && baseMetrics.totalRevenue > 0) {
    const ratio = roundPct((baseMetrics.outstandingPayments / baseMetrics.totalRevenue) * 100);
    operationalSignals.push(
      `${ratio}% of total revenue (${baseMetrics.unpaidOrderCount} order(s)) is still unpaid.`
    );
  }
  if (expenseByCategoryAllTime.length > 0 && expenseByCategoryAllTime[0].sharePct >= 35) {
    operationalSignals.push(
      `${expenseByCategoryAllTime[0].category} is the largest expense category at ${expenseByCategoryAllTime[0].sharePct}% of total spend.`
    );
  }
  if (baseMetrics.totalRevenue > 0 && baseMetrics.netProfit < 0) {
    operationalSignals.push(
      'Total recorded expenses currently exceed total recorded revenue, resulting in a net loss.'
    );
  }

  return {
    generatedOnDate: todayIso,
    currencyCode: settings.currencyCode || 'NGN',
    currencySymbol: settings.currencySymbol || '₦',
    businessProfile: {
      businessName: settings.businessName || 'Your Business',
      businessType: settings.businessType || 'SME',
      ownerName: settings.ownerName || 'Business Owner',
      address: settings.address || '',
    },
    dataAvailability: {
      hasSales: sales.length > 0,
      hasExpenses: expenses.length > 0,
      hasInventory: products.length > 0,
      hasThisWeekSales: weeklySummary.orderCount > 0,
      hasThisWeekExpenses: weeklySummary.expenseCount > 0,
      hasThisMonthSales: monthlySummary.orderCount > 0,
      hasThisMonthExpenses: monthlySummary.expenseCount > 0,
      totalSalesRecords: sales.length,
      totalExpenseRecords: expenses.length,
      totalInventoryRecords: products.length,
    },
    allTime: {
      ...baseMetrics,
      totalRevenue: roundMoney(baseMetrics.totalRevenue),
      collectedRevenue: roundMoney(baseMetrics.collectedRevenue),
      totalExpenses: roundMoney(baseMetrics.totalExpenses),
      netProfit: roundMoney(baseMetrics.netProfit),
      outstandingPayments: roundMoney(baseMetrics.outstandingPayments),
      inventoryValuation: roundMoney(baseMetrics.inventoryValuation),
      averageOrderValue,
      totalUnitsSold,
      cashflowNet,
      estimatedGrossProfit,
      grossProfitCoveragePct,
      inventoryCostValuation,
    },
    weeklySummary,
    monthlySummary,
    monthlyTrendLast6Months,
    topSellingByRevenue,
    topSellingByUnits,
    expenseByCategoryAllTime,
    biggestExpensesAllTime,
    outstandingCustomers,
    lowStockAlerts,
    operationalSignals,
  };
}
