import { handleAiAssistantRequest } from '../src/server/aiAssistantHandler';

interface ServerlessRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ServerlessResponse {
  status: (code: number) => ServerlessResponse;
  setHeader: (name: string, value: string) => void;
  json: (payload: Record<string, unknown>) => void;
}

function parseBody(rawBody: unknown): unknown {
  if (typeof rawBody === 'string') {
    if (rawBody.length > 262_144) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }
  return rawBody ?? {};
}

export default async function handler(
  req: ServerlessRequest,
  res: ServerlessResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  let body: unknown;
  try {
    body = parseBody(req.body);
  } catch {
    res.status(413).json({ error: 'Request payload is too large.' });
    return;
  }

  const result = await handleAiAssistantRequest({
    authorizationHeader: req.headers.authorization ?? req.headers.Authorization,
    body,
  });

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
  }

  res.status(result.status).json(result.body);
}
