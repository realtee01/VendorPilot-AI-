import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessAnalyticsReport } from './assistantAnalytics';
import { decodeFirestoreFields, decodeFirestoreValue } from '../server/firestoreRest';
import { Expense, Product, SaleOrder } from '../types/business';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod_rice',
    userId: 'user_1',
    sku: 'GRN-001',
    name: 'Mama Gold 50kg Rice',
    category: 'Grains & Staples',
    unit: 'Bag',
    costPrice: 70000,
    unitPrice: 85000,
    stock: 4,
    reorderLevel: 10,
    updatedAt: '2026-11-24',
  },
  {
    id: 'prod_oil',
    userId: 'user_1',
    sku: 'OIL-002',
    name: 'Devon Kings 25L Oil',
    category: 'Cooking Oils',
    unit: 'Keg',
    costPrice: 40000,
    unitPrice: 52000,
    stock: 0,
    reorderLevel: 5,
    updatedAt: '2026-11-24',
  },
  {
    id: 'prod_garri',
    userId: 'user_1',
    sku: 'GRN-003',
    name: 'Ijebu Garri 25kg',
    category: 'Grains & Staples',
    unit: 'Bag',
    costPrice: 20000,
    unitPrice: 28000,
    stock: 30,
    reorderLevel: 8,
    updatedAt: '2026-11-24',
  },
];

const SAMPLE_SALES: SaleOrder[] = [
  {
    id: 'sale_1',
    orderNumber: 'VP-1001',
    userId: 'user_1',
    date: '2026-11-24',
    productId: 'prod_rice',
    productName: 'Mama Gold 50kg Rice',
    quantity: 5,
    unitPrice: 85000,
    totalAmount: 425000,
    amountPaid: 425000,
    customerName: 'Bola Stores',
    customerPhone: '08031112222',
    paymentStatus: 'Paid',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'sale_2',
    orderNumber: 'VP-1002',
    userId: 'user_1',
    date: '2026-11-20',
    productId: 'prod_oil',
    productName: 'Devon Kings 25L Oil',
    quantity: 4,
    unitPrice: 52000,
    totalAmount: 208000,
    amountPaid: 100000,
    customerName: 'Chidi Mart',
    customerPhone: '08053334444',
    paymentStatus: 'Partial',
    paymentMethod: 'POS Terminal',
  },
  {
    id: 'sale_3',
    orderNumber: 'VP-1003',
    userId: 'user_1',
    date: '2026-11-05',
    productId: 'prod_garri',
    productName: 'Ijebu Garri 25kg',
    quantity: 10,
    unitPrice: 28000,
    totalAmount: 280000,
    amountPaid: 0,
    customerName: 'Chidi Mart',
    customerPhone: '08053334444',
    paymentStatus: 'Pending',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'sale_4',
    orderNumber: 'VP-1004',
    userId: 'user_1',
    date: '2026-10-15',
    productId: 'prod_rice',
    productName: 'Mama Gold 50kg Rice',
    quantity: 3,
    unitPrice: 85000,
    totalAmount: 255000,
    amountPaid: 255000,
    customerName: 'Kano Wholesale',
    customerPhone: '08090001111',
    paymentStatus: 'Paid',
    paymentMethod: 'Bank Transfer',
  },
];

const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    userId: 'user_1',
    date: '2026-11-22',
    category: 'Power & Generator Fuel',
    description: 'Diesel refill for warehouse generator',
    vendor: 'TotalEnergies Ikeja',
    amount: 95000,
    paymentMethod: 'POS Terminal',
  },
  {
    id: 'exp_2',
    userId: 'user_1',
    date: '2026-11-10',
    category: 'Logistics & Delivery',
    description: 'Interstate van dispatch to Ibadan',
    vendor: 'GIG Logistics',
    amount: 140000,
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'exp_3',
    userId: 'user_1',
    date: '2026-10-18',
    category: 'Staff Salaries',
    description: 'October storekeeper wages',
    vendor: 'Payroll',
    amount: 120000,
    paymentMethod: 'Bank Transfer',
  },
];

test('buildBusinessAnalyticsReport computes exact all-time, monthly, and weekly financials', () => {
  const report = buildBusinessAnalyticsReport({
    settings: {
      businessName: 'Lagos Staples Ltd',
      businessType: 'Wholesale Distribution',
      ownerName: 'Amina Okafor',
      currencyCode: 'NGN',
      currencySymbol: '₦',
    },
    sales: SAMPLE_SALES,
    expenses: SAMPLE_EXPENSES,
    products: SAMPLE_PRODUCTS,
    referenceIsoDate: '2026-11-24',
  });

  // All-time totals
  assert.equal(report.allTime.totalRevenue, 1168000);
  assert.equal(report.allTime.collectedRevenue, 780000);
  assert.equal(report.allTime.outstandingPayments, 388000);
  assert.equal(report.allTime.totalExpenses, 355000);
  assert.equal(report.allTime.netProfit, 813000);
  assert.equal(report.allTime.totalUnitsSold, 22);
  // Gross profit: Rice (15k * 8 = 120k) + Oil (12k * 4 = 48k) + Garri (8k * 10 = 80k) = 248k
  assert.equal(report.allTime.estimatedGrossProfit, 248000);
  assert.equal(report.allTime.grossProfitCoveragePct, 100);

  // Weekly summary (2026-11-18 to 2026-11-24): sale_1 + sale_2, exp_1
  assert.equal(report.weeklySummary.startDate, '2026-11-18');
  assert.equal(report.weeklySummary.endDate, '2026-11-24');
  assert.equal(report.weeklySummary.revenue, 633000);
  assert.equal(report.weeklySummary.expenses, 95000);
  assert.equal(report.weeklySummary.estimatedNetProfit, 538000);
  assert.equal(report.weeklySummary.orderCount, 2);

  // Monthly summary (November 2026 MTD): sale_1 + sale_2 + sale_3, exp_1 + exp_2
  assert.equal(report.monthlySummary.startDate, '2026-11-01');
  assert.equal(report.monthlySummary.revenue, 913000);
  assert.equal(report.monthlySummary.expenses, 235000);
  assert.equal(report.monthlySummary.estimatedNetProfit, 678000);
  assert.equal(report.monthlySummary.previousPeriodRevenue, 255000);

  // Top products by revenue vs by units
  assert.equal(report.topSellingByRevenue[0].productName, 'Mama Gold 50kg Rice');
  assert.equal(report.topSellingByRevenue[0].revenue, 680000);
  assert.equal(report.topSellingByUnits[0].productName, 'Ijebu Garri 25kg');
  assert.equal(report.topSellingByUnits[0].unitsSold, 10);

  // Biggest expenses and debtors
  assert.equal(report.biggestExpensesAllTime[0].vendor, 'GIG Logistics');
  assert.equal(report.biggestExpensesAllTime[0].amount, 140000);
  assert.equal(report.outstandingCustomers.length, 1);
  assert.equal(report.outstandingCustomers[0].customerName, 'Chidi Mart');
  assert.equal(report.outstandingCustomers[0].totalOwed, 388000);
  assert.equal(report.outstandingCustomers[0].unpaidOrderCount, 2);

  // Low-stock alerts (out-of-stock first)
  assert.equal(report.lowStockAlerts.length, 2);
  assert.equal(report.lowStockAlerts[0].productName, 'Devon Kings 25L Oil');
  assert.equal(report.lowStockAlerts[0].status, 'Out of Stock');
  assert.equal(report.lowStockAlerts[1].productName, 'Mama Gold 50kg Rice');
  assert.equal(report.lowStockAlerts[1].status, 'Low Stock');
});

test('buildBusinessAnalyticsReport handles completely empty records without NaN or fabricated data', () => {
  const report = buildBusinessAnalyticsReport({
    settings: { businessName: 'Fresh SME' },
    sales: [],
    expenses: [],
    products: [],
    referenceIsoDate: '2026-11-24',
  });

  assert.equal(report.dataAvailability.hasSales, false);
  assert.equal(report.dataAvailability.hasExpenses, false);
  assert.equal(report.dataAvailability.hasInventory, false);
  assert.equal(report.allTime.totalRevenue, 0);
  assert.equal(report.allTime.totalExpenses, 0);
  assert.equal(report.allTime.netProfit, 0);
  assert.equal(report.allTime.profitMarginPct, 0);
  assert.equal(report.allTime.averageOrderValue, 0);
  assert.equal(report.allTime.estimatedGrossProfit, null);
  assert.equal(report.weeklySummary.revenue, 0);
  assert.equal(report.monthlySummary.revenue, 0);
  assert.equal(report.monthlySummary.revenueChangePct, null);
  assert.equal(report.topSellingByRevenue.length, 0);
  assert.equal(report.lowStockAlerts.length, 0);
  assert.equal(report.outstandingCustomers.length, 0);
});

test('Firestore REST decoders handle strings, 64-bit integer strings, doubles, booleans, and timestamps', () => {
  assert.equal(decodeFirestoreValue({ integerValue: '85000' }), 85000);
  assert.equal(decodeFirestoreValue({ doubleValue: 7.5 }), 7.5);
  assert.equal(decodeFirestoreValue({ booleanValue: true }), true);
  assert.equal(decodeFirestoreValue({ nullValue: null }), null);

  const decoded = decodeFirestoreFields({
    product: { stringValue: '50kg Rice' },
    quantity: { integerValue: '12' },
    totalAmount: { doubleValue: 1020000.5 },
    createdAt: { timestampValue: '2026-11-24T10:00:00Z' },
  });

  assert.deepEqual(decoded, {
    product: '50kg Rice',
    quantity: 12,
    totalAmount: 1020000.5,
    createdAt: '2026-11-24T10:00:00Z',
  });
});
