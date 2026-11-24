import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantRequestBody {
  question?: string;
  history?: AssistantHistoryItem[];
  businessContext?: Record<string, unknown>;
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
        model: 'gemini-4-hydrogen',
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

app.post('/api/ai-assistant', async (req, res) => {
  const body = req.body as AssistantRequestBody;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';

  if (!question) {
    return res.status(400).json({ error: 'Please enter a question about your business.' });
  }

  if (question.length > 2000) {
    return res.status(400).json({ error: 'Question is too long. Please keep it under 2,000 characters.' });
  }

  const ai = createGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error:
        'AI Business Assistant requires a configured Gemini API key. Please verify GEMINI_API_KEY in Settings > Secrets.',
    });
  }

  const contextJson = JSON.stringify(body.businessContext ?? {}, null, 2);
  const recentHistory = Array.isArray(body.history)
    ? body.history
        .slice(-6)
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
        .map((item) => `${item.role === 'user' ? 'Business Owner' : 'VendorPilot AI'}: ${item.content}`)
        .join('\n\n')
    : '';

  const systemInstruction = [
    'You are VendorPilot AI, a concise, senior commercial financial and operations advisor built specifically for Nigerian SME owners.',
    'Always ground every figure in the live business snapshot provided below. Format currency in Nigerian Naira using the ₦ symbol with comma separators (for example: ₦485,000).',
    'Be direct, practical, and commercially sharp: lead with the direct answer, cite exact product names, customers, categories, and Naira figures from the data, and give 2-3 concrete next steps tailored to Nigerian SME operations (such as cashflow collection, restocking fast-moving goods, or managing fuel/logistics overhead).',
    'Keep responses crisp (under 220 words unless a detailed breakdown is requested). Use clean short paragraphs or bullet points with **bold** highlights for key numbers. Do not invent transactions or products not present in the snapshot.',
    '',
    'LIVE BUSINESS SNAPSHOT:',
    contextJson,
  ].join('\n');

  const prompt = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nBusiness Owner's new question:\n${question}`
    : question;

  try {
    const answer = await generateWithRetry(ai, prompt, systemInstruction);
    return res.json({ answer });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : 'Unable to reach AI service.';
    console.error('Gemini API error in /api/ai-assistant:', status ?? 'unknown', message);

    if (status === 400 || status === 403 || message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
      return res.status(403).json({
        error:
          'Unable to authenticate with the Gemini API. Please check your API key in Settings > Secrets.',
      });
    }

    if (status === 429 || message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        error:
          'The AI assistant has reached its temporary request quota. Please wait a moment and try again.',
      });
    }

    return res.status(502).json({
      error: 'Unable to generate an AI insight right now. Please try again shortly.',
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VendorPilot AI running at http://localhost:${PORT}`);
  });
}

startServer();
