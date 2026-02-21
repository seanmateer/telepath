import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import handler from '../ai.js';

type ErrorPayload = {
  ok: false;
  error: string;
};

const createRequest = (
  body: unknown,
  headers: Record<string, string> = {},
): Request => {
  return new Request('https://telepath.example/api/ai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
};

const toErrorPayload = async (response: Response): Promise<ErrorPayload> => {
  return (await response.json()) as ErrorPayload;
};

describe('/api/ai handler hardening', () => {
  it('rejects disallowed origins', async () => {
    const response = await handler(
      createRequest(
        {
          model: 'claude-3-5-sonnet-latest',
          systemPrompt: 'Return JSON only',
          userPrompt: '{"ok":true}',
        },
        {
          origin: 'https://evil.example',
          'x-forwarded-for': '198.51.100.10',
        },
      ),
    );

    const payload = await toErrorPayload(response);
    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /Origin not allowed/);
  });

  it('rejects unsupported models before upstream calls', async () => {
    const response = await handler(
      createRequest(
        {
          model: 'claude-unknown',
          systemPrompt: 'Return JSON only',
          userPrompt: '{"ok":true}',
        },
        {
          origin: 'http://localhost:5173',
          'x-forwarded-for': '198.51.100.11',
        },
      ),
    );

    const payload = await toErrorPayload(response);
    assert.equal(response.status, 400);
    assert.match(payload.error, /Unsupported model/);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
    );
  });

  it('rate-limits repeated requests per IP/origin', async () => {
    const headers = {
      origin: 'http://localhost:5173',
      'x-forwarded-for': '198.51.100.12',
    };

    const requestBody = {
      model: 'claude-unknown',
      systemPrompt: 'Return JSON only',
      userPrompt: '{"ok":true}',
    };

    let finalResponse: Response | null = null;
    for (let index = 0; index <= 20; index += 1) {
      finalResponse = await handler(createRequest(requestBody, headers));
    }

    assert.ok(finalResponse);
    if (finalResponse) {
      const payload = await toErrorPayload(finalResponse);
      assert.equal(finalResponse.status, 429);
      assert.equal(payload.ok, false);
      assert.match(payload.error, /Rate limit exceeded/);
      const retryAfter = finalResponse.headers.get('retry-after');
      assert.notEqual(retryAfter, null);
      const retryAfterNumber = Number(retryAfter);
      assert.equal(Number.isNaN(retryAfterNumber), false);
      assert.equal(retryAfterNumber >= 1, true);
    }
  });
});
