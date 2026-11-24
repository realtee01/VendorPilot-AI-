import React, { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../types/business';
import { useBusiness } from '../context/BusinessContext';
import { formatNaira } from '../utils/analytics';

const STARTER_PROMPTS = [
  'Which products are generating the most revenue and which need restocking urgently?',
  'Summarize my profit margin, top expense categories, and how to improve cashflow.',
  'Which customers currently have outstanding balances I should follow up on?',
  'How does my diesel and logistics overhead compare to my total revenue?',
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
  const { state, metrics, lowStockProducts, topSellingProducts, expenseByCategory } = useBusiness();
  const [input, setInput] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const firstName = state.settings.ownerName.trim().split(' ')[0] || 'there';
  const hasRecords = state.sales.length > 0 || state.expenses.length > 0 || state.products.length > 0;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      timestamp: 'Now',
      content: hasRecords
        ? `Hello ${firstName}. I have reviewed **${state.settings.businessName}**'s current ledger: total revenue stands at **${formatNaira(metrics.totalRevenue)}**, operating expenses are **${formatNaira(metrics.totalExpenses)}**, and net profit is **${formatNaira(metrics.netProfit)}** (${metrics.profitMarginPct}% margin).\n\nYou also have **${formatNaira(metrics.outstandingPayments)}** in outstanding payments and **${metrics.lowStockCount}** inventory items needing restock attention. Ask me anything about your sales, margins, debtors, or stock priorities.`
        : `Hello ${firstName}. Welcome to **${state.settings.businessName}**'s AI Business Assistant. Once you add your first products, sales, or expenses, I will analyse your revenue, margins, debtors, and stock levels in real time—or ask me any business management question now.`,
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const buildBusinessContext = () => ({
    businessName: state.settings.businessName,
    ownerName: state.settings.ownerName,
    location: state.settings.address,
    currencySymbol: state.settings.currencySymbol,
    summary: metrics,
    topProducts: topSellingProducts.map((p) => ({
      productName: p.productName,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
    })),
    lowStockProducts: lowStockProducts.map((p) => ({
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      reorderLevel: p.reorderLevel,
      unitPrice: p.unitPrice,
    })),
    expenseByCategory: expenseByCategory.map((e) => ({
      category: e.category,
      total: e.total,
    })),
    recentSales: state.sales.slice(0, 12).map((s) => ({
      orderNumber: s.orderNumber,
      date: s.date,
      customerName: s.customerName,
      productName: s.productName,
      quantity: s.quantity,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      paymentStatus: s.paymentStatus,
    })),
  });

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

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

    setLastQuestion(trimmed);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: historyForApi,
          businessContext: buildBusinessContext(),
        }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };

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
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        timestamp: 'Now',
        content: `Conversation cleared. Your current ledger shows **${formatNaira(metrics.totalRevenue)}** in revenue, **${formatNaira(metrics.netProfit)}** net profit, and **${metrics.lowStockCount}** low-stock items. What would you like to examine?`,
      },
    ]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Main Conversational Column */}
      <section
        aria-label="AI Business Assistant chat"
        className="flex min-h-[600px] flex-col rounded-xl border border-slate-200 bg-white lg:col-span-8"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Business Performance Advisor</h2>
            <p className="text-xs text-slate-500">
              Grounded in {state.settings.businessName}&apos;s live sales, expenses, and stock records
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetChat}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New thread
          </button>
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
                  {lastQuestion && !isLoading && (
                    <button
                      type="button"
                      onClick={() => sendQuestion(lastQuestion)}
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
                Analysing your sales, expenses, and inventory figures...
              </div>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Starter Prompts */}
        <div className="border-t border-slate-100 px-6 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isLoading}
                onClick={() => sendQuestion(prompt)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-900 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="flex items-center gap-3 border-t border-slate-200 p-4 sm:px-6"
        >
          <label htmlFor="assistant-prompt-input" className="sr-only">
            Ask VendorPilot AI a question about your business
          </label>
          <input
            id="assistant-prompt-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask about revenue trends, unpaid customers, margins, or restocking..."
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

      {/* Right Sidebar: Live Business Snapshot Fed to AI */}
      <aside
        aria-label="Live business context"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4 lg:self-start"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">Live Ledger Context</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Real-time metrics included automatically with every question you ask.
          </p>
        </div>

        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Total Revenue</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatNaira(metrics.totalRevenue)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Total Expenses</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatNaira(metrics.totalExpenses)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Net Profit</dt>
            <dd className="font-mono font-semibold text-emerald-700 tabular-nums">
              {formatNaira(metrics.netProfit)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-slate-500">Outstanding Receivables</dt>
            <dd className="font-mono font-semibold text-amber-700 tabular-nums">
              {formatNaira(metrics.outstandingPayments)}
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
            <dd className="max-w-[180px] truncate text-right font-medium text-slate-900">
              {topSellingProducts[0]?.productName ?? '—'}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
