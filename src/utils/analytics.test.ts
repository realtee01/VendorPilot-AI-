import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNewSaleToInventory,
  buildSalesPerformanceSeries,
  calculateDashboardMetrics,
  computeSaleStockDelta,
  filterRecordsByPeriod,
  formatNaira,
  getExpenseByCategory,
  getLowStockProducts,
  getOutstandingBalance,
  getTopSellingProducts,
  validateExpenseInput,
  validateProductInput,
  validateSaleInput,
} from './analytics';
import { Expense, Product, SaleOrder } from '../types/business';

const TEST_UID = 'user-test-123';

const FIXTURE_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    userId: TEST_UID,
    sku: 'MG-RIC-50K',
    name: 'Mama Gold Parboiled Rice (50kg)',
    category: 'Grains & Staples',
    unit: 'Bag',
    costPrice: 74000,
    unitPrice: 84500,
    stock: 22,
    reorderLevel: 10,
    updatedAt: '2026-11-23',
  },
  {
    id: 'prod-2',
    userId: TEST_UID,
    sku: 'KG-OIL-05L',
    name: "Devon King's Vegetable Oil (5L)",
    category: 'Cooking Oils',
    unit: 'Keg',
    costPrice: 14200,
    unitPrice: 17500,
    stock: 6,
    reorderLevel: 12,
    updatedAt: '2026-11-24',
  },
  {
    id: 'prod-3',
    userId: TEST_UID,
    sku: 'PW-OIL-03L',
    name: 'Power Oil Bottle (3L)',
    category: 'Cooking Oils',
    unit: 'Bottle',
    costPrice: 8900,
    unitPrice: 11200,
    stock: 0,
    reorderLevel: 10,
    updatedAt: '2026-11-24',
  },
];

const FIXTURE_SALES: SaleOrder[] = [
  {
    id: 'sale-1',
    orderNumber: 'VP-1001',
    userId: TEST_UID,
    date: '2026-11-24',
    productId: 'prod-1',
    productName: 'Mama Gold Parboiled Rice (50kg)',
    quantity: 5,
    unitPrice: 84500,
    totalAmount: 422500,
    amountPaid: 422500,
    customerName: 'Amaka Nwosu',
    customerPhone: '0803 441 9082',
    paymentStatus: 'Paid',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'sale-2',
    orderNumber: 'VP-1002',
    userId: TEST_UID,
    date: '2026-11-23',
    productId: 'prod-2',
    productName: "Devon King's Vegetable Oil (5L)",
    quantity: 8,
    unitPrice: 17500,
    totalAmount: 140000,
    amountPaid: 80000,
    customerName: 'Tunde Bakare Stores',
    customerPhone: '0809 218 5531',
    paymentStatus: 'Partial',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'sale-3',
    orderNumber: 'VP-1003',
    userId: TEST_UID,
    date: '2026-11-22',
    productId: 'prod-3',
    productName: 'Power Oil Bottle (3L)',
    quantity: 10,
    unitPrice: 11200,
    totalAmount: 112000,
    amountPaid: 0,
    customerName: 'Funke Adesanya Bakery',
    customerPhone: '0812 908 3314',
    paymentStatus: 'Pending',
    paymentMethod: 'Bank Transfer',
  },
];

const FIXTURE_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    userId: TEST_UID,
    date: '2026-11-24',
    category: 'Inventory Restock',
    description: 'Wholesale staple purchase',
    vendor: 'Oke-Arin Hub',
    amount: 250000,
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'exp-2',
    userId: TEST_UID,
    date: '2026-11-23',
    category: 'Power & Generator Fuel',
    description: 'Diesel refill',
    vendor: 'TotalEnergies Surulere',
    amount: 75000,
    paymentMethod: 'POS Terminal',
  },
];

test('formatNaira formats Naira currency cleanly', () => {
  assert.equal(formatNaira(422500), '₦422,500');
  assert.equal(formatNaira(-15000), '-₦15,000');
  assert.equal(formatNaira(2_500_000, true), '₦2.5M');
  assert.equal(formatNaira(45_000, true), '₦45k');
});

test('calculateDashboardMetrics accurately aggregates revenue, expenses, profit, and outstanding balances', () => {
  const metrics = calculateDashboardMetrics(FIXTURE_SALES, FIXTURE_EXPENSES, FIXTURE_PRODUCTS);

  assert.equal(metrics.totalRevenue, 674500);
  assert.equal(metrics.totalExpenses, 325000);
  assert.equal(metrics.netProfit, 349500);
  assert.equal(metrics.outstandingPayments, 172000);
  assert.equal(metrics.unpaidOrderCount, 2);
  assert.equal(metrics.totalProducts, 3);
  assert.equal(metrics.outOfStockCount, 1);
  assert.equal(metrics.lowStockCount, 2);
});

test('getOutstandingBalance handles Paid, Pending, and Partial statuses', () => {
  assert.equal(getOutstandingBalance({ totalAmount: 100000, amountPaid: 100000, paymentStatus: 'Paid' }), 0);
  assert.equal(getOutstandingBalance({ totalAmount: 100000, amountPaid: 0, paymentStatus: 'Pending' }), 100000);
  assert.equal(getOutstandingBalance({ totalAmount: 100000, amountPaid: 35000, paymentStatus: 'Partial' }), 65000);
});

test('getLowStockProducts prioritizes out-of-stock products first', () => {
  const alerts = getLowStockProducts(FIXTURE_PRODUCTS);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].stock, 0);
  assert.equal(alerts[0].sku, 'PW-OIL-03L');
});

test('getTopSellingProducts ranks by revenue descending', () => {
  const top = getTopSellingProducts(FIXTURE_SALES, 3);
  assert.equal(top.length, 3);
  assert.equal(top[0].productName, 'Mama Gold Parboiled Rice (50kg)');
  assert.ok(top[0].revenue >= top[1].revenue);
  assert.ok(top[1].revenue >= top[2].revenue);
});

test('buildSalesPerformanceSeries produces exact bucket counts for 7d, 30d, and 6m', () => {
  assert.equal(buildSalesPerformanceSeries(FIXTURE_SALES, FIXTURE_EXPENSES, '7d', '2026-11-24').length, 7);
  assert.equal(buildSalesPerformanceSeries(FIXTURE_SALES, FIXTURE_EXPENSES, '30d', '2026-11-24').length, 5);
  assert.equal(buildSalesPerformanceSeries(FIXTURE_SALES, FIXTURE_EXPENSES, '6m', '2026-11-24').length, 6);
});

test('applyNewSaleToInventory decrements stock safely without going negative', () => {
  const updated = applyNewSaleToInventory(FIXTURE_PRODUCTS, 'prod-2', 4, '2026-11-24');
  assert.equal(updated.find((p) => p.id === 'prod-2')?.stock, 2);

  const clamped = applyNewSaleToInventory(FIXTURE_PRODUCTS, 'prod-2', 20, '2026-11-24');
  assert.equal(clamped.find((p) => p.id === 'prod-2')?.stock, 0);
});

test('getExpenseByCategory sorts highest spend category first', () => {
  const breakdown = getExpenseByCategory(FIXTURE_EXPENSES);
  assert.equal(breakdown[0].category, 'Inventory Restock');
});

test('form validators reject invalid inputs and accept valid inputs', () => {
  const badSale = validateSaleInput({
    productName: '',
    quantity: 0,
    unitPrice: -50,
    customerName: '   ',
    paymentStatus: 'Partial',
    amountPaid: 0,
  });
  assert.equal(badSale.valid, false);
  assert.ok(badSale.errors.productName);
  assert.ok(badSale.errors.quantity);
  assert.ok(badSale.errors.unitPrice);
  assert.ok(badSale.errors.customerName);
  assert.ok(badSale.errors.amountPaid);

  const goodSale = validateSaleInput({
    productName: 'Indomie Super Pack (Carton)',
    quantity: 3,
    unitPrice: 14200,
    customerName: 'Chinedu Okafor',
    paymentStatus: 'Paid',
    amountPaid: 42600,
  });
  assert.equal(goodSale.valid, true);

  const badExpense = validateExpenseInput({ description: '', vendor: '', amount: 0, date: '' });
  assert.equal(badExpense.valid, false);

  const badProduct = validateProductInput({
    name: '',
    sku: '',
    unitPrice: 0,
    costPrice: -10,
    stock: -1,
    reorderLevel: -1,
  });
  assert.equal(badProduct.valid, false);
});

test('filterRecordsByPeriod slices daily, weekly, monthly, and all-time records accurately', () => {
  const extendedSales: SaleOrder[] = [
    ...FIXTURE_SALES,
    {
      ...FIXTURE_SALES[0],
      id: 'sale-prev-month',
      orderNumber: 'VP-0999',
      date: '2026-10-12',
    },
  ];

  const daily = filterRecordsByPeriod(extendedSales, FIXTURE_EXPENSES, 'daily', '2026-11-24');
  assert.equal(daily.sales.length, 1);
  assert.equal(daily.expenses.length, 1);

  const weekly = filterRecordsByPeriod(extendedSales, FIXTURE_EXPENSES, 'weekly', '2026-11-24');
  assert.equal(weekly.sales.length, 3);
  assert.equal(weekly.expenses.length, 2);

  const monthly = filterRecordsByPeriod(extendedSales, FIXTURE_EXPENSES, 'monthly', '2026-11-24');
  assert.equal(monthly.sales.length, 3);

  const all = filterRecordsByPeriod(extendedSales, FIXTURE_EXPENSES, 'all', '2026-11-24');
  assert.equal(all.sales.length, 4);
});

test('computeSaleStockDelta adjusts inventory by net delta without duplicate deductions', () => {
  // Same quantity re-save -> zero stock change (no duplicate deduction)
  const unchanged = computeSaleStockDelta({
    previousProductId: 'prod-1',
    previousDeductedQty: 5,
    nextProductId: 'prod-1',
    nextQuantity: 5,
    currentStockByProductId: { 'prod-1': 17 },
  });
  assert.deepEqual(unchanged.adjustments, {});
  assert.equal(unchanged.nextStockDeductedQty, 5);

  // Increasing sale qty from 5 -> 8 deducts only +3 more units
  const increased = computeSaleStockDelta({
    previousProductId: 'prod-1',
    previousDeductedQty: 5,
    nextProductId: 'prod-1',
    nextQuantity: 8,
    currentStockByProductId: { 'prod-1': 17 },
  });
  assert.deepEqual(increased.adjustments, { 'prod-1': 14 });
  assert.equal(increased.nextStockDeductedQty, 8);

  // Decreasing sale qty from 5 -> 2 restores 3 units
  const decreased = computeSaleStockDelta({
    previousProductId: 'prod-1',
    previousDeductedQty: 5,
    nextProductId: 'prod-1',
    nextQuantity: 2,
    currentStockByProductId: { 'prod-1': 17 },
  });
  assert.deepEqual(decreased.adjustments, { 'prod-1': 20 });
  assert.equal(decreased.nextStockDeductedQty, 2);

  // Switching linked product restores old product and deducts new product
  const switched = computeSaleStockDelta({
    previousProductId: 'prod-1',
    previousDeductedQty: 5,
    nextProductId: 'prod-2',
    nextQuantity: 4,
    currentStockByProductId: { 'prod-1': 17, 'prod-2': 6 },
  });
  assert.deepEqual(switched.adjustments, { 'prod-1': 22, 'prod-2': 2 });
  assert.equal(switched.nextStockDeductedQty, 4);
});
