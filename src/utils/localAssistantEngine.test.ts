import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerBusinessQuestion,
  getPrebuiltQuestionCount,
  PREBUILT_QA_CATALOG,
} from './localAssistantEngine';
import { BusinessSettings, Customer, Expense, Product, SaleOrder } from '../types/business';

const testSettings: Partial<BusinessSettings> = {
  userId: 'u-tobi',
  businessId: 'u-tobi',
  ownerName: 'Tobi Akala',
  email: 'tobilobaakala@gmail.com',
  businessName: 'Workgo',
  businessType: 'FMCG Wholesale',
  currencyCode: 'NGN',
  currencySymbol: '₦',
};

const testProducts: Product[] = [
  {
    id: 'p1',
    userId: 'u-tobi',
    sku: 'MG-RICE-50',
    name: 'Mama Gold Rice 50kg',
    category: 'Grains & Staples',
    unit: 'Bag',
    costPrice: 70000,
    unitPrice: 82000,
    stock: 3,
    reorderLevel: 5,
    updatedAt: '2026-11-24',
  },
  {
    id: 'p2',
    userId: 'u-tobi',
    sku: 'KO-25L',
    name: 'Kings Oil 25L',
    category: 'Cooking Oils',
    unit: 'Keg',
    costPrice: 52000,
    unitPrice: 60000,
    stock: 18,
    reorderLevel: 6,
    updatedAt: '2026-11-24',
  },
  {
    id: 'p3',
    userId: 'u-tobi',
    sku: 'IND-CTN',
    name: 'Indomie Super Pack Carton',
    category: 'Packaged Foods',
    unit: 'Carton',
    costPrice: 9500,
    unitPrice: 12000,
    stock: 12,
    reorderLevel: 4,
    updatedAt: '2026-11-24',
  },
];

const testSales: SaleOrder[] = [
  {
    id: 's1',
    orderNumber: 'ORD-201',
    userId: 'u-tobi',
    date: '2026-11-24',
    productId: 'p1',
    productName: 'Mama Gold Rice 50kg',
    quantity: 5,
    unitPrice: 82000,
    totalAmount: 410000,
    amountPaid: 300000,
    customerName: 'Mama Nkechi Stores',
    customerPhone: '08031234567',
    paymentStatus: 'Partial',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 's2',
    orderNumber: 'ORD-202',
    userId: 'u-tobi',
    date: '2026-11-20',
    productId: 'p2',
    productName: 'Kings Oil 25L',
    quantity: 3,
    unitPrice: 60000,
    totalAmount: 180000,
    amountPaid: 180000,
    customerName: 'Oluwaseun Mart',
    customerPhone: '08098765432',
    paymentStatus: 'Paid',
    paymentMethod: 'POS Terminal',
  },
];

const testExpenses: Expense[] = [
  {
    id: 'e1',
    userId: 'u-tobi',
    date: '2026-11-24',
    category: 'Power & Generator Fuel',
    description: 'Diesel refill for shop generator',
    vendor: 'TotalEnergies',
    amount: 45000,
    paymentMethod: 'Cash',
  },
  {
    id: 'e2',
    userId: 'u-tobi',
    date: '2026-11-18',
    category: 'Logistics & Delivery',
    description: 'Delivery van to Lekki',
    vendor: 'GIG Logistics',
    amount: 65000,
    paymentMethod: 'Bank Transfer',
  },
];

const testCustomers: Customer[] = [
  {
    id: 'c1',
    userId: 'u-tobi',
    businessId: 'u-tobi',
    name: 'Mama Nkechi Stores',
    phone: '08031234567',
    email: '',
    totalOrders: 1,
    totalSpent: 410000,
    lastOrderDate: '2026-11-24',
  },
];

test('catalog contains more than 100 distinct pre-built questions and every sample question routes cleanly', () => {
  const totalCount = getPrebuiltQuestionCount();
  assert.ok(totalCount > 100, `Expected >100 pre-built questions, found ${totalCount}`);

  for (const intent of PREBUILT_QA_CATALOG) {
    for (const q of intent.sampleQuestions) {
      const res = answerBusinessQuestion({
        question: q,
        settings: testSettings,
        sales: testSales,
        expenses: testExpenses,
        products: testProducts,
        customers: testCustomers,
        referenceIsoDate: '2026-11-24',
      });
      assert.equal(res.isFallback, false, `Sample question fell back unexpectedly: "${q}"`);
      assert.ok(res.answer.length > 20, `Answer too short for "${q}"`);
      assert.ok(!res.answer.includes('NaN'), `NaN appeared in answer for "${q}"`);
      assert.ok(!res.answer.includes('undefined'), `undefined appeared in answer for "${q}"`);
    }
  }
});

test('answers financial questions using exact Firestore calculations without inventing figures', () => {
  const rev = answerBusinessQuestion({
    question: 'How much revenue did I generate this month?',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(rev.matchedIntentId, 'revenue_this_month');
  assert.ok(rev.answer.includes('₦590,000'));

  const profit = answerBusinessQuestion({
    question: 'What is my estimated net profit?',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(profit.matchedIntentId, 'net_profit_all_time');
  assert.ok(profit.answer.includes('₦480,000'));

  const restock = answerBusinessQuestion({
    question: 'Which products need restocking?',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(restock.matchedIntentId, 'low_stock_restock');
  assert.ok(restock.answer.includes('Mama Gold Rice 50kg'));

  const owing = answerBusinessQuestion({
    question: 'Who owes me money?',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(owing.matchedIntentId, 'outstanding_payments');
  assert.ok(owing.answer.includes('Mama Nkechi Stores'));
  assert.ok(owing.answer.includes('₦110,000'));
});

test('dynamic entity lookup answers questions about specific products and customers in Firestore', () => {
  const prodLookup = answerBusinessQuestion({
    question: 'Tell me about Mama Gold Rice 50kg',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(prodLookup.matchedTopic, 'Dynamic Lookup');
  assert.ok(prodLookup.answer.includes('MG-RICE-50'));
  assert.ok(prodLookup.answer.includes('₦410,000'));

  const custLookup = answerBusinessQuestion({
    question: 'Check account status for Mama Nkechi Stores',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    customers: testCustomers,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(custLookup.matchedTopic, 'Dynamic Lookup');
  assert.ok(custLookup.answer.includes('08031234567'));
  assert.ok(custLookup.answer.includes('₦110,000'));
});

test('handles completely empty Firestore account honestly and returns helpful fallback for off-topic questions', () => {
  const emptyMonthly = answerBusinessQuestion({
    question: 'Generate my monthly business summary',
    reportType: 'monthly_summary',
    settings: testSettings,
    sales: [],
    expenses: [],
    products: [],
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(emptyMonthly.isFallback, false);
  assert.ok(emptyMonthly.answer.includes('Workgo'));
  assert.ok(emptyMonthly.answer.includes('No sales or expenses'));

  const offTopic = answerBusinessQuestion({
    question: 'Who won the UEFA Champions League in 1999?',
    settings: testSettings,
    sales: testSales,
    expenses: testExpenses,
    products: testProducts,
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(offTopic.isFallback, true);
  assert.equal(offTopic.matchedTopic, 'Fallback');
  assert.ok(offTopic.fallbackGuide, 'Expected structured fallbackGuide for unmatched input');
  assert.ok(offTopic.fallbackGuide.heading.includes('Ask Me Anything'));
  assert.equal(offTopic.fallbackGuide.unmatchedQuery, 'Who won the UEFA Champions League in 1999?');
  assert.ok(offTopic.fallbackGuide.scopeNote.includes('Workgo'));
  assert.ok(offTopic.fallbackGuide.scopeNote.includes('Cloud Firestore'));
  assert.ok(offTopic.fallbackGuide.phrasingTip.includes('timeframe'));
  assert.ok(offTopic.fallbackGuide.quickExamples.length >= 3);
  assert.ok(offTopic.answer.includes('Workgo'));
  assert.ok(offTopic.suggestedFollowUps.length >= 3);

  const emptyOffTopic = answerBusinessQuestion({
    question: 'Tell me a joke about space penguins',
    settings: testSettings,
    sales: [],
    expenses: [],
    products: [],
    referenceIsoDate: '2026-11-24',
  });
  assert.equal(emptyOffTopic.isFallback, true);
  assert.ok(emptyOffTopic.fallbackGuide);
  assert.ok(
    emptyOffTopic.fallbackGuide.quickExamples.some((q) => q.includes('record a new sale'))
  );
});
