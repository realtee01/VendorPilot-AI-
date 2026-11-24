import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboardReportCsv,
  buildDashboardReportFilename,
  escapeCsvCell,
} from './reportCsv';
import {
  buildSalesPerformanceSeries,
  calculateDashboardMetrics,
  filterRecordsByPeriod,
  getLowStockProducts,
  getTopSellingProducts,
} from './analytics';
import { Expense, Product, SaleOrder } from '../types/business';

const sampleProducts: Product[] = [
  {
    id: 'p1',
    userId: 'u1',
    name: 'Mama Gold Rice 50kg',
    sku: 'MG-RICE-50',
    category: 'Grains & Staples',
    unit: 'Bag',
    costPrice: 72000,
    unitPrice: 82000,
    stock: 3,
    reorderLevel: 5,
    updatedAt: '2026-11-24',
  },
  {
    id: 'p2',
    userId: 'u1',
    name: 'Kings Oil 25L',
    sku: 'KO-25L',
    category: 'Cooking Oils',
    unit: 'Keg',
    costPrice: 54000,
    unitPrice: 61000,
    stock: 20,
    reorderLevel: 6,
    updatedAt: '2026-11-24',
  },
];

const sampleSales: SaleOrder[] = [
  {
    id: 's1',
    userId: 'u1',
    orderNumber: 'ORD-101',
    date: '2026-11-24',
    customerName: 'Mama Nkechi, Ventures',
    customerPhone: '08030000001',
    productId: 'p1',
    productName: 'Mama Gold Rice 50kg',
    quantity: 2,
    unitPrice: 82000,
    totalAmount: 164000,
    amountPaid: 100000,
    paymentStatus: 'Partial',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 's2',
    userId: 'u1',
    orderNumber: 'ORD-102',
    date: '2026-11-10',
    customerName: '=HYPERLINK("https://evil.example","Click")',
    customerPhone: '08030000002',
    productId: 'p2',
    productName: 'Kings Oil 25L',
    quantity: 1,
    unitPrice: 61000,
    totalAmount: 61000,
    amountPaid: 61000,
    paymentStatus: 'Paid',
    paymentMethod: 'POS Terminal',
  },
];

const sampleExpenses: Expense[] = [
  {
    id: 'e1',
    userId: 'u1',
    date: '2026-11-24',
    category: 'Power & Generator Fuel',
    description: 'Generator diesel "25L" refill',
    amount: 45000,
    vendor: 'TotalEnergies',
    paymentMethod: 'Cash',
  },
  {
    id: 'e2',
    userId: 'u1',
    date: '2026-11-10',
    category: 'Logistics & Delivery',
    description: 'Dispatch van to Ikeja',
    amount: 250000,
    vendor: 'GIG Logistics',
    paymentMethod: 'Bank Transfer',
  },
];

test('escapeCsvCell handles commas, quotes, newlines, negative numbers, and formula injection', () => {
  assert.equal(escapeCsvCell('Plain text'), 'Plain text');
  assert.equal(escapeCsvCell('A, B'), '"A, B"');
  assert.equal(escapeCsvCell('Quote "test"'), '"Quote ""test"""');
  assert.equal(escapeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
  assert.equal(escapeCsvCell(-25000), '-25000');
  assert.equal(escapeCsvCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  assert.equal(escapeCsvCell('+cmd|calc'), "'+cmd|calc");
  assert.equal(escapeCsvCell('-1+1'), "'-1+1");
  assert.equal(escapeCsvCell('@IMPORT'), "'@IMPORT");
});

test('buildDashboardReportFilename produces a sanitized period-specific csv filename', () => {
  const filename = buildDashboardReportFilename(
    'Adebayo & Sons Wholesale!',
    'monthly',
    new Date(2026, 10, 24)
  );
  assert.equal(filename, 'vendorpilot-adebayo-sons-wholesale-monthly-report-2026-11-24.csv');
});

test('buildDashboardReportCsv serializes filtered metrics, chart series, sales, expenses, and neutralizes formulas', () => {
  const refIso = '2026-11-24';
  const refDate = new Date(2026, 10, 24);
  const filtered = filterRecordsByPeriod(sampleSales, sampleExpenses, 'monthly', refIso);
  const metrics = calculateDashboardMetrics(filtered.sales, filtered.expenses, sampleProducts);
  const topProducts = getTopSellingProducts(filtered.sales, 5);
  const chartData = buildSalesPerformanceSeries(sampleSales, sampleExpenses, '30d', refIso);
  const lowStock = getLowStockProducts(sampleProducts);

  const csv = buildDashboardReportCsv({
    settings: {
      businessName: 'Adebayo Stores',
      businessType: 'FMCG Wholesale',
      currencyCode: 'NGN',
      currencySymbol: '₦',
    },
    period: 'monthly',
    periodLabel: filtered.periodLabel,
    chartRange: '30d',
    metrics,
    chartData,
    topProducts,
    sales: filtered.sales,
    expenses: filtered.expenses,
    lowStockProducts: lowStock,
    generatedAt: refDate,
  });

  // UTF-8 BOM for Excel Naira symbol compatibility
  assert.ok(csv.startsWith('\uFEFFVendorPilot AI Dashboard Performance Report\r\n'));
  // Filtered KPIs (Revenue 225,000, Expenses 295,000, Net Profit -70,000, Outstanding 64,000)
  assert.ok(csv.includes('Total Revenue,225000\r\n'));
  assert.ok(csv.includes('Total Expenses,295000\r\n'));
  assert.ok(csv.includes('Estimated Net Profit,-70000\r\n'));
  assert.ok(csv.includes('Outstanding Payments,64000\r\n'));
  assert.ok(csv.includes('Low-Stock Products,1\r\n'));
  // Quoted comma & quote escaping
  assert.ok(csv.includes('"Mama Nkechi, Ventures"'));
  assert.ok(csv.includes('"Generator diesel ""25L"" refill"'));
  // Formula injection neutralized
  assert.ok(csv.includes('"\'=HYPERLINK(""https://evil.example"",""Click"")"'));
  // Low-stock section includes Mama Gold Rice
  assert.ok(csv.includes('Mama Gold Rice 50kg,MG-RICE-50,Grains & Staples,3,5,Low Stock'));
});

test('buildDashboardReportCsv handles empty filtered period cleanly without NaN', () => {
  const refDate = new Date(2026, 10, 24);
  const metrics = calculateDashboardMetrics([], [], []);
  const csv = buildDashboardReportCsv({
    settings: {
      businessName: 'Fresh SME',
      businessType: 'Retail',
      currencyCode: 'NGN',
      currencySymbol: '₦',
    },
    period: 'daily',
    periodLabel: 'Today',
    chartRange: '7d',
    metrics,
    chartData: [],
    topProducts: [],
    sales: [],
    expenses: [],
    lowStockProducts: [],
    generatedAt: refDate,
  });

  assert.ok(!csv.includes('NaN'));
  assert.ok(!csv.includes('undefined'));
  assert.ok(csv.includes('Total Revenue,0\r\n'));
  assert.ok(csv.includes('No sales recorded in this period\r\n'));
  assert.ok(csv.includes('No expenses recorded in this period\r\n'));
  assert.ok(csv.includes('All products are above their reorder threshold\r\n'));
});
