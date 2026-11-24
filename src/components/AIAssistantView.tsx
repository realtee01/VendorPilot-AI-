import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, RotateCcw, AlertCircle, CalendarDays, FileBarChart2 } from 'lucide-react';
import { ChatMessage } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import { formatNaira } from '../utils/analytics';
import { buildBusinessAnalyticsReport } from '../utils/assistantAnalytics';

type AssistantReportType = 'chat' | 'weekly_summary' | 'monthly_summary';

interface AssistantUsageInfo {
  remainingMinute: number;
  remainingDaily: number;
  minuteLimit: number;
  dailyLimit: number;
}

const STARTER_PROMPTS = [
  'How much revenue did I generate this month?',
  'Which product sold the most?',
  'What were my biggest expenses?',
  'Which products need restocking?',
  'What is my estimated net profit?',
];

function renderFormattedText(content: string): React.ReactNode {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={idx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const flushBullets = (keyPrefix: string) => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={`${keyPrefix}-ul`} className="my-2 list-disc space-y-1.5 pl-5 text-slate-700">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {formatInline(item)}
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushBullets(`b-${index}`);
      return;
    }
    if (line.startsWith('### ') || line.startsWith('## ')) {
      flushBullets(`h-${index}`);
      const headingText = line.replace(/^#{2,3}\s+/, '');
      blocks.push(
        <h3
          key={`h-${index}`}
          className="text-xs font-semibold tracking-wide text-slate-900 uppercase not-first:mt-4"
        >
          {formatInline(headingText)}
        </h3>
      );
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const cleaned = line.replace(/^([-*]|\d+\.)\s+/, '');
      bulletBuffer.push(cleaned);
    } else {
      flushBullets(`p-${index}`);
      blocks.push(
        <p key={`p-${index}`} className="leading-relaxed text-slate-700 not-first:mt-2.5">
          {formatInline(line)}
        </p>
      );
    }
  });
  flushBullets('end');

  return blocks;
}

export function AIAssistantView() {
  const { user, state, metrics, topSellingProducts } = useBusiness();
  const currencySymbol = state.settings.currencySymbol || '₦';
  const [input, setInput] = useState('');
  const [lastRequest, setLastRequest] = useState<{
    question: string;
    reportType: AssistantReportType;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contextPeriod, setContextPeriod] = useState<'month' | 'all'>('month');
  const [usageNotice, setUsageNotice] = useState<string | null>(null);

  const report = useMemo(
    () =>
      buildBusinessAnalyticsReport({
        settings: state.settings,
        sales: state.sales,
        expenses: state.expenses,
        products: state.products,
      }),
    [state.settings, state.sales, state.expenses, state.products]
  );

  const firstName = state.settings.ownerName.trim().split(' ')[0] || 'there';
  const hasRecords =
    state.sales.length > 0 || state.expenses.length > 0 || state.products.length > 0;

  const buildWelcomeContent = () =>
    hasRecords
      ? `Hello ${firstName}. I am connected to **${state.settings.businessName}**'s verified Firestore records: all-time revenue is **${formatNaira(report.allTime.totalRevenue, false, currencySymbol)}**, expenses are **${formatNaira(report.allTime.totalExpenses, false, currencySymbol)}**, and estimated net profit is **${formatNaira(report.allTime.netProfit, false, currencySymbol)}** (${report.allTime.profitMarginPct}% margin).\n\nThis month (${report.monthlySummary.label}), you have recorded **${formatNaira(report.monthlySummary.revenue, false, currencySymbol)}** in revenue across **${report.monthlySummary.orderCount}** order${report.monthlySummary.orderCount === 1 ? '' : 's'}, with **${report.allTime.lowStockCount}** SKU${report.allTime.lowStockCount === 1 ? '' : 's'} needing restock attention. Ask a question below or generate a Weekly or Monthly Summary.`
      : `Hello ${firstName}. Welcome to **${state.settings.businessName}**'s AI Business Assistant. I analyse your actual Cloud Firestore sales, expenses, and inventory records and will never invent figures.\n\nYou have not recorded any sales, expenses, or products yet. Once you add your first records, ask me about revenue, expenses, profit, top-selling products, low-stock alerts, or weekly and monthly summaries.`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      timestamp: 'Now',
      content: buildWelcomeContent(),
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendRequest = async (
    questionText: string,
    reportType: AssistantReportType = 'chat'
  ) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Please sign in with your Google account to query your business records.',
          timestamp: new Date().toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isError: true,
        },
      ]);
      return;
    }

    const timeLabel = new Date().toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: timeLabel,
    };

    const historyForApi = messages
      .filter((m) => !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setLastRequest({ question: trimmed, reportType });
    setMessages((prev) => [...prev, userMsg]);
    if (reportType === 'chat') {
      setInput('');
    }
    setIsLoading(true);
    setUsageNotice(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          question: trimmed,
          reportType,
          history: reportType === 'chat' ? historyForApi : [],
        }),
      });

      const data = (await res.json()) as {
        answer?: string;
        error?: string;
        usage?: AssistantUsageInfo;
      };

      if (data.usage && data.usage.remainingDaily <= 5) {
        setUsageNotice(
          `${data.usage.remainingDaily} of ${data.usage.dailyLimit} daily AI queries remaining today.`
        );
      }

      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'Unable to retrieve AI response.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.answer as string,
          timestamp: new Date().toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Could not reach the AI Business Assistant service. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date().toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setUsageNotice(null);
    setLastRequest(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        timestamp: 'Now',
        content: buildWelcomeContent(),
      },
    ]);
  };

  const activeRevenue =
    contextPeriod === 'month' ? report.monthlySummary.revenue : metrics.totalRevenue;
  const activeExpenses =
    contextPeriod === 'month' ? report.monthlySummary.expenses : metrics.totalExpenses;
  const activeProfit =
    contextPeriod === 'month' ? report.monthlySummary.estimatedNetProfit : metrics.netProfit;
  const activeOrders =
    contextPeriod === 'month' ? report.monthlySummary.orderCount : metrics.totalOrders;
  const activeTopProduct =
    contextPeriod === 'month'
      ? report.monthlySummary.topProducts[0]?.productName ?? 'None yet'
      : topSellingProducts[0]?.productName ?? 'None yet';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Main Conversational Column */}
      <section
        aria-label="AI Business Assistant chat"
        className="flex min-h-[620px] flex-col rounded-xl border border-slate-200 bg-white lg:col-span-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Business Performance Advisor</h2>
            <p className="text-xs text-slate-500">
              Analyses {state.settings.businessName}&apos;s actual Cloud Firestore sales, expenses, and stock records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                sendRequest(
                  'Generate my weekly business summary for the last 7 days.',
                  'weekly_summary'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-900 disabled:opacity-50 whitespace-nowrap"
            >
              <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
              Weekly Summary
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                sendRequest(
                  'Generate my monthly business summary for this month.',
                  'monthly_summary'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-900 disabled:opacity-50 whitespace-nowrap"
            >
              <FileBarChart2 className="h-3.5 w-3.5 text-emerald-600" />
              Monthly Summary
            </button>
            <button
              type="button"
              onClick={handleResetChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New thread
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5" data-testid="assistant-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-600">
                  {msg.role === 'user' ? state.settings.ownerName : 'VendorPilot AI'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px]">{msg.timestamp}</span>
              </div>

              {msg.role === 'user' ? (
                <div className="max-w-[85%] rounded-xl bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white">
                  {msg.content}
                </div>
              ) : msg.isError ? (
                <div
                  role="alert"
                  className="flex max-w-[90%] flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span>{msg.content}</span>
                  </div>
                  {lastRequest && !isLoading && (
                    <button
                      type="button"
                      onClick={() => sendRequest(lastRequest.question, lastRequest.reportType)}
                      className="shrink-0 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-w-[92%] rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 text-sm">
                  {renderFormattedText(msg.content)}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start">
              <span className="mb-1 text-xs font-medium text-slate-500">VendorPilot AI</span>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Reading your Firestore records and calculating figures...
              </div>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Starter Prompts */}
        <div className="border-t border-slate-100 px-6 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Example questions</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isLoading}
                onClick={() => sendRequest(prompt, 'chat')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-900 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {usageNotice && (
          <div className="border-t border-amber-100 bg-amber-50/70 px-6 py-2 text-xs text-amber-800">
            {usageNotice}
          </div>
        )}

        {/* Prompt Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendRequest(input, 'chat');
          }}
          className="flex items-center gap-3 border-t border-slate-200 p-4 sm:px-6"
        >
          <label htmlFor="assistant-prompt-input" className="sr-only">
            Ask VendorPilot AI a question about your business
          </label>
          <input
            id="assistant-prompt-input"
            type="text"
            maxLength={1500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask about revenue, expenses, profit, top products, or restocking..."
            className="h-11 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" />
            <span>Send</span>
          </button>
        </form>
      </section>

      {/* Right Sidebar: Application-Computed Ledger Snapshot */}
      <aside
        aria-label="Verified ledger context"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4 lg:self-start"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Verified Ledger Context</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Calculated directly from your Firestore records before every answer.
            </p>
          </div>
        </div>

        {/* Period Switcher */}
        <div
          role="group"
          aria-label="Ledger summary timeframe"
          className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium"
        >
          <button
            type="button"
            onClick={() => setContextPeriod('month')}
            className={`rounded-md py-1.5 transition-colors ${
              contextPeriod === 'month'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setContextPeriod('all')}
            className={`rounded-md py-1.5 transition-colors ${
              contextPeriod === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Time
          </button>
        </div>

        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Revenue</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatNaira(activeRevenue, false, currencySymbol)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Expenses</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatNaira(activeExpenses, false, currencySymbol)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Estimated Net Profit</dt>
            <dd
              className={`font-mono font-semibold tabular-nums ${
                activeProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatNaira(activeProfit, false, currencySymbol)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Recorded Orders</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">{activeOrders}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Outstanding Receivables</dt>
            <dd className="font-mono font-semibold text-amber-700 tabular-nums">
              {formatNaira(metrics.outstandingPayments, false, currencySymbol)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Low-Stock Products</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {metrics.lowStockCount} SKU{metrics.lowStockCount === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Top Product</dt>
            <dd className="max-w-[170px] truncate text-right font-medium text-slate-900">
              {activeTopProduct}
            </dd>
          </div>
        </dl>

        <div className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          Last 7 days: <strong className="font-mono text-slate-700">{formatNaira(report.weeklySummary.revenue, false, currencySymbol)}</strong> revenue across{' '}
          <strong className="font-mono text-slate-700">{report.weeklySummary.orderCount}</strong> order{report.weeklySummary.orderCount === 1 ? '' : 's'}.
        </div>
      </aside>
    </div>
  );
}
