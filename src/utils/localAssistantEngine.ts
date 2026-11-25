import {
  BusinessSettings,
  Customer,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  Product,
  SaleOrder,
} from '../types/business';
import {
  formatNaira,
  formatShortDate,
  getOutstandingBalance,
  getStockStatus,
} from './analytics';
import {
  buildBusinessAnalyticsReport,
  BusinessAnalyticsReport,
} from './assistantAnalytics';

export type AssistantReportType = 'chat' | 'weekly_summary' | 'monthly_summary';

export type QuestionTopic =
  | 'Sales & Revenue'
  | 'Profit & Cashflow'
  | 'Expenses & Costs'
  | 'Inventory & Stock'
  | 'Customers & Payments'
  | 'Summaries & Advice'
  | 'Website & Account Guide';

export interface LocalAssistantInput {
  question: string;
  reportType?: AssistantReportType;
  settings: Partial<BusinessSettings>;
  sales: SaleOrder[];
  expenses: Expense[];
  products: Product[];
  customers?: Customer[];
  referenceIsoDate?: string;
}

export interface FallbackGuide {
  heading: string;
  unmatchedQuery: string;
  scopeNote: string;
  phrasingTip: string;
  quickExamples: string[];
}

export interface LocalAssistantResponse {
  answer: string;
  matchedIntentId: string;
  matchedTopic: QuestionTopic | 'Dynamic Lookup' | 'Fallback';
  confidence: number;
  isFallback: boolean;
  suggestedFollowUps: string[];
  fallbackGuide?: FallbackGuide;
}

interface AssistantContext {
  businessName: string;
  businessType: string;
  firstName: string;
  ownerName: string;
  currencyCode: string;
  symbol: string;
  todayIso: string;
  yesterdayIso: string;
  settings: Partial<BusinessSettings>;
  sales: SaleOrder[];
  expenses: Expense[];
  products: Product[];
  customers: Customer[];
  report: BusinessAnalyticsReport;
  money: (amount: number) => string;
}

export interface PrebuiltQaIntent {
  id: string;
  topic: QuestionTopic;
  sampleQuestions: string[];
  phrases: string[];
  keywords: string[];
  answer: (ctx: AssistantContext) => string;
  followUps: string[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'i', 'me', 'my', 'mine', 'we', 'our', 'you', 'your', 'it', 'its', 'they', 'their',
  'do', 'does', 'did', 'done', 'can', 'could', 'would', 'should', 'will', 'shall',
  'have', 'has', 'had', 'to', 'of', 'in', 'on', 'at', 'for', 'from', 'by', 'with',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'or', 'but', 'if', 'then', 'so', 'that', 'this', 'these', 'those',
  'please', 'tell', 'show', 'give', 'get', 'know', 'want', 'need', 'just', 'very',
  'really', 'there', 'here', 'much', 'many', 'any', 'some', 'all', 'what', 'which',
  'who', 'when', 'where', 'why', 'how',
]);

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9₦$£₵\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function getYesterdayIso(todayIso: string): string {
  const parts = todayIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return todayIso;
  }
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1));
  return d.toISOString().slice(0, 10);
}

function formatPct(value: number): string {
  return `${Number.isFinite(value) ? Number(value.toFixed(1)) : 0}%`;
}

function buildExpenseCategoryAnswer(ctx: AssistantContext, category: ExpenseCategory): string {
  const matching = ctx.expenses.filter((e) => e.category === category);
  if (matching.length === 0) {
    return [
      `### ${category} Spend`,
      `There are currently **no recorded expenses** under **${category}** in **${ctx.businessName}**'s Cloud Firestore ledger.`,
      `When you log costs in this category under **Expenses → Record Expense**, I will track total spend, share of total operating costs, and vendor breakdowns automatically.`,
    ].join('\n\n');
  }

  const total = matching.reduce((sum, e) => sum + e.amount, 0);
  const share = ctx.report.allTime.totalExpenses > 0
    ? (total / ctx.report.allTime.totalExpenses) * 100
    : 0;
  const monthStart = `${ctx.todayIso.slice(0, 7)}-01`;
  const monthTotal = matching
    .filter((e) => e.date >= monthStart && e.date <= ctx.todayIso)
    .reduce((sum, e) => sum + e.amount, 0);
  const recent = matching.slice(0, 3);

  return [
    `### ${category} Breakdown`,
    `You have spent **${ctx.money(total)}** on **${category}** across **${matching.length}** recorded entr${matching.length === 1 ? 'y' : 'ies'} (**${formatPct(share)}** of total operating expenses).`,
    `- **This month (${ctx.report.monthlySummary.label}):** **${ctx.money(monthTotal)}**`,
    `- **Average entry size:** **${ctx.money(total / matching.length)}**`,
    `### Recent ${category} Entries`,
    ...recent.map(
      (e) =>
        `- **${formatShortDate(e.date)}** — ${e.description}${e.vendor ? ` (${e.vendor})` : ''}: **${ctx.money(e.amount)}**`
    ),
  ].join('\n');
}

function buildPaymentMethodBreakdown(ctx: AssistantContext, focusMethod?: PaymentMethod): string {
  if (ctx.sales.length === 0) {
    return `You have not recorded any sales orders in **${ctx.businessName}**'s Firestore ledger yet, so payment method breakdowns are not available. Record your first transaction under **Sales & Orders** to track Bank Transfer, POS Terminal, Cash, and Mobile Money trends.`;
  }

  const map = new Map<PaymentMethod, { count: number; total: number }>();
  for (const s of ctx.sales) {
    const existing = map.get(s.paymentMethod) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += s.totalAmount;
    map.set(s.paymentMethod, existing);
  }
  const ranked = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);

  if (focusMethod) {
    const entry = map.get(focusMethod);
    if (!entry) {
      return `There are currently **0 sales** recorded via **${focusMethod}** for **${ctx.businessName}**. Your recorded orders currently use ${ranked.map(([m]) => `**${m}**`).join(', ')}.`;
    }
    const share = ctx.report.allTime.totalRevenue > 0
      ? (entry.total / ctx.report.allTime.totalRevenue) * 100
      : 0;
    return [
      `### ${focusMethod} Sales`,
      `**${focusMethod}** accounts for **${ctx.money(entry.total)}** across **${entry.count}** order${entry.count === 1 ? '' : 's'} (**${formatPct(share)}** of total revenue).`,
      `- Your leading payment channel overall is **${ranked[0][0]}** (**${ctx.money(ranked[0][1].total)}**).`,
    ].join('\n\n');
  }

  return [
    `### Payment Method Breakdown`,
    `Across **${ctx.sales.length}** recorded order${ctx.sales.length === 1 ? '' : 's'}, **${ranked[0][0]}** is your top payment channel:`,
    ...ranked.map(([method, stats]) => {
      const share = ctx.report.allTime.totalRevenue > 0
        ? (stats.total / ctx.report.allTime.totalRevenue) * 100
        : 0;
      return `- **${method}:** **${ctx.money(stats.total)}** (${stats.count} order${stats.count === 1 ? '' : 's'} · ${formatPct(share)})`;
    }),
  ].join('\n');
}

function buildWeeklySummaryAnswer(ctx: AssistantContext): string {
  const w = ctx.report.weeklySummary;
  const hasWeekData = w.orderCount > 0 || w.expenseCount > 0;

  if (!hasWeekData) {
    const lowCount = ctx.report.lowStockAlerts.length;
    return [
      `### Weekly Performance (${w.label})`,
      `No sales or expenses have been recorded for **${ctx.businessName}** in the last 7 days (${w.startDate} to ${w.endDate}).`,
      `### All-Time & Stock Context`,
      `- **All-time recorded revenue:** **${ctx.money(ctx.report.allTime.totalRevenue)}** (${ctx.report.allTime.totalOrders} orders)`,
      `- **All-time recorded expenses:** **${ctx.money(ctx.report.allTime.totalExpenses)}**`,
      `- **Outstanding receivables:** **${ctx.money(ctx.report.allTime.outstandingPayments)}**`,
      `- **Low-stock items:** **${lowCount}** SKU${lowCount === 1 ? '' : 's'}`,
      `### Recommended Next Steps`,
      `- Record this week's orders under **Sales & Orders** and operating spend under **Expenses** so your weekly trend updates automatically.`,
      lowCount > 0
        ? `- Review **${ctx.report.lowStockAlerts[0].productName}** in **Inventory** to prevent stockouts.`
        : `- Use the **Dashboard → Weekly** filter and **Download Report** button to export weekly snapshots anytime.`,
    ].join('\n');
  }

  const changeLine =
    w.revenueChangePct !== null
      ? `Revenue is **${w.revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(w.revenueChangePct)}%** compared to the previous 7 days (**${ctx.money(w.previousPeriodRevenue)}**).`
      : `There were no sales in the prior 7-day window to calculate a week-over-week comparison.`;

  const topProdLines =
    w.topProducts.length > 0
      ? w.topProducts
          .slice(0, 3)
          .map(
            (p, idx) =>
              `- **#${idx + 1} ${p.productName}:** **${ctx.money(p.revenue)}** (${p.unitsSold} unit${p.unitsSold === 1 ? '' : 's'} · ${p.sharePct}% share)`
          )
      : ['- No product sales were logged in the last 7 days.'];

  const expLines =
    w.topExpenseCategories.length > 0
      ? w.topExpenseCategories
          .slice(0, 3)
          .map((c) => `- **${c.category}:** **${ctx.money(c.total)}** (${c.sharePct}% of weekly spend)`)
      : ['- No operating expenses were logged in the last 7 days.'];

  const recLines: string[] = [];
  if (w.outstandingBalance > 0) {
    recLines.push(
      `- Follow up on **${ctx.money(w.outstandingBalance)}** in unpaid balances from this week's orders to strengthen cashflow.`
    );
  }
  if (ctx.report.lowStockAlerts.length > 0) {
    const first = ctx.report.lowStockAlerts[0];
    recLines.push(
      `- Restock **${first.productName}** (${first.currentStock} left, threshold ${first.lowStockThreshold}) — suggested replenishment: **${first.suggestedRestockQty} units**.`
    );
  }
  if (w.estimatedNetProfit < 0) {
    recLines.push(
      `- Weekly expenses (**${ctx.money(w.expenses)}**) exceeded revenue (**${ctx.money(w.revenue)}**); review your top spend category before committing new overhead.`
    );
  }
  if (recLines.length === 0) {
    recLines.push(
      `- Maintain your current pricing discipline and export a weekly CSV backup via **Dashboard → Weekly → Download Report**.`
    );
  }

  return [
    `### Weekly Performance (${w.label})`,
    `- **Revenue:** **${ctx.money(w.revenue)}** across **${w.orderCount}** order${w.orderCount === 1 ? '' : 's'} (${w.unitsSold} units sold)`,
    `- **Collected Cash:** **${ctx.money(w.collectedRevenue)}** · **Unpaid Balance:** **${ctx.money(w.outstandingBalance)}**`,
    `- **Expenses:** **${ctx.money(w.expenses)}** (${w.expenseCount} entr${w.expenseCount === 1 ? 'y' : 'ies'})`,
    `- **Estimated Net Profit:** **${ctx.money(w.estimatedNetProfit)}** (**${w.profitMarginPct}%** margin)`,
    changeLine,
    `### Top Products & Sales`,
    ...topProdLines,
    `### Expenses & Cashflow`,
    ...expLines,
    `### Stock & Actionable Recommendations`,
    ...recLines,
  ].join('\n');
}

function buildMonthlySummaryAnswer(ctx: AssistantContext): string {
  const m = ctx.report.monthlySummary;
  const hasMonthData = m.orderCount > 0 || m.expenseCount > 0;

  if (!hasMonthData) {
    return [
      `### Monthly Performance (${m.label})`,
      `No sales or expenses have been logged in **${ctx.businessName}**'s Cloud Firestore ledger for **${m.label}** yet.`,
      `### Current Account Snapshot`,
      `- **All-time revenue:** **${ctx.money(ctx.report.allTime.totalRevenue)}** (${ctx.report.allTime.totalOrders} orders)`,
      `- **All-time expenses:** **${ctx.money(ctx.report.allTime.totalExpenses)}**`,
      `- **Catalogue size:** **${ctx.products.length}** product${ctx.products.length === 1 ? '' : 's'} (**${ctx.report.lowStockAlerts.length}** low-stock alert${ctx.report.lowStockAlerts.length === 1 ? '' : 's'})`,
      `### Next Steps`,
      `- Start recording this month's customer orders in **Sales & Orders** and operational spend in **Expenses**. I will compute your exact month-to-date profit, margins, and product rankings immediately.`,
    ].join('\n');
  }

  const momLine =
    m.revenueChangePct !== null
      ? `Compared to last month (**${ctx.money(m.previousPeriodRevenue)}**), revenue is **${m.revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(m.revenueChangePct)}%**.`
      : `No sales were recorded in the previous calendar month for a month-over-month comparison.`;

  const topProducts =
    m.topProducts.length > 0
      ? m.topProducts
          .slice(0, 4)
          .map(
            (p, idx) =>
              `- **#${idx + 1} ${p.productName}:** **${ctx.money(p.revenue)}** (${p.unitsSold} sold · ${p.sharePct}% share)`
          )
      : ['- No product sales recorded this month yet.'];

  const topExpenses =
    m.topExpenseCategories.length > 0
      ? m.topExpenseCategories
          .slice(0, 4)
          .map((c) => `- **${c.category}:** **${ctx.money(c.total)}** (${c.sharePct}% of monthly expenses)`)
      : ['- No expenses logged this month yet.'];

  const recLines: string[] = [];
  if (ctx.report.allTime.outstandingPayments > 0) {
    recLines.push(
      `- Recover **${ctx.money(ctx.report.allTime.outstandingPayments)}** in total outstanding customer receivables (${ctx.report.allTime.unpaidOrderCount} open order${ctx.report.allTime.unpaidOrderCount === 1 ? '' : 's'}).`
    );
  }
  if (ctx.report.lowStockAlerts.length > 0) {
    recLines.push(
      `- Replenish **${ctx.report.lowStockAlerts.length}** low-stock item${ctx.report.lowStockAlerts.length === 1 ? '' : 's'}, starting with **${ctx.report.lowStockAlerts[0].productName}**.`
    );
  }
  if (m.topExpenseCategories.length > 0) {
    recLines.push(
      `- Keep a close eye on **${m.topExpenseCategories[0].category}**, which represents **${m.topExpenseCategories[0].sharePct}%** of your monthly spend.`
    );
  }
  if (recLines.length === 0) {
    recLines.push(
      `- Export this month's full CSV breakdown from **Dashboard → Monthly → Download Report** for your bookkeeping records.`
    );
  }

  return [
    `### Monthly Performance (${m.label})`,
    `- **Revenue:** **${ctx.money(m.revenue)}** from **${m.orderCount}** order${m.orderCount === 1 ? '' : 's'} (${m.unitsSold} units sold)`,
    `- **Collected Revenue:** **${ctx.money(m.collectedRevenue)}** · **Period Unpaid:** **${ctx.money(m.outstandingBalance)}**`,
    `- **Expenses:** **${ctx.money(m.expenses)}** (${m.expenseCount} entries)`,
    `- **Estimated Net Profit:** **${ctx.money(m.estimatedNetProfit)}** (**${m.profitMarginPct}%** estimated margin)`,
    momLine,
    `### Sales & Top Products`,
    ...topProducts,
    `### Expense Summary`,
    ...topExpenses,
    `### Stock, Receivables & Recommendations`,
    ...recLines,
  ].join('\n');
}

export const PREBUILT_QA_CATALOG: PrebuiltQaIntent[] = [
  // =========================================================================
  // 1. GREETINGS, IDENTITY & ASSISTANT CAPABILITIES
  // =========================================================================
  {
    id: 'greeting',
    topic: 'Summaries & Advice',
    sampleQuestions: [
      'Hello',
      'Hi',
      'Good morning',
      'Good afternoon',
      'Good evening',
      'Hey VendorPilot',
    ],
    phrases: ['good morning', 'good afternoon', 'good evening', 'hello there', 'hey there', 'hi there'],
    keywords: ['hello', 'hi', 'hey', 'greetings', 'morning', 'afternoon', 'evening'],
    answer: (ctx) => {
      const hasData = ctx.sales.length > 0 || ctx.expenses.length > 0 || ctx.products.length > 0;
      if (!hasData) {
        return `Hello **${ctx.firstName}**! Welcome to **${ctx.businessName}**'s AI Business Assistant. I analyse your actual Cloud Firestore sales, expenses, and inventory records and will never invent figures.\n\nYour ledger is currently fresh with **0** sales, **0** expenses, and **0** products. Once you add records in **Sales & Orders**, **Expenses**, or **Inventory**, ask me anything about your revenue, profit, stock alerts, customers, or how to use any feature on the website.`;
      }
      return `Hello **${ctx.firstName}**! Ready to review **${ctx.businessName}**'s numbers.\n\n- **This Month Revenue:** **${ctx.money(ctx.report.monthlySummary.revenue)}** (${ctx.report.monthlySummary.orderCount} orders)\n- **Estimated Net Profit (All Time):** **${ctx.money(ctx.report.allTime.netProfit)}**\n- **Low-Stock Alerts:** **${ctx.report.lowStockAlerts.length}** SKU${ctx.report.lowStockAlerts.length === 1 ? '' : 's'}\n\nWhat would you like to analyse today?`;
    },
    followUps: [
      'How much revenue did I generate this month?',
      'What is my estimated net profit?',
      'Which products need restocking?',
    ],
  },
  {
    id: 'identity_capabilities',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'Who are you?',
      'What can you do?',
      'How do you work?',
      'What questions can I ask you?',
      'Help me understand what this assistant does',
    ],
    phrases: ['who are you', 'what can you do', 'how do you work', 'what questions can i ask', 'what can you help'],
    keywords: ['capabilities', 'features', 'assistant', 'who', 'help'],
    answer: (ctx) =>
      [
        `### About ${ctx.businessName}'s AI Business Assistant`,
        `I am your built-in **VendorPilot AI Business Assistant**, connected directly to **${ctx.businessName}**'s live Cloud Firestore records. Every figure I share is calculated deterministically from your real transactions—I never fabricate or guess numbers.`,
        `### What You Can Ask Me`,
        `- **Sales & Revenue:** Daily, weekly, monthly, all-time revenue, 6-month trends, average order value, and recent orders.`,
        `- **Profit & Cashflow:** Estimated net profit, profit margin, gross profit estimates, and cash collected vs. expenses.`,
        `- **Expenses:** Biggest expenses, spending by category (fuel, logistics, restock, rent, salaries), and cost-saving tips.`,
        `- **Inventory:** Low-stock and out-of-stock alerts, suggested restock quantities, stock valuation, and slow-moving SKUs.`,
        `- **Customers & Receivables:** Who owes you money, partial payments, top customers, and payment method breakdowns.`,
        `- **Website Guide:** Step-by-step help for recording sales, editing records, downloading CSV reports, changing currency, and account security.`,
      ].join('\n'),
    followUps: [
      'Give me an overall business health check',
      'How do I download a CSV report?',
      'Which product sold the most?',
    ],
  },
  {
    id: 'data_accuracy_no_invention',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'Do you invent or make up business figures?',
      'Where do you get my business data from?',
      'Are your financial calculations accurate?',
      'Are you connected to my Cloud Firestore database?',
      'Does this use sample data?',
    ],
    phrases: ['invent figures', 'make up numbers', 'where do you get', 'connected to firestore', 'sample data', 'fake data', 'calculations accurate'],
    keywords: ['invent', 'hallucinate', 'accurate', 'source', 'sample', 'firestore'],
    answer: (ctx) =>
      [
        `### Verified Cloud Firestore Data Integrity`,
        `Every figure I report comes **100% from ${ctx.businessName}'s authenticated Cloud Firestore collections** (\`users\`, \`businesses\`, \`sales\`, \`expenses\`, \`products\`, and \`customers\`).`,
        `- **No sample data:** Zero placeholder or fabricated records are mixed into your ledger.`,
        `- **Deterministic arithmetic:** Totals, margins, outstanding balances, and weekly/monthly comparisons are calculated in verified application logic before I compose your answer.`,
        `- **Live record counts right now:** **${ctx.sales.length}** sales, **${ctx.expenses.length}** expenses, **${ctx.products.length}** products, and **${ctx.customers.length}** customers.`,
      ].join('\n'),
    followUps: [
      'Is my business data safe and private?',
      'How much revenue did I generate this month?',
    ],
  },
  {
    id: 'thanks_closing',
    topic: 'Summaries & Advice',
    sampleQuestions: [
      'Thank you',
      'Thanks for the help',
      'That was helpful',
      'Goodbye',
      'See you later',
    ],
    phrases: ['thank you', 'thanks a lot', 'that was helpful', 'appreciate it', 'see you later'],
    keywords: ['thanks', 'thank', 'goodbye', 'bye', 'awesome', 'great'],
    answer: (ctx) =>
      `You're welcome, **${ctx.firstName}**! I'm always here whenever you want to check **${ctx.businessName}**'s sales, expenses, stock alerts, or weekly and monthly performance. Wishing you strong sales ahead.`,
    followUps: [
      'Generate my weekly business summary',
      'Which products need restocking?',
    ],
  },

  // =========================================================================
  // 2. REVENUE & SALES PERFORMANCE
  // =========================================================================
  {
    id: 'revenue_this_month',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'How much revenue did I generate this month?',
      'What are my monthly sales?',
      'How much money have I made this month?',
      'Show me this month revenue',
      'Sales performance this month',
    ],
    phrases: ['revenue this month', 'generate this month', 'sales this month', 'made this month', 'monthly revenue', 'monthly sales'],
    keywords: ['month', 'monthly', 'revenue', 'sales'],
    answer: (ctx) => {
      const m = ctx.report.monthlySummary;
      if (m.orderCount === 0) {
        return `You have not recorded any sales for **${m.label}** yet (**${ctx.money(0)}** across **0** orders). Your all-time recorded revenue is **${ctx.money(ctx.report.allTime.totalRevenue)}**. Log a sale under **Sales & Orders** to start tracking this month's performance.`;
      }
      const changeNote =
        m.revenueChangePct !== null
          ? `That is **${m.revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(m.revenueChangePct)}%** vs. last month (**${ctx.money(m.previousPeriodRevenue)}**).`
          : `No sales were logged in the previous month for comparison.`;
      return [
        `### Revenue for ${m.label}`,
        `You generated **${ctx.money(m.revenue)}** across **${m.orderCount}** order${m.orderCount === 1 ? '' : 's'} (**${m.unitsSold}** total units sold). ${changeNote}`,
        `- **Collected Cash:** **${ctx.money(m.collectedRevenue)}**`,
        `- **Unpaid Balance (This Month):** **${ctx.money(m.outstandingBalance)}**`,
        `- **Estimated Net Profit (This Month):** **${ctx.money(m.estimatedNetProfit)}** (${m.profitMarginPct}% margin)`,
        m.topProducts[0]
          ? `- **Top Product This Month:** **${m.topProducts[0].productName}** (**${ctx.money(m.topProducts[0].revenue)}**)`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
    followUps: [
      'Which product sold the most this month?',
      'What were my expenses this month?',
      'Generate my monthly business summary',
    ],
  },
  {
    id: 'revenue_this_week',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'How much revenue did I make this week?',
      'What are my weekly sales?',
      'Sales over the last 7 days',
      'How did sales go this week?',
    ],
    phrases: ['revenue this week', 'sales this week', 'last 7 days', 'weekly revenue', 'weekly sales', 'made this week'],
    keywords: ['week', 'weekly', '7days', 'revenue', 'sales'],
    answer: (ctx) => {
      const w = ctx.report.weeklySummary;
      if (w.orderCount === 0) {
        return `You have **0 recorded sales** in the last 7 days (${w.startDate} to ${w.endDate}), for a weekly revenue of **${ctx.money(0)}**. Record new orders in **Sales & Orders** and your 7-day metrics will update instantly.`;
      }
      const diff =
        w.revenueChangePct !== null
          ? `This is **${w.revenueChangePct >= 0 ? 'up' : 'down'} ${Math.abs(w.revenueChangePct)}%** compared to the prior 7 days (**${ctx.money(w.previousPeriodRevenue)}**).`
          : `There were no sales recorded in the prior 7-day window.`;
      return [
        `### Revenue for ${w.label}`,
        `You recorded **${ctx.money(w.revenue)}** across **${w.orderCount}** order${w.orderCount === 1 ? '' : 's'} (${w.unitsSold} units sold). ${diff}`,
        `- **Cash Collected:** **${ctx.money(w.collectedRevenue)}**`,
        `- **Unpaid This Week:** **${ctx.money(w.outstandingBalance)}**`,
        `- **Weekly Net Profit Estimate:** **${ctx.money(w.estimatedNetProfit)}**`,
      ].join('\n');
    },
    followUps: [
      'Generate my weekly business summary',
      'How much did I spend this week?',
    ],
  },
  {
    id: 'revenue_today',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'How much did I sell today?',
      'What is my revenue today?',
      'Show me today sales',
      'Daily sales report',
      'How many orders did I get today?',
    ],
    phrases: ['sell today', 'sold today', 'revenue today', 'sales today', 'orders today', 'daily sales', 'today performance'],
    keywords: ['today', 'daily', 'sales', 'revenue'],
    answer: (ctx) => {
      const todaySales = ctx.sales.filter((s) => s.date === ctx.todayIso);
      const todayExpenses = ctx.expenses.filter((e) => e.date === ctx.todayIso);
      const rev = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const exp = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
      if (todaySales.length === 0 && todayExpenses.length === 0) {
        return `No sales or expenses have been recorded for today (**${formatShortDate(ctx.todayIso)}**) yet. Add today's transactions in **Sales & Orders** or **Expenses**, or switch your Dashboard filter to **Daily** to monitor live activity.`;
      }
      return [
        `### Today's Performance (${formatShortDate(ctx.todayIso)})`,
        `- **Today's Revenue:** **${ctx.money(rev)}** across **${todaySales.length}** order${todaySales.length === 1 ? '' : 's'}`,
        `- **Today's Expenses:** **${ctx.money(exp)}** across **${todayExpenses.length}** entr${todayExpenses.length === 1 ? 'y' : 'ies'}`,
        `- **Today's Net Position:** **${ctx.money(rev - exp)}**`,
      ].join('\n');
    },
    followUps: [
      'How much did I sell yesterday?',
      'What are my weekly sales?',
    ],
  },
  {
    id: 'revenue_yesterday',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'How much did I sell yesterday?',
      'What was yesterday revenue?',
      'Show me yesterday sales',
    ],
    phrases: ['sell yesterday', 'sold yesterday', 'yesterday revenue', 'yesterday sales'],
    keywords: ['yesterday', 'sales', 'revenue'],
    answer: (ctx) => {
      const ySales = ctx.sales.filter((s) => s.date === ctx.yesterdayIso);
      const yExp = ctx.expenses.filter((e) => e.date === ctx.yesterdayIso);
      const rev = ySales.reduce((sum, s) => sum + s.totalAmount, 0);
      const exp = yExp.reduce((sum, e) => sum + e.amount, 0);
      if (ySales.length === 0 && yExp.length === 0) {
        return `There were **no sales or expenses recorded** for yesterday (**${formatShortDate(ctx.yesterdayIso)}**).`;
      }
      return [
        `### Yesterday's Summary (${formatShortDate(ctx.yesterdayIso)})`,
        `- **Revenue:** **${ctx.money(rev)}** (${ySales.length} order${ySales.length === 1 ? '' : 's'})`,
        `- **Expenses:** **${ctx.money(exp)}** (${yExp.length} entr${yExp.length === 1 ? 'y' : 'ies'})`,
        `- **Estimated Net:** **${ctx.money(rev - exp)}**`,
      ].join('\n');
    },
    followUps: ['How much did I sell today?', 'Sales over the last 7 days'],
  },
  {
    id: 'revenue_all_time',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'What is my total revenue?',
      'How much total sales have I made all time?',
      'Total revenue so far',
      'What are my overall sales?',
    ],
    phrases: ['total revenue', 'all time revenue', 'total sales', 'overall sales', 'revenue so far'],
    keywords: ['total', 'revenue', 'sales', 'all-time', 'overall'],
    answer: (ctx) => {
      if (ctx.sales.length === 0) {
        return `**${ctx.businessName}** currently has **${ctx.money(0)}** in recorded revenue (**0** orders). Head to **Sales & Orders → Record Sale** to log your first customer transaction.`;
      }
      const a = ctx.report.allTime;
      return [
        `### All-Time Revenue Overview`,
        `**${ctx.businessName}** has generated **${ctx.money(a.totalRevenue)}** in total recorded sales across **${a.totalOrders}** order${a.totalOrders === 1 ? '' : 's'} (**${a.totalUnitsSold}** units sold).`,
        `- **Cash Collected:** **${ctx.money(a.collectedRevenue)}**`,
        `- **Outstanding Receivables:** **${ctx.money(a.outstandingPayments)}** (${a.unpaidOrderCount} unpaid/partial orders)`,
        `- **Average Order Value:** **${ctx.money(a.averageOrderValue)}**`,
      ].join('\n');
    },
    followUps: [
      'How much revenue did I generate this month?',
      'Show my 6-month sales trend',
      'What is my average order value?',
    ],
  },
  {
    id: 'six_month_trend',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'Show my 6-month sales trend',
      'How have sales changed over the last 6 months?',
      'Which month was my best performing month?',
      'Which month had the lowest sales?',
      'Compare my monthly revenue trend',
    ],
    phrases: ['6 month', '6-month', 'six month', 'best month', 'worst month', 'sales trend', 'revenue trend', 'compare monthly'],
    keywords: ['trend', 'months', 'best', 'worst', 'growth', 'comparison'],
    answer: (ctx) => {
      if (ctx.sales.length === 0 && ctx.expenses.length === 0) {
        return `There are no recorded transactions in the last 6 months yet to build a trend. Once you record sales and expenses, I will compare each month's revenue, spend, and net profit automatically.`;
      }
      const points = ctx.report.monthlyTrendLast6Months;
      const nonZero = points.filter((p) => p.revenue > 0);
      const best = [...nonZero].sort((a, b) => b.revenue - a.revenue)[0];
      return [
        `### 6-Month Financial Trend`,
        ...points.map(
          (p) =>
            `- **${p.monthLabel}:** Revenue **${ctx.money(p.revenue)}** · Expenses **${ctx.money(p.expenses)}** · Est. Net **${ctx.money(p.estimatedNetProfit)}** (${p.orderCount} orders)`
        ),
        best
          ? `\nYour highest-revenue month in this window is **${best.monthLabel}** at **${ctx.money(best.revenue)}**.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
    followUps: [
      'How much revenue did I generate this month?',
      'What is my estimated net profit?',
    ],
  },
  {
    id: 'average_order_value_and_count',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'What is my average order value?',
      'How many orders have I recorded?',
      'How many total units have I sold?',
      'What was my biggest single sale?',
      'Show my recent sales transactions',
    ],
    phrases: ['average order value', 'how many orders', 'total units sold', 'biggest sale', 'largest sale', 'recent sales', 'recent transactions', 'latest orders'],
    keywords: ['average', 'aov', 'orders', 'units', 'largest', 'biggest', 'recent', 'latest'],
    answer: (ctx) => {
      if (ctx.sales.length === 0) {
        return `You have **0 recorded orders** in Cloud Firestore right now. Once you log sales under **Sales & Orders**, I will calculate your average order value, unit volume, and largest transactions automatically.`;
      }
      const largest = [...ctx.sales].sort((a, b) => b.totalAmount - a.totalAmount)[0];
      const recent = ctx.sales.slice(0, 4);
      return [
        `### Order Volume & Ticket Size`,
        `- **Total Orders:** **${ctx.report.allTime.totalOrders}** (${ctx.report.allTime.totalUnitsSold} total units sold)`,
        `- **Average Order Value (AOV):** **${ctx.money(ctx.report.allTime.averageOrderValue)}**`,
        `- **Largest Single Order:** **${largest.orderNumber}** — **${largest.productName}** (Qty ${largest.quantity}) for **${largest.customerName}**: **${ctx.money(largest.totalAmount)}**`,
        `### Most Recent Sales`,
        ...recent.map(
          (s) =>
            `- **${s.orderNumber}** (${formatShortDate(s.date)}) — ${s.customerName} · ${s.productName} × ${s.quantity}: **${ctx.money(s.totalAmount)}** (${s.paymentStatus})`
        ),
      ].join('\n');
    },
    followUps: [
      'Which product sold the most?',
      'Who is my best customer?',
    ],
  },

  // =========================================================================
  // 3. EXPENSES & COST CONTROL
  // =========================================================================
  {
    id: 'biggest_expenses',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'What were my biggest expenses?',
      'What is my largest expense category?',
      'Where is most of my money going?',
      'Break down my expenses by category',
      'Show my top expenses',
    ],
    phrases: ['biggest expense', 'largest expense', 'top expense', 'expense category', 'expense breakdown', 'money going', 'spending most'],
    keywords: ['biggest', 'largest', 'expenses', 'category', 'breakdown', 'spending', 'costs'],
    answer: (ctx) => {
      if (ctx.expenses.length === 0) {
        return `You have not logged any operating expenses for **${ctx.businessName}** yet. Record your costs (such as Inventory Restock, Logistics, or Generator Fuel) under **Expenses → Record Expense** so I can pinpoint your biggest cost drivers.`;
      }
      const cats = ctx.report.expenseByCategoryAllTime;
      const topItems = ctx.report.biggestExpensesAllTime.slice(0, 3);
      return [
        `### Biggest Expense Categories`,
        `Your top spending category is **${cats[0].category}** at **${ctx.money(cats[0].total)}** (**${cats[0].sharePct}%** of total operating expenses of **${ctx.money(ctx.report.allTime.totalExpenses)}**):`,
        ...cats
          .slice(0, 5)
          .map(
            (c) =>
              `- **${c.category}:** **${ctx.money(c.total)}** (${c.count} entr${c.count === 1 ? 'y' : 'ies'} · ${c.sharePct}%)`
          ),
        `### Largest Individual Expense Entries`,
        ...topItems.map(
          (e) =>
            `- **${formatShortDate(e.date)}** — ${e.description} (${e.category}): **${ctx.money(e.amount)}**`
        ),
      ].join('\n');
    },
    followUps: [
      'How can I reduce my operating expenses?',
      'What were my expenses this month?',
      'What is my estimated net profit?',
    ],
  },
  {
    id: 'expenses_this_month',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'What were my expenses this month?',
      'How much have I spent this month?',
      'Monthly operating expenses',
      'Show this month spending',
    ],
    phrases: ['expenses this month', 'spent this month', 'spending this month', 'monthly expenses', 'monthly spend'],
    keywords: ['month', 'monthly', 'expenses', 'spent', 'spend'],
    answer: (ctx) => {
      const m = ctx.report.monthlySummary;
      if (m.expenseCount === 0) {
        return `You have **0 recorded expenses** for **${m.label}** (**${ctx.money(0)}**). All-time recorded expenses stand at **${ctx.money(ctx.report.allTime.totalExpenses)}**.`;
      }
      return [
        `### Expenses for ${m.label}`,
        `You spent **${ctx.money(m.expenses)}** across **${m.expenseCount}** entr${m.expenseCount === 1 ? 'y' : 'ies'} (previous month: **${ctx.money(m.previousPeriodExpenses)}**).`,
        ...m.topExpenseCategories
          .slice(0, 4)
          .map((c) => `- **${c.category}:** **${ctx.money(c.total)}** (${c.sharePct}% share)`),
      ].join('\n');
    },
    followUps: ['What were my biggest expenses?', 'How much revenue did I generate this month?'],
  },
  {
    id: 'expenses_this_week',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend this week?',
      'What are my weekly expenses?',
      'Expenses over the last 7 days',
    ],
    phrases: ['spend this week', 'spent this week', 'weekly expenses', 'expenses this week', 'expenses last 7 days'],
    keywords: ['week', 'weekly', 'expenses', 'spent', 'spend'],
    answer: (ctx) => {
      const w = ctx.report.weeklySummary;
      if (w.expenseCount === 0) {
        return `You have **0 recorded expenses** in the last 7 days (${w.startDate} to ${w.endDate}).`;
      }
      return [
        `### Expenses for ${w.label}`,
        `Weekly spending totals **${ctx.money(w.expenses)}** across **${w.expenseCount}** entr${w.expenseCount === 1 ? 'y' : 'ies'} (prior 7 days: **${ctx.money(w.previousPeriodExpenses)}**).`,
        ...w.topExpenseCategories
          .slice(0, 3)
          .map((c) => `- **${c.category}:** **${ctx.money(c.total)}** (${c.sharePct}%)`),
      ].join('\n');
    },
    followUps: ['Generate my weekly business summary', 'What were my biggest expenses?'],
  },
  {
    id: 'expenses_all_time',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'What are my total expenses?',
      'How much have I spent in total?',
      'Summarize all my expenses',
      'Which vendors do I pay the most?',
    ],
    phrases: ['total expenses', 'spent in total', 'all expenses', 'summarize expenses', 'top vendors', 'which vendors'],
    keywords: ['total', 'expenses', 'vendors', 'summary'],
    answer: (ctx) => {
      if (ctx.expenses.length === 0) {
        return `**${ctx.businessName}** has **${ctx.money(0)}** in recorded expenses (**0** entries). Go to **Expenses → Record Expense** to start logging operational costs.`;
      }
      const vendorMap = new Map<string, number>();
      for (const e of ctx.expenses) {
        const key = e.vendor.trim() || 'Unspecified Vendor';
        vendorMap.set(key, (vendorMap.get(key) ?? 0) + e.amount);
      }
      const topVendors = Array.from(vendorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      return [
        `### All-Time Expense Summary`,
        `Total recorded expenses are **${ctx.money(ctx.report.allTime.totalExpenses)}** across **${ctx.expenses.length}** entr${ctx.expenses.length === 1 ? 'y' : 'ies'}.`,
        `- **Largest Category:** **${ctx.report.expenseByCategoryAllTime[0].category}** (**${ctx.money(ctx.report.expenseByCategoryAllTime[0].total)}**)`,
        `### Top Expense Vendors`,
        ...topVendors.map(([vendor, amt]) => `- **${vendor}:** **${ctx.money(amt)}**`),
      ].join('\n');
    },
    followUps: ['What were my biggest expenses?', 'How can I reduce my operating expenses?'],
  },
  {
    id: 'expense_cat_fuel',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on diesel and generator fuel?',
      'Show my power and fuel expenses',
      'Generator fuel cost',
    ],
    phrases: ['generator fuel', 'power and fuel', 'diesel cost', 'fuel expenses', 'spend on diesel', 'spend on fuel'],
    keywords: ['diesel', 'fuel', 'generator', 'power', 'petrol'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Power & Generator Fuel'),
    followUps: ['What were my biggest expenses?', 'How can I reduce my operating expenses?'],
  },
  {
    id: 'expense_cat_logistics',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on logistics and delivery?',
      'Show my transport and delivery expenses',
      'Dispatch cost breakdown',
    ],
    phrases: ['logistics and delivery', 'delivery expenses', 'transport cost', 'spend on delivery', 'spend on logistics'],
    keywords: ['logistics', 'delivery', 'dispatch', 'transport', 'shipping'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Logistics & Delivery'),
    followUps: ['What were my biggest expenses?', 'How can I reduce my operating expenses?'],
  },
  {
    id: 'expense_cat_restock',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on inventory restock?',
      'Show my restocking expenses',
      'Supplier restock spend',
    ],
    phrases: ['inventory restock', 'restock expenses', 'restocking cost', 'spend on restock'],
    keywords: ['restock', 'restocking', 'supplier', 'wholesale', 'expenses'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Inventory Restock'),
    followUps: ['Which products need restocking?', 'What is my retail stock value?'],
  },
  {
    id: 'expense_cat_rent',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on rent and utilities?',
      'Show my shop rent expenses',
    ],
    phrases: ['rent and utilities', 'shop rent', 'utility bills', 'spend on rent'],
    keywords: ['rent', 'utilities', 'electricity', 'nepa', 'shop'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Rent & Utilities'),
    followUps: ['What were my biggest expenses?'],
  },
  {
    id: 'expense_cat_salaries',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on staff salaries?',
      'Show my payroll and wages expenses',
    ],
    phrases: ['staff salaries', 'payroll cost', 'spend on salaries', 'salary expenses'],
    keywords: ['salaries', 'salary', 'staff', 'payroll', 'wages'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Staff Salaries'),
    followUps: ['What were my biggest expenses?'],
  },
  {
    id: 'expense_cat_marketing',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on marketing and ads?',
      'Show my advertising expenses',
    ],
    phrases: ['marketing and ads', 'advertising cost', 'ad spend', 'spend on marketing'],
    keywords: ['marketing', 'ads', 'advertising', 'promotion'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Marketing & Ads'),
    followUps: ['What were my biggest expenses?'],
  },
  {
    id: 'expense_cat_packaging',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How much did I spend on packaging and supplies?',
      'Show my packaging costs',
    ],
    phrases: ['packaging and supplies', 'packaging cost', 'spend on packaging'],
    keywords: ['packaging', 'supplies', 'cartons', 'nylon', 'bags'],
    answer: (ctx) => buildExpenseCategoryAnswer(ctx, 'Packaging & Supplies'),
    followUps: ['What were my biggest expenses?'],
  },
  {
    id: 'reduce_expenses_advice',
    topic: 'Expenses & Costs',
    sampleQuestions: [
      'How can I reduce my operating expenses?',
      'Give me cost-cutting recommendations',
      'How do I control business spending?',
    ],
    phrases: ['reduce expenses', 'cut costs', 'lower expenses', 'control spending', 'save money on expenses'],
    keywords: ['reduce', 'cut', 'save', 'control', 'costs', 'expenses'],
    answer: (ctx) => {
      const topCat = ctx.report.expenseByCategoryAllTime[0];
      const tips = [
        topCat
          ? `- **Audit your #1 cost driver (${topCat.category}):** It currently absorbs **${topCat.sharePct}%** (**${ctx.money(topCat.total)}**) of your operating spend. Negotiate bulk rates or lock in supplier pricing where possible.`
          : `- **Log every recurring cost:** Start recording fuel, logistics, rent, and restock entries under **Expenses** so hidden cost leaks stand out immediately.`,
        `- **Batch logistics & restocking:** Combine deliveries by zone and bundle supplier pickups to reduce repeated transport fees.`,
        `- **Track expense-to-revenue ratio weekly:** Use **Dashboard → Weekly** to keep overhead proportionate when sales dip.`,
      ];
      return [`### Practical Cost-Control Recommendations for ${ctx.businessName}`, ...tips].join('\n');
    },
    followUps: ['What were my biggest expenses?', 'How can I increase my profit margin?'],
  },

  // =========================================================================
  // 4. PROFITABILITY & CASHFLOW
  // =========================================================================
  {
    id: 'net_profit_all_time',
    topic: 'Profit & Cashflow',
    sampleQuestions: [
      'What is my estimated net profit?',
      'How much profit have I made?',
      'Am I making a profit or a loss?',
      'What is my profit margin?',
      'Show my profitability summary',
    ],
    phrases: ['estimated net profit', 'net profit', 'profit margin', 'making a profit', 'profit or loss', 'how much profit'],
    keywords: ['profit', 'margin', 'profitable', 'loss', 'earnings', 'gain'],
    answer: (ctx) => {
      if (ctx.sales.length === 0 && ctx.expenses.length === 0) {
        return `There are no recorded sales or expenses in **${ctx.businessName}**'s ledger yet, so estimated net profit is **${ctx.money(0)}**. Once you record orders and operating costs, I calculate exact estimated net profit (recorded revenue minus recorded expenses) automatically.`;
      }
      const a = ctx.report.allTime;
      const status = a.netProfit > 0 ? 'profitable' : a.netProfit < 0 ? 'currently operating at a net loss' : 'breaking even';
      const grossLine =
        a.estimatedGrossProfit !== null
          ? `- **Estimated Product Gross Profit:** **${ctx.money(a.estimatedGrossProfit)}** (based on **${a.grossProfitCoveragePct}%** of sales matched to inventory cost prices)`
          : `- **Product Gross Profit:** Add **Cost Prices** to your products in **Inventory** to unlock item-level gross profit tracking.`;
      return [
        `### Estimated Profitability (${ctx.businessName})`,
        `Based on your recorded Firestore ledger, **${ctx.businessName}** is **${status}**:`,
        `- **Total Recorded Revenue:** **${ctx.money(a.totalRevenue)}**`,
        `- **Total Recorded Expenses:** **${ctx.money(a.totalExpenses)}**`,
        `- **Estimated Net Profit:** **${ctx.money(a.netProfit)}** (**${a.profitMarginPct}%** estimated net margin)`,
        grossLine,
        `- **Cashflow Net (Collected Cash − Expenses):** **${ctx.money(a.cashflowNet)}**`,
      ].join('\n');
    },
    followUps: [
      'What is my net profit this month?',
      'How can I increase my profit margin?',
      'How much cash have I actually collected?',
    ],
  },
  {
    id: 'net_profit_this_month',
    topic: 'Profit & Cashflow',
    sampleQuestions: [
      'What is my net profit this month?',
      'How much profit did I make this month?',
      'Monthly profit margin',
    ],
    phrases: ['profit this month', 'monthly profit', 'net profit this month', 'margin this month'],
    keywords: ['month', 'monthly', 'profit', 'margin'],
    answer: (ctx) => {
      const m = ctx.report.monthlySummary;
      if (m.orderCount === 0 && m.expenseCount === 0) {
        return `No sales or expenses have been logged for **${m.label}** yet, so estimated monthly net profit is **${ctx.money(0)}**.`;
      }
      return [
        `### Estimated Net Profit for ${m.label}`,
        `- **Monthly Revenue:** **${ctx.money(m.revenue)}**`,
        `- **Monthly Expenses:** **${ctx.money(m.expenses)}**`,
        `- **Estimated Net Profit:** **${ctx.money(m.estimatedNetProfit)}** (**${m.profitMarginPct}%** margin)`,
      ].join('\n');
    },
    followUps: ['Generate my monthly business summary', 'What were my expenses this month?'],
  },
  {
    id: 'gross_profit_estimate',
    topic: 'Profit & Cashflow',
    sampleQuestions: [
      'What is my estimated gross profit?',
      'How much markup am I making on products?',
      'Which product has the highest profit margin?',
    ],
    phrases: ['gross profit', 'product margin', 'highest margin', 'best margin', 'markup'],
    keywords: ['gross', 'markup', 'margin', 'cost'],
    answer: (ctx) => {
      const withCost = ctx.products.filter((p) => p.unitPrice > 0 && p.costPrice > 0);
      const bestMargin = [...withCost].sort(
        (a, b) =>
          (b.unitPrice - b.costPrice) / b.unitPrice - (a.unitPrice - a.costPrice) / a.unitPrice
      );
      const a = ctx.report.allTime;
      if (withCost.length === 0) {
        return `None of your products currently have a **Cost Price** recorded. Edit your items in **Inventory** to add cost prices, and I will calculate exact unit margins and estimated gross profit across your sales.`;
      }
      return [
        `### Gross Profit & Product Margins`,
        a.estimatedGrossProfit !== null
          ? `- **Estimated Gross Profit (Matched Sales):** **${ctx.money(a.estimatedGrossProfit)}** (covering **${a.grossProfitCoveragePct}%** of total revenue)`
          : `- Record product-linked sales in **Sales & Orders** to compute realized gross profit.`,
        `### Highest-Margin Products in Inventory`,
        ...bestMargin.slice(0, 4).map((p) => {
          const marginPct = (((p.unitPrice - p.costPrice) / p.unitPrice) * 100).toFixed(1);
          return `- **${p.name}:** Cost **${ctx.money(p.costPrice)}** → Selling **${ctx.money(p.unitPrice)}** (**${marginPct}%** margin · ${ctx.money(p.unitPrice - p.costPrice)}/unit)`;
        }),
      ].join('\n');
    },
    followUps: ['What is my estimated net profit?', 'How can I increase my profit margin?'],
  },
  {
    id: 'cashflow_collected',
    topic: 'Profit & Cashflow',
    sampleQuestions: [
      'How much cash have I actually collected?',
      'What is my real cashflow?',
      'Collected revenue vs expenses',
      'What is my collection rate?',
    ],
    phrases: ['cash collected', 'actually collected', 'real cashflow', 'cashflow', 'cash flow', 'collection rate'],
    keywords: ['cashflow', 'collected', 'collection', 'liquidity', 'cash'],
    answer: (ctx) => {
      const a = ctx.report.allTime;
      if (ctx.sales.length === 0 && ctx.expenses.length === 0) {
        return `No cash inflows or outflows have been recorded yet. Start logging paid, partial, and credit sales under **Sales & Orders** and expenses under **Expenses** to monitor live cashflow.`;
      }
      const collectionRate = a.totalRevenue > 0 ? (a.collectedRevenue / a.totalRevenue) * 100 : 0;
      return [
        `### Real Cashflow Position`,
        `- **Total Billed Revenue:** **${ctx.money(a.totalRevenue)}**`,
        `- **Actual Cash Collected:** **${ctx.money(a.collectedRevenue)}** (**${formatPct(collectionRate)}** collection rate)`,
        `- **Uncollected Receivables:** **${ctx.money(a.outstandingPayments)}**`,
        `- **Total Recorded Expenses:** **${ctx.money(a.totalExpenses)}**`,
        `- **Net Cash Position (Collected − Expenses):** **${ctx.money(a.cashflowNet)}**`,
      ].join('\n');
    },
    followUps: ['Who owes me money?', 'What is my estimated net profit?'],
  },
  {
    id: 'increase_profit_advice',
    topic: 'Profit & Cashflow',
    sampleQuestions: [
      'How can I increase my profit margin?',
      'Why is my profit low?',
      'How can I make more profit?',
    ],
    phrases: ['increase profit', 'improve margin', 'profit low', 'make more profit', 'boost profit'],
    keywords: ['increase', 'improve', 'boost', 'profit', 'margin'],
    answer: (ctx) => {
      const a = ctx.report.allTime;
      const tips: string[] = [];
      if (a.outstandingPayments > 0) {
        tips.push(
          `- **Collect unpaid balances first:** Recovering **${ctx.money(a.outstandingPayments)}** in receivables immediately boosts working capital without adding extra sales cost.`
        );
      }
      if (ctx.report.expenseByCategoryAllTime[0]) {
        const c = ctx.report.expenseByCategoryAllTime[0];
        tips.push(
          `- **Trim ${c.category}:** Your largest expense category is **${c.sharePct}%** of total spend (**${ctx.money(c.total)}**). Even a 10% reduction adds **${ctx.money(c.total * 0.1)}** straight to net profit.`
        );
      }
      if (ctx.report.topSellingByRevenue[0]) {
        tips.push(
          `- **Keep ${ctx.report.topSellingByRevenue[0].productName} in stock:** Protect your #1 revenue driver from stockouts and consider modest wholesale volume tiers.`
        );
      }
      tips.push(
        `- **Review item-level margins in Inventory:** Ensure selling prices keep pace with supplier restock increases.`
      );
      return [
        `### Profit Growth Playbook for ${ctx.businessName}`,
        `Current estimated net margin is **${a.profitMarginPct}%** (**${ctx.money(a.netProfit)}** net profit on **${ctx.money(a.totalRevenue)}** revenue).`,
        ...tips,
      ].join('\n');
    },
    followUps: ['Which product has the highest profit margin?', 'What were my biggest expenses?'],
  },

  // =========================================================================
  // 5. OUTSTANDING PAYMENTS, CREDIT & RECEIVABLES
  // =========================================================================
  {
    id: 'outstanding_payments',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'How much are my outstanding payments?',
      'Who owes me money?',
      'Show all unpaid and partial orders',
      'Who is my biggest debtor?',
      'Which customers have pending balances?',
    ],
    phrases: ['outstanding payment', 'who owes me', 'owes me money', 'unpaid orders', 'partial payments', 'pending balances', 'biggest debtor', 'customers owing'],
    keywords: ['outstanding', 'owes', 'owe', 'debtors', 'unpaid', 'pending', 'partial', 'receivables', 'credit'],
    answer: (ctx) => {
      const a = ctx.report.allTime;
      if (a.outstandingPayments <= 0) {
        return `Great news! **${ctx.businessName}** currently has **${ctx.money(0)}** in outstanding payments—all recorded orders are fully settled.`;
      }
      const debtors = ctx.report.outstandingCustomers;
      return [
        `### Outstanding Receivables (${ctx.money(a.outstandingPayments)})`,
        `You have **${a.unpaidOrderCount}** unpaid or partially paid order${a.unpaidOrderCount === 1 ? '' : 's'} totaling **${ctx.money(a.outstandingPayments)}**.`,
        `### Customers With Open Balances`,
        ...debtors.slice(0, 6).map(
          (c) =>
            `- **${c.customerName}**${c.customerPhone ? ` (${c.customerPhone})` : ''}: **${ctx.money(c.totalOwed)}** across **${c.unpaidOrderCount}** order${c.unpaidOrderCount === 1 ? '' : 's'}`
        ),
        `\nTip: Once a customer settles their balance, open **Sales & Orders** and click **Mark Paid** on that order to update your receivables immediately.`,
      ].join('\n');
    },
    followUps: [
      'How do I mark an order as paid?',
      'How should I follow up with customers who owe me?',
      'How much cash have I actually collected?',
    ],
  },
  {
    id: 'followup_credit_tips',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'How should I follow up with customers who owe me?',
      'How do I manage credit sales safely?',
      'Tips for collecting unpaid invoices',
    ],
    phrases: ['follow up', 'credit sales', 'collect unpaid', 'manage credit', 'recover debt'],
    keywords: ['follow', 'credit', 'recover', 'invoices', 'debt'],
    answer: (ctx) => {
      const topDebtor = ctx.report.outstandingCustomers[0];
      return [
        `### Receivables Follow-Up Playbook`,
        topDebtor
          ? `Start with your largest open balance: **${topDebtor.customerName}** (**${ctx.money(topDebtor.totalOwed)}** across ${topDebtor.unpaidOrderCount} order${topDebtor.unpaidOrderCount === 1 ? '' : 's'}).`
          : `All your orders are currently settled—great credit discipline!`,
        `- **Send polite same-week reminders:** Reference the exact Order Number (e.g., from **Sales & Orders**) and remaining balance via WhatsApp or phone.`,
        `- **Require partial deposits on credit orders:** Log the deposit under **Partial** payment status so your exact balance due stays visible.`,
        `- **Cap credit per customer:** Pause new credit orders for accounts with overdue balances until prior invoices clear.`,
      ].join('\n');
    },
    followUps: ['Who owes me money?', 'How do I mark an order as paid?'],
  },

  // =========================================================================
  // 6. INVENTORY, STOCK LEVELS & RESTOCKING
  // =========================================================================
  {
    id: 'low_stock_restock',
    topic: 'Inventory & Stock',
    sampleQuestions: [
      'Which products need restocking?',
      'Show my low-stock products',
      'What items are running out of stock?',
      'Which items are out of stock?',
      'Give me a restock list',
    ],
    phrases: ['need restocking', 'needs restocking', 'low stock', 'low-stock', 'out of stock', 'running low', 'restock list', 'finish soon'],
    keywords: ['restock', 'restocking', 'low', 'out', 'alerts', 'reorder', 'shortage'],
    answer: (ctx) => {
      if (ctx.products.length === 0) {
        return `Your inventory catalogue is currently empty (**0** products). Add your products in **Inventory → Add Product** with stock quantities and low-stock thresholds, and I will flag items automatically whenever stock runs low.`;
      }
      const alerts = ctx.report.lowStockAlerts;
      if (alerts.length === 0) {
        return `All **${ctx.products.length}** product${ctx.products.length === 1 ? '' : 's'} in **${ctx.businessName}**'s inventory are currently **above their low-stock alert threshold**. No immediate restocking is required.`;
      }
      return [
        `### Restock Alert List (${alerts.length} SKU${alerts.length === 1 ? '' : 's'})`,
        `The following items are at or below their reorder threshold (out-of-stock items listed first):`,
        ...alerts.slice(0, 8).map(
          (item) =>
            `- **${item.productName}** (\`${item.sku}\`) — **${item.status}** (**${item.currentStock}** left, threshold **${item.lowStockThreshold}**) · Suggested restock: **+${item.suggestedRestockQty}**`
        ),
        `\nTip: Click **Restock** on any item in **Dashboard** or **Inventory** to add new stock safely in Cloud Firestore.`,
      ].join('\n');
    },
    followUps: [
      'What is my total inventory value?',
      'Which product sold the most?',
      'How do I restock a product?',
    ],
  },
  {
    id: 'inventory_overview_valuation',
    topic: 'Inventory & Stock',
    sampleQuestions: [
      'What is my total inventory value?',
      'How many products do I have in inventory?',
      'What is my retail stock value vs cost value?',
      'How many total units do I have in stock?',
      'Summarize my inventory catalogue',
    ],
    phrases: ['inventory value', 'stock value', 'how many products', 'total products', 'retail stock value', 'units in stock', 'summarize inventory'],
    keywords: ['inventory', 'valuation', 'catalogue', 'catalog', 'skus', 'stock', 'worth'],
    answer: (ctx) => {
      if (ctx.products.length === 0) {
        return `You currently have **0 products** in **${ctx.businessName}**'s inventory. Go to **Inventory → Add Product** to create your product catalogue.`;
      }
      const totalUnits = ctx.products.reduce((sum, p) => sum + p.stock, 0);
      const a = ctx.report.allTime;
      const potentialProfit = Math.max(0, a.inventoryValuation - a.inventoryCostValuation);
      return [
        `### Inventory Valuation & Overview`,
        `- **Total Products (SKUs):** **${ctx.products.length}**`,
        `- **Total Units On Hand:** **${totalUnits.toLocaleString('en-NG')}**`,
        `- **Retail Stock Value (at Selling Price):** **${ctx.money(a.inventoryValuation)}**`,
        `- **Cost Stock Value (at Cost Price):** **${ctx.money(a.inventoryCostValuation)}**`,
        a.inventoryCostValuation > 0
          ? `- **Embedded Gross Margin in Current Stock:** **${ctx.money(potentialProfit)}**`
          : `- Add Cost Prices to products in **Inventory** to see cost valuation and embedded stock profit.`,
        `- **Stock Health:** **${a.lowStockCount}** low-stock alert${a.lowStockCount === 1 ? '' : 's'} (**${a.outOfStockCount}** out of stock)`,
      ].join('\n');
    },
    followUps: [
      'Which products need restocking?',
      'Which products have zero sales?',
      'What is my highest-priced product?',
    ],
  },
  {
    id: 'price_extremes_products',
    topic: 'Inventory & Stock',
    sampleQuestions: [
      'What is my highest-priced product?',
      'What is my cheapest or lowest-priced product?',
      'List my most expensive items',
    ],
    phrases: ['highest priced', 'most expensive', 'cheapest product', 'lowest priced', 'highest price', 'lowest price'],
    keywords: ['expensive', 'cheapest', 'highest', 'lowest', 'priced', 'price'],
    answer: (ctx) => {
      if (ctx.products.length === 0) {
        return `You have not added any products to **Inventory** yet.`;
      }
      const sorted = [...ctx.products].sort((a, b) => b.unitPrice - a.unitPrice);
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];
      return [
        `### Product Price Range`,
        `- **Highest-Priced Product:** **${highest.name}** (\`${highest.sku}\`) — **${ctx.money(highest.unitPrice)}** per ${highest.unit} (${highest.stock} in stock)`,
        `- **Lowest-Priced Product:** **${lowest.name}** (\`${lowest.sku}\`) — **${ctx.money(lowest.unitPrice)}** per ${lowest.unit} (${lowest.stock} in stock)`,
      ].join('\n');
    },
    followUps: ['Which product has the highest profit margin?', 'What is my total inventory value?'],
  },
  {
    id: 'slow_moving_products',
    topic: 'Inventory & Stock',
    sampleQuestions: [
      'Which products have zero sales?',
      'What are my slow-moving products?',
      'Which inventory items are not selling?',
      'Dead stock analysis',
    ],
    phrases: ['zero sales', 'slow moving', 'slow-moving', 'not selling', 'dead stock', 'unsold products'],
    keywords: ['slow', 'unsold', 'dead', 'stagnant', 'zero'],
    answer: (ctx) => {
      if (ctx.products.length === 0) {
        return `You have no products in **Inventory** yet to evaluate slow-moving stock.`;
      }
      const soldIds = new Set(ctx.sales.map((s) => s.productId).filter(Boolean));
      const soldNames = new Set(ctx.sales.map((s) => s.productName.trim().toLowerCase()));
      const unsold = ctx.products.filter(
        (p) => !soldIds.has(p.id) && !soldNames.has(p.name.trim().toLowerCase())
      );
      if (unsold.length === 0) {
        return `Every product in your **${ctx.products.length}**-SKU catalogue has recorded at least one sale—no dead stock detected!`;
      }
      const tiedUpCapital = unsold.reduce((sum, p) => sum + p.stock * (p.costPrice || p.unitPrice), 0);
      return [
        `### Slow-Moving / Unsold Inventory (${unsold.length} SKU${unsold.length === 1 ? '' : 's'})`,
        `These catalogue items currently have **0 recorded sales** (estimated stock tied up: **${ctx.money(tiedUpCapital)}**):`,
        ...unsold
          .slice(0, 6)
          .map(
            (p) =>
              `- **${p.name}** (\`${p.sku}\`) — **${p.stock}** ${p.unit}(s) in stock at **${ctx.money(p.unitPrice)}**`
          ),
        `\nRecommendation: Consider bundling slow-moving items with your top seller or offering a limited clearance discount to free up cash.`,
      ].join('\n');
    },
    followUps: ['Which product sold the most?', 'What is my total inventory value?'],
  },

  // =========================================================================
  // 7. TOP-SELLING & PRODUCT INSIGHTS
  // =========================================================================
  {
    id: 'top_selling_revenue',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'Which product sold the most?',
      'What are my top-selling products?',
      'Best selling item by revenue',
      'Which product brings in the most money?',
      'Rank my products by revenue',
    ],
    phrases: ['sold the most', 'top selling', 'top-selling', 'best selling', 'best seller', 'most money', 'highest revenue product'],
    keywords: ['top', 'best', 'selling', 'seller', 'most', 'popular', 'product'],
    answer: (ctx) => {
      const top = ctx.report.topSellingByRevenue;
      if (top.length === 0) {
        return `No product sales have been recorded in **${ctx.businessName}**'s ledger yet. Log orders under **Sales & Orders** to see your top-selling products ranked by revenue and units.`;
      }
      const winner = top[0];
      return [
        `### Top-Selling Products (By Revenue)`,
        `**${winner.productName}** is your #1 revenue generator at **${ctx.money(winner.revenue)}** (**${winner.sharePct}%** of total revenue across **${winner.unitsSold}** units sold).`,
        ...top.map(
          (p, i) =>
            `- **#${i + 1} ${p.productName}:** **${ctx.money(p.revenue)}** (${p.unitsSold} unit${p.unitsSold === 1 ? '' : 's'} · ${p.sharePct}% share)`
        ),
      ].join('\n');
    },
    followUps: [
      'Which product sold the most units?',
      'Which product sold the most this month?',
      'Which products need restocking?',
    ],
  },
  {
    id: 'top_selling_units',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'Which product sold the most units?',
      'Highest quantity sold product',
      'Fastest-moving product by volume',
    ],
    phrases: ['most units', 'highest quantity', 'by volume', 'fastest moving', 'most quantity'],
    keywords: ['units', 'volume', 'quantity', 'fastest'],
    answer: (ctx) => {
      const top = ctx.report.topSellingByUnits;
      if (top.length === 0) {
        return `No sales have been recorded yet to rank products by units sold.`;
      }
      return [
        `### Top-Selling Products (By Units Sold)`,
        `**${top[0].productName}** leads by volume with **${top[0].unitsSold}** unit${top[0].unitsSold === 1 ? '' : 's'} sold (**${ctx.money(top[0].revenue)}**):`,
        ...top.map(
          (p, i) =>
            `- **#${i + 1} ${p.productName}:** **${p.unitsSold}** units sold (**${ctx.money(p.revenue)}**) `
        ),
      ].join('\n');
    },
    followUps: ['Which product sold the most?', 'Which products need restocking?'],
  },
  {
    id: 'top_selling_this_month',
    topic: 'Sales & Revenue',
    sampleQuestions: [
      'Which product sold the most this month?',
      'Top products this month',
      'Best seller this month',
    ],
    phrases: ['sold the most this month', 'top products this month', 'best seller this month', 'top selling this month'],
    keywords: ['month', 'top', 'best', 'product'],
    answer: (ctx) => {
      const top = ctx.report.monthlySummary.topProducts;
      if (top.length === 0) {
        return `No product sales have been recorded for **${ctx.report.monthlySummary.label}** yet.`;
      }
      return [
        `### Top Products for ${ctx.report.monthlySummary.label}`,
        ...top.map(
          (p, i) =>
            `- **#${i + 1} ${p.productName}:** **${ctx.money(p.revenue)}** (${p.unitsSold} units · ${p.sharePct}% share)`
        ),
      ].join('\n');
    },
    followUps: ['How much revenue did I generate this month?', 'Generate my monthly business summary'],
  },
  {
    id: 'best_category',
    topic: 'Inventory & Stock',
    sampleQuestions: [
      'Which product category performs best?',
      'Break down inventory by product category',
      'Sales by product category',
    ],
    phrases: ['product category', 'best category', 'category performs', 'inventory by category'],
    keywords: ['category', 'categories', 'department', 'group'],
    answer: (ctx) => {
      if (ctx.products.length === 0) {
        return `Add products in **Inventory** to view a category breakdown across Grains & Staples, Cooking Oils, Beverages & Dairy, Packaged Foods, and Household Essentials.`;
      }
      const map = new Map<string, { skus: number; units: number; value: number }>();
      for (const p of ctx.products) {
        const cur = map.get(p.category) ?? { skus: 0, units: 0, value: 0 };
        cur.skus += 1;
        cur.units += p.stock;
        cur.value += p.stock * p.unitPrice;
        map.set(p.category, cur);
      }
      const ranked = Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value);
      return [
        `### Inventory by Product Category`,
        ...ranked.map(
          ([cat, s]) =>
            `- **${cat}:** **${s.skus}** SKU${s.skus === 1 ? '' : 's'} · **${s.units}** units on hand · Retail value **${ctx.money(s.value)}**`
        ),
      ].join('\n');
    },
    followUps: ['What is my total inventory value?', 'Which product sold the most?'],
  },

  // =========================================================================
  // 8. CUSTOMERS & PAYMENT METHODS
  // =========================================================================
  {
    id: 'top_customers',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'Who is my best customer?',
      'How many customers do I have?',
      'Show my top customers by spending',
      'Who are my repeat customers?',
      'Customer directory summary',
    ],
    phrases: ['best customer', 'top customer', 'how many customers', 'repeat customers', 'customer spending', 'customer directory'],
    keywords: ['customer', 'customers', 'buyer', 'buyers', 'client', 'clients', 'repeat'],
    answer: (ctx) => {
      if (ctx.sales.length === 0 && ctx.customers.length === 0) {
        return `You have **0 customers** recorded yet. Whenever you log a sale in **Sales & Orders**, VendorPilot AI automatically adds or updates that customer in your Cloud Firestore \`customers\` directory and suggests them in autocomplete next time.`;
      }
      const map = new Map<string, { name: string; orders: number; spent: number; phone: string }>();
      for (const s of ctx.sales) {
        const key = s.customerName.trim().toLowerCase();
        const cur = map.get(key) ?? { name: s.customerName, orders: 0, spent: 0, phone: s.customerPhone };
        cur.orders += 1;
        cur.spent += s.totalAmount;
        if (!cur.phone && s.customerPhone) cur.phone = s.customerPhone;
        map.set(key, cur);
      }
      const ranked = Array.from(map.values()).sort((a, b) => b.spent - a.spent);
      const repeatCount = ranked.filter((c) => c.orders >= 2).length;
      return [
        `### Customer Insights (${ranked.length} Active Customer${ranked.length === 1 ? '' : 's'})`,
        `- **Top Customer:** **${ranked[0].name}** — **${ctx.money(ranked[0].spent)}** across **${ranked[0].orders}** order${ranked[0].orders === 1 ? '' : 's'}`,
        `- **Repeat Customers (2+ orders):** **${repeatCount}** of **${ranked.length}**`,
        `### Top Customers by Revenue`,
        ...ranked.slice(0, 5).map(
          (c, i) =>
            `- **#${i + 1} ${c.name}**${c.phone ? ` (${c.phone})` : ''}: **${ctx.money(c.spent)}** (${c.orders} order${c.orders === 1 ? '' : 's'})`
        ),
      ].join('\n');
    },
    followUps: ['Who owes me money?', 'What is my most popular payment method?'],
  },
  {
    id: 'payment_methods_all',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'What is my most popular payment method?',
      'Break down sales by payment method',
      'How do customers usually pay me?',
    ],
    phrases: ['payment method', 'popular payment', 'how do customers pay', 'payment breakdown'],
    keywords: ['payment', 'method', 'methods', 'channel', 'pay'],
    answer: (ctx) => buildPaymentMethodBreakdown(ctx),
    followUps: ['How much revenue came from Bank Transfer?', 'How much cash have I actually collected?'],
  },
  {
    id: 'payment_method_transfer',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'How much revenue came from Bank Transfer?',
      'Show Bank Transfer sales',
    ],
    phrases: ['bank transfer', 'transfer sales'],
    keywords: ['transfer', 'bank'],
    answer: (ctx) => buildPaymentMethodBreakdown(ctx, 'Bank Transfer'),
    followUps: ['What is my most popular payment method?'],
  },
  {
    id: 'payment_method_pos',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'How much did I make through POS Terminal?',
      'Show POS sales',
    ],
    phrases: ['pos terminal', 'pos sales', 'card payments'],
    keywords: ['pos', 'terminal', 'card'],
    answer: (ctx) => buildPaymentMethodBreakdown(ctx, 'POS Terminal'),
    followUps: ['What is my most popular payment method?'],
  },
  {
    id: 'payment_method_cash',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'How much did I make in Cash sales?',
      'Show Cash payments received',
    ],
    phrases: ['cash sales', 'cash payments', 'paid in cash'],
    keywords: ['cash'],
    answer: (ctx) => buildPaymentMethodBreakdown(ctx, 'Cash'),
    followUps: ['What is my most popular payment method?'],
  },
  {
    id: 'payment_method_mobile_money',
    topic: 'Customers & Payments',
    sampleQuestions: [
      'How much came from Mobile Money?',
      'Show Mobile Money sales',
    ],
    phrases: ['mobile money', 'opay', 'palmpay', 'moniepoint'],
    keywords: ['mobile'],
    answer: (ctx) => buildPaymentMethodBreakdown(ctx, 'Mobile Money'),
    followUps: ['What is my most popular payment method?'],
  },

  // =========================================================================
  // 9. SUMMARIES, HEALTH CHECK & STRATEGIC RECOMMENDATIONS
  // =========================================================================
  {
    id: 'weekly_summary_intent',
    topic: 'Summaries & Advice',
    sampleQuestions: [
      'Generate my weekly business summary',
      'Give me a weekly report',
      'Summarize my last 7 days',
      'How did my business perform this week?',
    ],
    phrases: ['weekly summary', 'weekly business summary', 'weekly report', 'summarize last 7 days', 'perform this week'],
    keywords: ['weekly', 'summary', 'report', 'week'],
    answer: (ctx) => buildWeeklySummaryAnswer(ctx),
    followUps: ['Generate my monthly business summary', 'Which products need restocking?'],
  },
  {
    id: 'monthly_summary_intent',
    topic: 'Summaries & Advice',
    sampleQuestions: [
      'Generate my monthly business summary',
      'Give me a monthly report',
      'Summarize this month performance',
      'How did my business perform this month?',
    ],
    phrases: ['monthly summary', 'monthly business summary', 'monthly report', 'summarize this month', 'perform this month'],
    keywords: ['monthly', 'summary', 'report', 'month'],
    answer: (ctx) => buildMonthlySummaryAnswer(ctx),
    followUps: ['Generate my weekly business summary', 'Show my 6-month sales trend'],
  },
  {
    id: 'business_health_check',
    topic: 'Summaries & Advice',
    sampleQuestions: [
      'Give me an overall business health check',
      'How is my business doing?',
      'Give me an executive overview',
      'What are my key operational risks or signals?',
      'Give me business recommendations',
      'What should I focus on this week?',
      'How can I grow my business?',
    ],
    phrases: ['health check', 'how is my business', 'executive overview', 'business recommendations', 'operational risks', 'focus on this week', 'grow my business', 'business advice', 'action plan'],
    keywords: ['health', 'advice', 'recommendations', 'overview', 'signals', 'risks', 'grow', 'focus', 'strategy'],
    answer: (ctx) => {
      const a = ctx.report.allTime;
      const signals = ctx.report.operationalSignals;
      const recs: string[] = [];

      if (ctx.sales.length === 0 || ctx.products.length === 0) {
        recs.push(
          `- **Complete your baseline setup:** Add your top-selling items in **Inventory** and record daily customer orders in **Sales & Orders** so trends and margin signals activate.`
        );
      }
      if (a.outOfStockCount > 0 || a.lowStockCount > 0) {
        recs.push(
          `- **Restock priority items:** **${a.lowStockCount}** SKU${a.lowStockCount === 1 ? '' : 's'} need attention (**${a.outOfStockCount}** out of stock). Replenishing early protects repeat wholesale revenue.`
        );
      }
      if (a.outstandingPayments > 0) {
        recs.push(
          `- **Accelerate receivables collection:** **${ctx.money(a.outstandingPayments)}** is tied up across **${a.unpaidOrderCount}** open order${a.unpaidOrderCount === 1 ? '' : 's'}.`
        );
      }
      if (ctx.report.expenseByCategoryAllTime[0]) {
        const topExp = ctx.report.expenseByCategoryAllTime[0];
        recs.push(
          `- **Optimize ${topExp.category}:** Review your largest cost bucket (**${topExp.sharePct}%** of spend) for bulk savings or tighter scheduling.`
        );
      }
      recs.push(
        `- **Export weekly backups:** Use **Dashboard → Download Report** to keep clean CSV records for bookkeeping and tax prep.`
      );

      return [
        `### Executive Health Check — ${ctx.businessName}`,
        `- **All-Time Revenue:** **${ctx.money(a.totalRevenue)}** (${a.totalOrders} orders) · **This Month:** **${ctx.money(ctx.report.monthlySummary.revenue)}**`,
        `- **All-Time Expenses:** **${ctx.money(a.totalExpenses)}** · **Estimated Net Profit:** **${ctx.money(a.netProfit)}** (${a.profitMarginPct}% margin)`,
        `- **Receivables:** **${ctx.money(a.outstandingPayments)}** · **Inventory:** **${ctx.products.length}** SKUs (**${ctx.money(a.inventoryValuation)}** retail value)`,
        `### Detected Operational Signals`,
        ...(signals.length > 0
          ? signals.map((s) => `- ${s}`)
          : ['- All core sales, receivables, and inventory indicators look healthy.']),
        `### Priority Action Plan`,
        ...recs,
      ].join('\n');
    },
    followUps: [
      'Generate my weekly business summary',
      'Which products need restocking?',
      'Who owes me money?',
    ],
  },

  // =========================================================================
  // 10. WEBSITE HOW-TO: DASHBOARD & CSV REPORTS
  // =========================================================================
  {
    id: 'howto_download_csv',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do I download a CSV report?',
      'How can I export my dashboard data to Excel?',
      'What is included in the Download Report CSV file?',
      'Can I export my sales and expenses?',
    ],
    phrases: ['download report', 'csv report', 'export data', 'export to excel', 'download csv', 'included in the csv'],
    keywords: ['csv', 'download', 'export', 'excel', 'spreadsheet'],
    answer: (ctx) =>
      [
        `### Exporting Your Dashboard CSV Report`,
        `You can export **${ctx.businessName}**'s filtered performance data in one click:`,
        `1. Open **Dashboard** from the left sidebar.`,
        `2. Choose your timeframe: **Daily**, **Weekly**, **Monthly**, or **All Time** (and optionally adjust the Sales Performance Chart range: **7 Days**, **30 Days**, or **6 Months**).`,
        `3. Click the **Download Report** button beside the period filter.`,
        `### What's Inside the CSV File`,
        `- Business metadata, active currency (**${ctx.currencyCode} · ${ctx.symbol}**), and selected date range.`,
        `- All **6 KPI totals** plus collected revenue, margins, and inventory valuation.`,
        `- Sales Performance chart series, Top-Selling Products, all filtered Sales Transactions, filtered Expenses, and Low-Stock Alerts—formatted with UTF-8 encoding so **${ctx.symbol}** renders cleanly in Excel and Google Sheets.`,
      ].join('\n'),
    followUps: ['How do Dashboard date filters work?', 'What do the 6 Dashboard KPI cards mean?'],
  },
  {
    id: 'howto_dashboard_filters',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do Dashboard date filters work?',
      'How do I switch between Daily, Weekly, and Monthly views?',
      'How do I read the Sales Performance chart?',
      'What do the 6 Dashboard KPI cards mean?',
      'Why is my dashboard showing zeros or empty?',
    ],
    phrases: ['date filters', 'daily weekly monthly', 'sales performance chart', 'kpi cards', 'dashboard empty', 'showing zeros', 'use the dashboard'],
    keywords: ['dashboard', 'filters', 'chart', 'kpi', 'cards', 'zeros', 'empty'],
    answer: (ctx) =>
      [
        `### Using the VendorPilot AI Dashboard`,
        `- **Period Filters (Daily / Weekly / Monthly / All Time):** Located at the top right of **Dashboard**. Switching periods dynamically recalculates your KPI cards, Recent Transactions, and Top-Selling Products from your real Firestore data.`,
        `- **6 Live KPI Cards:** Total Revenue, Total Expenses, Estimated Net Profit, Outstanding Payments, Total Products, and Low-Stock Products.`,
        `- **Sales Performance Chart:** Compares Revenue (solid emerald line) against Operating Expenses (dashed slate line) across **7 Days**, **30 Days**, or **6 Months**.`,
        `- **Seeing zeros?** New accounts start completely clean with zero fake sample data—or your selected timeframe (like **Daily**) may have no entries yet. Try switching to **All Time** or recording your first sale!`,
      ].join('\n'),
    followUps: ['How do I download a CSV report?', 'How do I record a new sale?'],
  },

  // =========================================================================
  // 11. WEBSITE HOW-TO: SALES, EXPENSES, INVENTORY & SETTINGS
  // =========================================================================
  {
    id: 'howto_record_edit_sale',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do I record a new sale?',
      'How do I edit or delete a sale?',
      'How do I mark an order as paid?',
      'How does automatic stock deduction work?',
      'How do you prevent duplicate stock deductions?',
    ],
    phrases: ['record a sale', 'record a new sale', 'edit a sale', 'delete a sale', 'mark paid', 'mark an order as paid', 'stock deduction', 'duplicate deduction'],
    keywords: ['record', 'edit', 'delete', 'mark', 'deduction', 'duplicate', 'sale', 'order'],
    answer: () =>
      [
        `### Managing Sales & Orders`,
        `- **Record a Sale:** Go to **Sales & Orders** and click **Record Sale** (or use the top header button). Pick an existing inventory product or type a custom item, enter quantity, selling price, customer details (with saved-customer autocomplete), and payment status (**Paid**, **Partial**, or **Pending**). Total amount calculates automatically.`,
        `- **Mark Paid:** On any **Pending** or **Partial** order, click **Mark Paid** to settle the remaining balance in Cloud Firestore.`,
        `- **Edit or Delete:** Click the **pencil icon** to edit any sale or the **trash icon** to delete it.`,
        `- **Duplicate-Safe Stock Protection:** Every product-linked sale runs inside a **Cloud Firestore transaction** with a unique sale ID guard. If a sale is edited, only the net quantity difference adjusts stock; if deleted, the deducted stock is safely restored.`,
      ].join('\n'),
    followUps: ['How do I record an expense?', 'How do I add or restock a product?'],
  },
  {
    id: 'howto_expenses',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do I record an expense?',
      'How do I edit or delete an expense?',
      'What expense categories are supported?',
    ],
    phrases: ['record an expense', 'add an expense', 'edit an expense', 'delete an expense', 'expense categories'],
    keywords: ['expense', 'expenses', 'record', 'edit', 'delete', 'categories'],
    answer: () =>
      [
        `### Managing Operating Expenses`,
        `1. Open **Expenses** from the left navigation sidebar and click **Record Expense**.`,
        `2. Select a category (**Inventory Restock**, **Logistics & Delivery**, **Power & Generator Fuel**, **Rent & Utilities**, **Staff Salaries**, **Marketing & Ads**, or **Packaging & Supplies**).`,
        `3. Enter the amount, description, vendor name, payment method, and transaction date, then save.`,
        `4. Use the **pencil icon** to edit any entry or the **trash icon** to remove it—your Dashboard profit and category breakdown update immediately.`,
      ].join('\n'),
    followUps: ['What were my biggest expenses?', 'How do I record a new sale?'],
  },
  {
    id: 'howto_inventory',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do I add a new product?',
      'How do I edit or delete a product?',
      'How do I restock a product?',
      'How do I set a low-stock threshold?',
    ],
    phrases: ['add a product', 'add a new product', 'edit a product', 'delete a product', 'restock a product', 'low-stock threshold', 'low stock alert'],
    keywords: ['add', 'create', 'product', 'restock', 'threshold', 'inventory'],
    answer: () =>
      [
        `### Managing Inventory & Restocking`,
        `- **Add a Product:** Open **Inventory** and click **Add Product**. Enter product name, SKU, category, unit label, cost price, selling price, current stock quantity, and your **Low-Stock Alert Threshold**.`,
        `- **Restock Safely:** Click **Restock** on any item in **Inventory** or inside the **Dashboard Low-Stock Alerts** panel to increment stock atomically in Cloud Firestore.`,
        `- **Edit / Delete:** Use the **pencil icon** to update prices, quantities, or alert thresholds, or the **trash icon** to remove an item.`,
      ].join('\n'),
    followUps: ['Which products need restocking?', 'What is my total inventory value?'],
  },
  {
    id: 'howto_settings_currency',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do I update my business profile or settings?',
      'How do I change my business currency?',
      'Can I use USD, GBP, or GHS instead of Naira?',
      'How do I update my VAT rate, phone number, or RC number?',
    ],
    phrases: ['business settings', 'business profile', 'change currency', 'business currency', 'vat rate', 'rc number', 'usd', 'gbp', 'ghs'],
    keywords: ['settings', 'profile', 'currency', 'vat', 'naira', 'dollar', 'pounds', 'cedis'],
    answer: (ctx) =>
      [
        `### Business Profile & Currency Settings`,
        `Your account is currently configured for **${ctx.businessName}** using **${ctx.currencyCode} (${ctx.symbol})**.`,
        `- Go to **Business Settings** in the sidebar to edit your **Business Name**, **Category**, **Location/Address**, **Phone Number**, **RC Number**, **Default Low-Stock Threshold**, and **VAT Rate**.`,
        `- Under **Business Currency**, you can switch between **NGN (₦)** (default), **USD ($)**, **GBP (£)**, and **GHS (₵)**—every view and CSV export updates automatically.`,
      ].join('\n'),
    followUps: ['How do I download a CSV report?', 'Is my business data safe and private?'],
  },

  // =========================================================================
  // 12. SECURITY, PRIVACY, CLOUD FIRESTORE & ACCOUNT
  // =========================================================================
  {
    id: 'security_privacy_firestore',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'Is my business data safe and private?',
      'Where is my data stored?',
      'Can other users see my business records?',
      'Does my data persist after refreshing the browser?',
      'How do Firestore security rules protect my account?',
      'Do you store sensitive data in localStorage?',
    ],
    phrases: ['data safe', 'data private', 'where is my data stored', 'other users see', 'after refreshing', 'persist after refresh', 'security rules', 'localstorage'],
    keywords: ['safe', 'secure', 'security', 'private', 'privacy', 'stored', 'persist', 'refresh', 'localstorage'],
    answer: (ctx) =>
      [
        `### Security & Data Isolation for ${ctx.businessName}`,
        `- **Cloud Firestore Persistence:** All of your business data is saved in Cloud Firestore across 6 collections (\`users\`, \`businesses\`, \`sales\`, \`expenses\`, \`products\`, \`customers\`), so every record persists cleanly after refreshing or switching devices.`,
        `- **Strict Per-User Isolation:** Firestore Security Rules verify your authenticated Firebase UID on every read and write. Other users cannot view, edit, or delete your records.`,
        `- **No Sensitive \`localStorage\`:** Session persistence uses Firebase's browser IndexedDB auth store—no private business records or tokens are stored in \`localStorage\`.`,
      ].join('\n'),
    followUps: ['How do I sign out or stay signed in?', 'Do you invent or make up business figures?'],
  },
  {
    id: 'auth_signout_session',
    topic: 'Website & Account Guide',
    sampleQuestions: [
      'How do I sign out or log out?',
      'Will I stay signed in when I revisit the website?',
      'Why do I need Google Sign-In?',
      'How do I start a new chat thread?',
    ],
    phrases: ['sign out', 'log out', 'logout', 'stay signed in', 'google sign-in', 'google sign in', 'new chat', 'clear chat', 'reset chat'],
    keywords: ['signout', 'logout', 'login', 'session', 'google', 'thread', 'reset'],
    answer: () =>
      [
        `### Account Sessions & Chat Controls`,
        `- **Persistent Login:** Once you sign in with Google, your session stays active automatically when you revisit the website.`,
        `- **Signing Out:** Click **Sign Out** at the bottom of the left sidebar (or inside **Business Settings**) to securely end your session.`,
        `- **New Chat Thread:** Click **New thread** at the top right of this AI Business Assistant panel anytime to clear the conversation and start fresh.`,
      ].join('\n'),
    followUps: ['Is my business data safe and private?', 'What can you do?'],
  },
];

export const CURATED_TOPIC_PROMPTS: Record<QuestionTopic, string[]> = {
  'Sales & Revenue': [
    'How much revenue did I generate this month?',
    'Which product sold the most?',
    'Show my 6-month sales trend',
    'What is my average order value?',
  ],
  'Profit & Cashflow': [
    'What is my estimated net profit?',
    'What is my estimated gross profit?',
    'How much cash have I actually collected?',
    'How can I increase my profit margin?',
  ],
  'Expenses & Costs': [
    'What were my biggest expenses?',
    'What were my expenses this month?',
    'How much did I spend on diesel and generator fuel?',
    'How can I reduce my operating expenses?',
  ],
  'Inventory & Stock': [
    'Which products need restocking?',
    'What is my total inventory value?',
    'Which products have zero sales?',
    'What is my highest-priced product?',
  ],
  'Customers & Payments': [
    'Who owes me money?',
    'Who is my best customer?',
    'What is my most popular payment method?',
    'How should I follow up with customers who owe me?',
  ],
  'Summaries & Advice': [
    'Give me an overall business health check',
    'Generate my weekly business summary',
    'Generate my monthly business summary',
  ],
  'Website & Account Guide': [
    'How do I download a CSV report?',
    'How do I record a new sale?',
    'How do I change my business currency?',
    'Is my business data safe and private?',
  ],
};

export function getPrebuiltQuestionCount(): number {
  return PREBUILT_QA_CATALOG.reduce((sum, intent) => sum + intent.sampleQuestions.length, 0);
}

/**
 * Checks if the user is asking about a specific product or customer
 * present in their real Cloud Firestore records.
 */
function tryDynamicEntityLookup(
  normalizedQuestion: string,
  ctx: AssistantContext
): LocalAssistantResponse | null {
  // 1. Match a specific product by SKU or product name (min 3 chars to avoid noise)
  const matchedProduct = ctx.products.find((p) => {
    const skuNorm = normalizeText(p.sku);
    const nameNorm = normalizeText(p.name);
    if (skuNorm.length >= 3 && normalizedQuestion.includes(skuNorm)) return true;
    if (nameNorm.length >= 4 && normalizedQuestion.includes(nameNorm)) return true;
    // Check significant words (e.g., first two words of product name if >= 7 chars)
    const words = nameNorm.split(' ').filter((w) => w.length >= 4);
    if (words.length >= 2 && normalizedQuestion.includes(`${words[0]} ${words[1]}`)) {
      return true;
    }
    return false;
  });

  if (matchedProduct) {
    const prodSales = ctx.sales.filter(
      (s) =>
        s.productId === matchedProduct.id ||
        s.productName.trim().toLowerCase() === matchedProduct.name.trim().toLowerCase()
    );
    const totalRev = prodSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalUnits = prodSales.reduce((sum, s) => sum + s.quantity, 0);
    const status = getStockStatus(matchedProduct);
    const marginPct =
      matchedProduct.unitPrice > 0 && matchedProduct.costPrice > 0
        ? (((matchedProduct.unitPrice - matchedProduct.costPrice) / matchedProduct.unitPrice) * 100).toFixed(1)
        : null;

    return {
      answer: [
        `### Product Snapshot: ${matchedProduct.name} (\`${matchedProduct.sku}\`)`,
        `- **Category:** ${matchedProduct.category} · **Unit:** ${matchedProduct.unit}`,
        `- **Selling Price:** **${ctx.money(matchedProduct.unitPrice)}**${matchedProduct.costPrice > 0 ? ` · **Cost Price:** **${ctx.money(matchedProduct.costPrice)}** (**${marginPct}%** margin)` : ''}`,
        `- **Current Stock:** **${matchedProduct.stock}** ${matchedProduct.unit}(s) (**${status}**, reorder threshold **${matchedProduct.reorderLevel}**)`,
        `- **Recorded Sales:** **${ctx.money(totalRev)}** across **${prodSales.length}** order${prodSales.length === 1 ? '' : 's'} (**${totalUnits}** unit${totalUnits === 1 ? '' : 's'} sold)`,
      ].join('\n'),
      matchedIntentId: `product_lookup:${matchedProduct.id}`,
      matchedTopic: 'Dynamic Lookup',
      confidence: 0.95,
      isFallback: false,
      suggestedFollowUps: ['Which products need restocking?', 'Which product sold the most?'],
    };
  }

  // 2. Match a specific customer from sales or customer directory
  const customerNames = new Map<string, string>();
  for (const c of ctx.customers) {
    customerNames.set(normalizeText(c.name), c.name);
  }
  for (const s of ctx.sales) {
    customerNames.set(normalizeText(s.customerName), s.customerName);
  }

  for (const [normName, displayName] of customerNames.entries()) {
    if (normName.length >= 4 && normalizedQuestion.includes(normName)) {
      const custSales = ctx.sales.filter(
        (s) => normalizeText(s.customerName) === normName
      );
      const totalSpent = custSales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalOwed = custSales.reduce((sum, s) => sum + getOutstandingBalance(s), 0);
      const phone =
        custSales.find((s) => s.customerPhone)?.customerPhone ||
        ctx.customers.find((c) => normalizeText(c.name) === normName)?.phone ||
        '';
      const lastOrder = custSales[0];

      return {
        answer: [
          `### Customer Profile: ${displayName}`,
          phone ? `- **Phone:** ${phone}` : '',
          `- **Total Orders:** **${custSales.length}** · **Total Spend:** **${ctx.money(totalSpent)}**`,
          `- **Outstanding Balance:** **${ctx.money(totalOwed)}**`,
          lastOrder
            ? `- **Most Recent Order:** **${lastOrder.orderNumber}** (${formatShortDate(lastOrder.date)}) — ${lastOrder.productName} × ${lastOrder.quantity} (**${ctx.money(lastOrder.totalAmount)}**, ${lastOrder.paymentStatus})`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        matchedIntentId: `customer_lookup:${normName}`,
        matchedTopic: 'Dynamic Lookup',
        confidence: 0.94,
        isFallback: false,
        suggestedFollowUps: ['Who owes me money?', 'Who is my best customer?'],
      };
    }
  }

  return null;
}

function scoreIntent(
  normalizedQuestion: string,
  questionTokens: string[],
  intent: PrebuiltQaIntent
): number {
  let bestScore = 0;

  // 1. Exact or near-exact match against any of the intent's pre-built sample questions
  for (const sample of intent.sampleQuestions) {
    const normSample = normalizeText(sample);
    if (!normSample) continue;
    if (normalizedQuestion === normSample) {
      return 100;
    }
    if (
      normalizedQuestion.length >= 6 &&
      (normalizedQuestion.includes(normSample) || normSample.includes(normalizedQuestion))
    ) {
      const lengthRatio =
        Math.min(normalizedQuestion.length, normSample.length) /
        Math.max(normalizedQuestion.length, normSample.length);
      bestScore = Math.max(bestScore, 55 + lengthRatio * 35);
    }

    // Token Jaccard similarity against sample question
    const sampleTokens = tokenize(normSample);
    if (sampleTokens.length > 0 && questionTokens.length > 0) {
      const sampleSet = new Set(sampleTokens);
      let hits = 0;
      for (const t of questionTokens) {
        if (sampleSet.has(t)) hits += 1;
      }
      const overlap = hits / Math.max(sampleTokens.length, questionTokens.length);
      if (overlap >= 0.45) {
        bestScore = Math.max(bestScore, overlap * 75);
      }
    }
  }

  // 2. Phrase boosts (high precision multi-word triggers)
  let phraseScore = 0;
  for (const phrase of intent.phrases) {
    const normPhrase = normalizeText(phrase);
    if (normPhrase && normalizedQuestion.includes(normPhrase)) {
      phraseScore += normPhrase.split(' ').length >= 2 ? 32 : 18;
    }
  }

  // 3. Keyword overlap
  let keywordHits = 0;
  for (const kw of intent.keywords) {
    const normKw = normalizeText(kw);
    if (
      questionTokens.includes(normKw) ||
      (normKw.length >= 4 && normalizedQuestion.includes(normKw))
    ) {
      keywordHits += 1;
    }
  }
  const keywordScore =
    intent.keywords.length > 0
      ? keywordHits * 11 + (keywordHits / intent.keywords.length) * 18
      : 0;

  return Math.max(bestScore, phraseScore + keywordScore);
}

function buildFallbackGuide(question: string, ctx: AssistantContext): FallbackGuide {
  const safeSnippet = question.trim().slice(0, 100);
  const hasRecords =
    ctx.sales.length > 0 || ctx.expenses.length > 0 || ctx.products.length > 0;

  const ledgerSummary = hasRecords
    ? `Right now, ${ctx.businessName}'s Cloud Firestore ledger holds ${ctx.sales.length} sale${ctx.sales.length === 1 ? '' : 's'}, ${ctx.expenses.length} expense${ctx.expenses.length === 1 ? '' : 's'}, and ${ctx.products.length} product${ctx.products.length === 1 ? '' : 's'}.`
    : `Your ${ctx.businessName} ledger does not have any sales, expenses, or products yet—you can still ask how to use any dashboard feature, or start logging records to unlock live analytics.`;

  const quickExamples = hasRecords
    ? [
        'How much revenue did I generate this month?',
        'What is my estimated net profit?',
        'Which products need restocking?',
        'Who owes me money?',
      ]
    : [
        'How do I record a new sale?',
        'How do I add a new product?',
        'How do I download a CSV report?',
        'What can you do?',
      ];

  return {
    heading: 'Ask Me Anything About Your Business Records',
    unmatchedQuery: safeSnippet,
    scopeNote: `I focus specifically on analyzing ${ctx.businessName}'s real Cloud Firestore sales, expenses, inventory, and customer records—plus guiding you around VendorPilot AI—and I never invent figures. ${ledgerSummary}`,
    phrasingTip:
      'For the best results, include a clear business metric (revenue, expenses, net profit, top product, low stock, or unpaid balance) plus a timeframe (today, this week, this month, or all time)—or mention a specific product or customer name from your ledger.',
    quickExamples,
  };
}

function buildHelpfulFallbackReply(guide: FallbackGuide): string {
  const queryLine = guide.unmatchedQuery
    ? `I didn't find a direct match for *"${guide.unmatchedQuery}"*.`
    : `Please enter a question about your business performance or records.`;

  return [
    `### ${guide.heading}`,
    `${queryLine} ${guide.scopeNote}`,
    `**Tip for better results:** ${guide.phrasingTip}`,
    `### Try Asking:`,
    ...guide.quickExamples.map((q) => `- *"${q}"*`),
  ].join('\n');
}

/**
 * Answers a business or website question purely on the client using the user's
 * verified Cloud Firestore records and 115+ pre-built intents—with zero Gemini API dependency.
 */
export function answerBusinessQuestion(input: LocalAssistantInput): LocalAssistantResponse {
  const {
    question,
    reportType = 'chat',
    settings,
    sales,
    expenses,
    products,
    customers = [],
    referenceIsoDate,
  } = input;

  const report = buildBusinessAnalyticsReport({
    settings,
    sales,
    expenses,
    products,
    referenceIsoDate,
  });

  const symbol = settings.currencySymbol || report.currencySymbol || '₦';
  const currencyCode = settings.currencyCode || report.currencyCode || 'NGN';
  const ownerName = settings.ownerName?.trim() || 'Business Owner';
  const firstName = ownerName.split(' ')[0] || 'there';
  const businessName = settings.businessName?.trim() || 'your business';
  const businessType = settings.businessType?.trim() || 'SME';
  const todayIso = report.generatedOnDate;
  const yesterdayIso = getYesterdayIso(todayIso);

  const ctx: AssistantContext = {
    businessName,
    businessType,
    firstName,
    ownerName,
    currencyCode,
    symbol,
    todayIso,
    yesterdayIso,
    settings,
    sales,
    expenses,
    products,
    customers,
    report,
    money: (amount: number) => formatNaira(amount, false, symbol),
  };

  // 1. Direct report buttons (Weekly / Monthly Summary)
  if (reportType === 'weekly_summary') {
    return {
      answer: buildWeeklySummaryAnswer(ctx),
      matchedIntentId: 'weekly_summary_intent',
      matchedTopic: 'Summaries & Advice',
      confidence: 1,
      isFallback: false,
      suggestedFollowUps: [
        'Generate my monthly business summary',
        'Which products need restocking?',
        'What were my biggest expenses?',
      ],
    };
  }

  if (reportType === 'monthly_summary') {
    return {
      answer: buildMonthlySummaryAnswer(ctx),
      matchedIntentId: 'monthly_summary_intent',
      matchedTopic: 'Summaries & Advice',
      confidence: 1,
      isFallback: false,
      suggestedFollowUps: [
        'Show my 6-month sales trend',
        'Who owes me money?',
        'How can I increase my profit margin?',
      ],
    };
  }

  const normalized = normalizeText(question);
  if (!normalized) {
    const guide = buildFallbackGuide(question, ctx);
    return {
      answer: buildHelpfulFallbackReply(guide),
      matchedIntentId: 'fallback_empty',
      matchedTopic: 'Fallback',
      confidence: 0,
      isFallback: true,
      suggestedFollowUps: guide.quickExamples,
      fallbackGuide: guide,
    };
  }

  // 2. Score pre-built Q&A catalog
  const tokens = tokenize(normalized);
  let bestIntent: PrebuiltQaIntent | null = null;
  let bestScore = 0;

  for (const intent of PREBUILT_QA_CATALOG) {
    const score = scoreIntent(normalized, tokens, intent);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // 3. If a strong exact/phrase intent match wasn't hit, check dynamic product/customer lookup
  if (bestScore < 65) {
    const entityMatch = tryDynamicEntityLookup(normalized, ctx);
    if (entityMatch) {
      return entityMatch;
    }
  }

  // 4. Return matched pre-built response if above confidence threshold
  const CONFIDENCE_THRESHOLD = 28;
  if (bestIntent && bestScore >= CONFIDENCE_THRESHOLD) {
    return {
      answer: bestIntent.answer(ctx),
      matchedIntentId: bestIntent.id,
      matchedTopic: bestIntent.topic,
      confidence: Number(Math.min(1, bestScore / 100).toFixed(2)),
      isFallback: false,
      suggestedFollowUps: bestIntent.followUps,
    };
  }

  // 5. Friendly 'Ask Me Anything' fallback when the question does not match predefined intents
  const guide = buildFallbackGuide(question, ctx);
  return {
    answer: buildHelpfulFallbackReply(guide),
    matchedIntentId: 'fallback_unmatched',
    matchedTopic: 'Fallback',
    confidence: Number(Math.min(0.25, bestScore / 100).toFixed(2)),
    isFallback: true,
    suggestedFollowUps: guide.quickExamples,
    fallbackGuide: guide,
  };
}
