import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  AuthVerificationError,
  fetchUserBusinessRecordsFromFirestore,
  FirestoreAccessError,
  verifyFirebaseIdToken,
} from './firestoreRest';
import { buildBusinessAnalyticsReport } from '../utils/assistantAnalytics';
import { PerUserRateLimiter } from '../utils/rateLimiter';

// Free-tier eligible Gemini model
const GEMINI_FREE_TIER_MODEL = 'gemini-4-hydrogen';

// Sensible per-user usage limits to protect free-tier quota
const assistantRateLimiter = new PerUserRateLimiter({
  maxPerMinute: 10,
  maxPerDay: 60,
});

export type AssistantReportType = 'chat' | 'weekly_summary' | 'monthly_summary';

interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRequestBody {
  question?: unknown;
  history?: unknown;
  reportType?: unknown;
}

export interface AiAssistantHandlerInput {
  authorizationHeader?: string | string[];
  body: unknown;
}

export interface AiAssistantHandlerResult {
  status: number;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractBearerToken(authHeader: string | string[] | undefined): string | null {
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw || typeof raw !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}

function parseReportType(raw: unknown): AssistantReportType {
  if (raw === 'weekly_summary' || raw === 'monthly_summary') {
    return raw;
  }
  return 'chat';
}

function sanitizeHistory(raw: unknown): AssistantHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-6)
    .filter(
      (item): item is AssistantHistoryItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        ((item as AssistantHistoryItem).role === 'user' ||
          (item as AssistantHistoryItem).role === 'assistant') &&
        typeof (item as AssistantHistoryItem).content === 'string'
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 1000),
    }))
    .filter((item) => item.content.length > 0);
}

async function generateWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  systemInstruction: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_FREE_TIER_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
      const text = response.text?.trim();
      if (text) return text;
      throw new Error('EMPTY_RESPONSE');
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || status === 503 || status === 500;
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

function buildSystemInstruction(
  reportJson: string,
  reportType: AssistantReportType,
  currencySymbol: string
): string {
  const formatGuidance =
    reportType === 'weekly_summary'
      ? [
          'The user requested a **Weekly Business Summary** covering the exact `weeklySummary` period in the JSON.',
          'Organise the response with clean `###` subheadings: `### Weekly Performance`, `### Top Products & Sales`, `### Expenses & Cashflow`, `### Stock & Actionable Recommendations`.',
          'Keep it crisp (under 340 words). If `dataAvailability.hasThisWeekSales` and `dataAvailability.hasThisWeekExpenses` are both false, state clearly that no transactions were recorded in the last 7 days and highlight any low-stock alerts or all-time context if available.',
        ]
      : reportType === 'monthly_summary'
        ? [
            'The user requested a **Monthly Business Summary** covering the exact `monthlySummary` period in the JSON.',
            'Organise the response with clean `###` subheadings: `### Monthly Performance`, `### Sales & Top Products`, `### Expense Summary`, `### Stock, Receivables & Recommendations`.',
            'Keep it crisp (under 360 words). If `dataAvailability.hasThisMonthSales` and `dataAvailability.hasThisMonthExpenses` are both false, state clearly that no transactions were recorded this month and highlight any inventory alerts or all-time context if available.',
          ]
        : [
            'Lead directly with the exact answer using the pre-computed figures, then add brief supporting detail and 2-3 practical SME recommendations when helpful.',
            `Keep responses concise (under 240 words unless a detailed breakdown is requested). Use short paragraphs, bullet lists, and **bold** highlights for key ${currencySymbol} amounts and product names.`,
          ];

  return [
    'You are VendorPilot AI, a concise commercial financial and operations advisor built for Nigerian SME owners.',
    '',
    'STRICT DATA INTEGRITY RULES (MANDATORY):',
    '1. All financial metrics, totals, averages, margins, weekly totals, monthly totals, rankings, and stock counts in the JSON below were pre-calculated by verified application logic directly from the authenticated user’s Cloud Firestore database.',
    '2. NEVER invent, estimate, or hallucinate sales, expenses, products, customer names, dates, or monetary figures that are not present in the JSON below.',
    '3. ALWAYS rely on the pre-computed totals and percentages in the JSON rather than doing mental arithmetic. When quoting profit, clearly label it as estimated net profit (recorded revenue minus recorded expenses) or estimated gross profit where cost prices exist.',
    '4. If requested information is unavailable (for example, `hasSales: false`, `hasExpenses: false`, `hasInventory: false`, zero records in a requested timeframe, or a product/customer not found in the records), clearly and politely tell the user that those records are not yet available in their account, and mention which dashboard section they can use to add them.',
    `5. Format currency using the business currency symbol \`${currencySymbol}\` with comma separators (e.g., \`${currencySymbol}485,000\`).`,
    '',
    ...formatGuidance,
    '',
    'VERIFIED FIRESTORE BUSINESS ANALYTICS (PRE-COMPUTED BY APPLICATION LOGIC):',
    reportJson,
  ].join('\n');
}

export async function handleAiAssistantRequest(
  input: AiAssistantHandlerInput
): Promise<AiAssistantHandlerResult> {
  // 1. Authenticate caller using Firebase ID token
  const idToken = extractBearerToken(input.authorizationHeader);
  if (!idToken) {
    return {
      status: 401,
      body: {
        error: 'Authentication required. Please sign in to your account to use the AI Business Assistant.',
      },
    };
  }

  let verifiedUser;
  try {
    verifiedUser = await verifyFirebaseIdToken(idToken);
  } catch (err: unknown) {
    const status = err instanceof AuthVerificationError ? err.status : 401;
    const message =
      err instanceof Error ? err.message : 'Unable to verify your sign-in session. Please sign in again.';
    return { status, body: { error: message } };
  }

  if (!verifiedUser.emailVerified) {
    return {
      status: 403,
      body: {
        error: 'Please verify your email address before using the AI Business Assistant.',
      },
    };
  }

  // 2. Validate request body
  const body = (input.body && typeof input.body === 'object' ? input.body : {}) as AssistantRequestBody;
  const reportType = parseReportType(body.reportType);
  const rawQuestion = typeof body.question === 'string' ? body.question.trim() : '';

  const effectiveQuestion =
    rawQuestion ||
    (reportType === 'weekly_summary'
      ? 'Generate my weekly business summary covering sales, expenses, estimated net profit, top-selling products, low-stock items, and practical recommendations.'
      : reportType === 'monthly_summary'
        ? 'Generate my monthly business summary covering revenue, expenses, estimated net profit, top-selling products, unpaid customer balances, low-stock items, and practical recommendations.'
        : '');

  if (!effectiveQuestion) {
    return {
      status: 400,
      body: { error: 'Please enter a question about your business.' },
    };
  }

  if (effectiveQuestion.length > 1500) {
    return {
      status: 400,
      body: { error: 'Question is too long. Please keep it under 1,500 characters.' },
    };
  }

  // 3. Enforce per-user usage limits (free-tier protection)
  const limitStatus = assistantRateLimiter.consume(verifiedUser.uid);
  if (!limitStatus.allowed) {
    const waitMsg =
      limitStatus.reason === 'daily_limit'
        ? `You have reached the daily limit of ${limitStatus.dailyLimit} AI Business Assistant questions. Your quota resets automatically at midnight UTC.`
        : `You have sent too many questions in a short period (limit: ${limitStatus.minuteLimit} per minute). Please wait ${limitStatus.retryAfterSeconds} seconds and try again.`;
    return {
      status: 429,
      headers: { 'Retry-After': String(limitStatus.retryAfterSeconds) },
      body: {
        error: waitMsg,
        retryAfterSeconds: limitStatus.retryAfterSeconds,
        usage: {
          remainingMinute: limitStatus.remainingMinute,
          remainingDaily: limitStatus.remainingDaily,
          minuteLimit: limitStatus.minuteLimit,
          dailyLimit: limitStatus.dailyLimit,
        },
      },
    };
  }

  // 4. Verify Gemini API key on server
  const ai = createGeminiClient();
  if (!ai) {
    return {
      status: 503,
      body: {
        error:
          'AI Business Assistant requires a configured GEMINI_API_KEY environment variable on the server.',
      },
    };
  }

  // 5. Fetch the authenticated user's ACTUAL business records from Firestore
  let records;
  try {
    records = await fetchUserBusinessRecordsFromFirestore(verifiedUser, idToken);
  } catch (err: unknown) {
    const status = err instanceof FirestoreAccessError ? err.status : 502;
    const message =
      err instanceof Error
        ? err.message
        : 'Unable to load your Firestore business records right now. Please try again.';
    console.error('Firestore read error in /api/ai-assistant:', status, message);
    return { status, body: { error: message } };
  }

  // 6. Compute all financial metrics deterministically in application logic
  const analyticsReport = buildBusinessAnalyticsReport({
    settings: records.settings,
    sales: records.sales,
    expenses: records.expenses,
    products: records.products,
  });

  const groundedPayload = {
    analytics: analyticsReport,
    recentSalesSample: records.sales.slice(0, 25).map((s) => ({
      orderNumber: s.orderNumber,
      date: s.date,
      product: s.productName,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      customer: s.customerName,
      paymentStatus: s.paymentStatus,
      paymentMethod: s.paymentMethod,
    })),
    recentExpensesSample: records.expenses.slice(0, 25).map((e) => ({
      date: e.date,
      category: e.category,
      vendor: e.vendor,
      description: e.description,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
    })),
    inventoryCatalogSample: records.products.slice(0, 50).map((p) => ({
      sku: p.sku,
      productName: p.name,
      category: p.category,
      quantityInStock: p.stock,
      lowStockThreshold: p.reorderLevel,
      sellingPrice: p.unitPrice,
      costPrice: p.costPrice,
    })),
    sampleCoverageNote:
      'All numeric totals in `analytics` include 100% of the user’s loaded Firestore records. The three sample arrays provide recent item-level detail.',
  };

  const recentHistory = sanitizeHistory(body.history)
    .map((item) => `${item.role === 'user' ? 'Business Owner' : 'VendorPilot AI'}: ${item.content}`)
    .join('\n\n');

  const currencySymbol = records.settings.currencySymbol || '₦';
  const systemInstruction = buildSystemInstruction(
    JSON.stringify(groundedPayload, null, 2),
    reportType,
    currencySymbol
  );

  const prompt =
    reportType === 'chat' && recentHistory
      ? `Recent conversation:\n${recentHistory}\n\nBusiness Owner's new question:\n${effectiveQuestion}`
      : effectiveQuestion;

  // 7. Call Gemini API (free-tier model) on server side
  try {
    const answer = await generateWithRetry(ai, prompt, systemInstruction);
    return {
      status: 200,
      body: {
        answer,
        generatedAt: new Date().toISOString(),
        recordCounts: {
          sales: records.sales.length,
          expenses: records.expenses.length,
          inventory: records.products.length,
        },
        usage: {
          remainingMinute: limitStatus.remainingMinute,
          remainingDaily: limitStatus.remainingDaily,
          minuteLimit: limitStatus.minuteLimit,
          dailyLimit: limitStatus.dailyLimit,
        },
      },
    };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : 'Unable to reach AI service.';
    console.error('Gemini API error in /api/ai-assistant:', status ?? 'unknown', message);

    if (
      status === 400 ||
      status === 403 ||
      message.includes('API_KEY_INVALID') ||
      message.includes('PERMISSION_DENIED')
    ) {
      return {
        status: 403,
        body: {
          error:
            'Unable to authenticate with the Gemini API. Please verify your GEMINI_API_KEY environment variable.',
        },
      };
    }

    if (status === 429 || message.includes('RESOURCE_EXHAUSTED')) {
      return {
        status: 429,
        body: {
          error:
            'The Gemini free-tier request quota is temporarily busy. Please wait a moment and try again.',
        },
      };
    }

    return {
      status: 502,
      body: {
        error: 'Unable to generate an AI insight right now. Please try again shortly.',
      },
    };
  }
}
