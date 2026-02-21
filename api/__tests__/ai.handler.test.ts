import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import handler from '../ai.js';
import { resetRateLimiterForTests } from '../aiSecurity.js';

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

const withTemporaryEnv = async (
  overrides: Record<string, string | undefined>,
  callback: () => Promise<void> | void,
): Promise<void> => {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }

  try {
    await callback();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  }
};

describe('/api/ai handler hardening', () => {
  it('rejects disallowed origins', async () => {
    const response = await handler(
      createRequest(
        {
          model: 'claude-sonnet-4-5-20250929',
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

  it('continues normal validation when rate limiting is disabled in local/test', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'test',
        VERCEL_ENV: undefined,
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      async () => {
        resetRateLimiterForTests();
        const response = await handler(
          createRequest(
            {
              model: 'claude-unknown',
              systemPrompt: 'Return JSON only',
              userPrompt: '{"ok":true}',
            },
            {
              origin: 'http://localhost:5173',
              'x-forwarded-for': '198.51.100.12',
            },
          ),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 400);
        assert.match(payload.error, /Unsupported model/);
      },
    );
  });

  it('returns 500 in production when Upstash env vars are missing', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      async () => {
        resetRateLimiterForTests();
        const response = await handler(
          createRequest(
            {
              model: 'claude-sonnet-4-5-20250929',
              systemPrompt: 'Return JSON only',
              userPrompt: '{"ok":true}',
            },
            {
              origin: 'http://localhost:5173',
              'x-forwarded-for': '198.51.100.13',
            },
          ),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 500);
        assert.match(payload.error, /rate limiter is not configured/i);
      },
    );
  });
});
