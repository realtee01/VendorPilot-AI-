import {
  BusinessSettings,
  DashboardPeriod,
  Expense,
  Product,
  SaleOrder,
  SalesRange,
} from '../types/business';
import {
  ChartPoint,
  DashboardMetrics,
  TopProductItem,
  getOutstandingBalance,
  getStockStatus,
} from './analytics';

export interface DashboardReportInput {
  settings: Pick<
    BusinessSettings,
    'businessName' | 'businessType' | 'currencyCode' | 'currencySymbol'
  >;
  period: DashboardPeriod;
  periodLabel: string;
  chartRange: SalesRange;
  metrics: DashboardMetrics;
  chartData: ChartPoint[];
  topProducts: TopProductItem[];
  sales: SaleOrder[];
  expenses: Expense[];
  lowStockProducts: Product[];
  generatedAt?: Date;
}

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV cell per RFC 4180 and mitigates CSV formula injection
 * on user-supplied strings while preserving numeric values (including negatives).
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }

  let text = String(value);
  if (FORMULA_PREFIX_RE.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(',');
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDashboardReportFilename(
  businessName: string,
  period: DashboardPeriod,
  generatedAt: Date = new Date()
): string {
  const slug = businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const safeBusiness = slug || 'business';
  return `vendorpilot-${safeBusiness}-${period}-report-${toIsoDate(generatedAt)}.csv`;
}

const CHART_RANGE_LABELS: Record<SalesRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '6m': 'Last 6 Months',
};

/**
 * Builds a structured, UTF-8 BOM-prefixed CSV report representing the
 * currently filtered DashboardView performance data.
 */
export function buildDashboardReportCsv(input: DashboardReportInput): string {
  const {
    settings,
    periodLabel,
    chartRange,
    metrics,
    chartData,
    topProducts,
    sales,
    expenses,
    lowStockProducts,
    generatedAt = new Date(),
  } = input;

  const currency = settings.currencyCode || 'NGN';
  const rows: string[] = [];

  // 1. Report Metadata
  rows.push(toCsvRow(['VendorPilot AI Dashboard Performance Report']));
  rows.push(toCsvRow(['Business Name', settings.businessName || 'My Business']));
  rows.push(toCsvRow(['Business Category', settings.businessType || 'Not specified']));
  rows.push(toCsvRow(['Selected Period', periodLabel]));
  rows.push(toCsvRow(['Chart Trend Range', CHART_RANGE_LABELS[chartRange]]));
  rows.push(toCsvRow(['Currency', `${currency} (${settings.currencySymbol || '₦'})`]));
  rows.push(toCsvRow(['Generated Date', toIsoDate(generatedAt)]));
  rows.push('');

  // 2. Key Performance Metrics
  rows.push(toCsvRow(['Key Business Metrics']));
  rows.push(toCsvRow(['Metric', `Value (${currency}) / Count`]));
  rows.push(toCsvRow(['Total Revenue', metrics.totalRevenue]));
  rows.push(toCsvRow(['Collected Revenue', metrics.collectedRevenue]));
  rows.push(toCsvRow(['Total Expenses', metrics.totalExpenses]));
  rows.push(toCsvRow(['Estimated Net Profit', metrics.netProfit]));
  rows.push(toCsvRow(['Estimated Profit Margin (%)', metrics.profitMarginPct]));
  rows.push(toCsvRow(['Outstanding Payments', metrics.outstandingPayments]));
  rows.push(toCsvRow(['Total Orders', metrics.totalOrders]));
  rows.push(toCsvRow(['Unpaid / Partial Orders', metrics.unpaidOrderCount]));
  rows.push(toCsvRow(['Total Products', metrics.totalProducts]));
  rows.push(toCsvRow(['Low-Stock Products', metrics.lowStockCount]));
  rows.push(toCsvRow(['Out-of-Stock Products', metrics.outOfStockCount]));
  rows.push(toCsvRow(['Inventory Retail Stock Value', metrics.inventoryValuation]));
  rows.push('');

  // 3. Sales Performance Chart Series
  rows.push(toCsvRow([`Sales Performance Trend (${CHART_RANGE_LABELS[chartRange]})`]));
  rows.push(
    toCsvRow([
      'Period Bucket',
      `Revenue (${currency})`,
      `Expenses (${currency})`,
      `Net Profit (${currency})`,
    ])
  );
  if (chartData.length === 0) {
    rows.push(toCsvRow(['No chart data available', 0, 0, 0]));
  } else {
    for (const point of chartData) {
      rows.push(toCsvRow([point.label, point.revenue, point.expenses, point.profit]));
    }
  }
  rows.push('');

  // 4. Top-Selling Products
  rows.push(toCsvRow([`Top-Selling Products (${periodLabel})`]));
  rows.push(
    toCsvRow(['Rank', 'Product Name', 'Units Sold', `Revenue (${currency})`, 'Revenue Share (%)'])
  );
  if (topProducts.length === 0) {
    rows.push(toCsvRow(['-', 'No product sales recorded in this period', 0, 0, 0]));
  } else {
    topProducts.forEach((item, index) => {
      rows.push(
        toCsvRow([index + 1, item.productName, item.unitsSold, item.revenue, item.sharePct])
      );
    });
  }
  rows.push('');

  // 5. Filtered Sales Transactions
  rows.push(toCsvRow([`Sales Transactions (${periodLabel})`]));
  rows.push(
    toCsvRow([
      'Order Number',
      'Date',
      'Customer',
      'Product',
      'Quantity',
      `Unit Price (${currency})`,
      `Total Amount (${currency})`,
      `Amount Paid (${currency})`,
      `Outstanding Balance (${currency})`,
      'Payment Status',
      'Payment Method',
    ])
  );
  if (sales.length === 0) {
    rows.push(toCsvRow(['No sales recorded in this period']));
  } else {
    for (const sale of sales) {
      rows.push(
        toCsvRow([
          sale.orderNumber,
          sale.date,
          sale.customerName,
          sale.productName,
          sale.quantity,
          sale.unitPrice,
          sale.totalAmount,
          sale.amountPaid,
          getOutstandingBalance(sale),
          sale.paymentStatus,
          sale.paymentMethod,
        ])
      );
    }
  }
  rows.push('');

  // 6. Filtered Expenses
  rows.push(toCsvRow([`Operating Expenses (${periodLabel})`]));
  rows.push(
    toCsvRow(['Date', 'Category', 'Description', `Amount (${currency})`, 'Vendor', 'Payment Method'])
  );
  if (expenses.length === 0) {
    rows.push(toCsvRow(['No expenses recorded in this period']));
  } else {
    for (const expense of expenses) {
      rows.push(
        toCsvRow([
          expense.date,
          expense.category,
          expense.description,
          expense.amount,
          expense.vendor,
          expense.paymentMethod,
        ])
      );
    }
  }
  rows.push('');

  // 7. Low-Stock Alerts
  rows.push(toCsvRow(['Low-Stock Inventory Alerts']));
  rows.push(
    toCsvRow(['Product Name', 'SKU', 'Category', 'Current Stock', 'Reorder Level', 'Stock Status'])
  );
  if (lowStockProducts.length === 0) {
    rows.push(toCsvRow(['All products are above their reorder threshold']));
  } else {
    for (const product of lowStockProducts) {
      rows.push(
        toCsvRow([
          product.name,
          product.sku,
          product.category,
          product.stock,
          product.reorderLevel,
          getStockStatus(product),
        ])
      );
    }
  }

  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
