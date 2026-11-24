import test from 'node:test';
import assert from 'node:assert/strict';
import aiAssistantHandler from '../../api/ai-assistant';
import healthHandler from '../../api/health';
import { handleAiAssistantRequest } from './aiAssistantHandler';

function createMockResponse() {
  let statusCode = 200;
  let jsonBody: Record<string, unknown> | null = null;
  const headers: Record<string, string> = {};

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    json(payload: Record<string, unknown>) {
      jsonBody = payload;
    },
  };

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    getHeaders: () => headers,
  };
}

test('handleAiAssistantRequest rejects missing Authorization header with 401', async () => {
  const result = await handleAiAssistantRequest({
    authorizationHeader: undefined,
    body: { question: 'What is my revenue?' },
  });
  assert.equal(result.status, 401);
  assert.equal(typeof result.body.error, 'string');
});

test('Vercel api/ai-assistant rejects non-POST methods with 405 and Allow header', async () => {
  const mock = createMockResponse();
  await aiAssistantHandler({ method: 'GET', headers: {} }, mock.res);
  assert.equal(mock.getStatus(), 405);
  assert.equal(mock.getHeaders().Allow, 'POST');
});

test('Vercel api/ai-assistant rejects unauthenticated POST requests with 401', async () => {
  const mock = createMockResponse();
  await aiAssistantHandler(
    {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ question: 'How much revenue did I make?' }),
    },
    mock.res
  );
  assert.equal(mock.getStatus(), 401);
  assert.equal(typeof mock.getBody()?.error, 'string');
});

test('Vercel api/health returns 200 ok on GET and 405 on POST', () => {
  const getMock = createMockResponse();
  healthHandler({ method: 'GET' }, getMock.res);
  assert.equal(getMock.getStatus(), 200);
  assert.deepEqual(getMock.getBody(), { status: 'ok' });

  const postMock = createMockResponse();
  healthHandler({ method: 'POST' }, postMock.res);
  assert.equal(postMock.getStatus(), 405);
});
