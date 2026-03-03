import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import handler from '../ai.js';
import { resetRateLimiterForTests } from '../aiSecurity.js';

type ErrorPayload = {
  ok: false;
  error: string;
};

const validGenerateClueBody = {
  action: 'generate-clue',
  personality: 'sage',
  card: {
    id: 1,
    left: 'Rare',
    right: 'Common',
  },
  targetPosition: 19,
} as const;

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
      createRequest(validGenerateClueBody, {
        origin: 'https://evil.example',
        'x-forwarded-for': '198.51.100.10',
      }),
    );

    const payload = await toErrorPayload(response);
    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /Origin not allowed/);
  });

  it('rejects missing origins in production', async () => {
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
          createRequest(validGenerateClueBody, {
            'x-forwarded-for': '198.51.100.14',
          }),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 403);
        assert.match(payload.error, /Origin not allowed/);
      },
    );
  });

  it('rejects legacy prompt-relay payloads before upstream calls', async () => {
    const response = await handler(
      createRequest(
        {
          model: 'claude-sonnet-4-5-20250929',
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
    assert.match(payload.error, /Unsupported action/);
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
              action: 'place-dial',
              personality: 'flux',
              card: { id: 2, left: 'Quiet', right: 'Loud' },
              clue: '',
            },
            {
              origin: 'http://localhost:5173',
              'x-forwarded-for': '198.51.100.12',
            },
          ),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 400);
        assert.match(payload.error, /`clue` is required/i);
      },
    );
  });

  it('returns 500 in production when Upstash env vars are missing', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        ALLOWED_ORIGINS: 'https://telepath.example',
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      async () => {
        resetRateLimiterForTests();
        const response = await handler(
          createRequest(validGenerateClueBody, {
            origin: 'https://telepath.example',
            'x-forwarded-for': '198.51.100.13',
          }),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 500);
        assert.match(payload.error, /rate limiter is not configured/i);
      },
    );
  });

  it('treats ALLOWED_ORIGINS as authoritative when configured', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'test',
        VERCEL_ENV: undefined,
        ALLOWED_ORIGINS: 'https://app.telepath.example',
      },
      async () => {
        resetRateLimiterForTests();
        const response = await handler(
          createRequest(validGenerateClueBody, {
            origin: 'https://preview.telepath.example',
            host: 'preview.telepath.example',
            'x-forwarded-for': '198.51.100.15',
          }),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 403);
        assert.match(payload.error, /Origin not allowed/);
      },
    );
  });

  it('does not implicitly allow localhost origins in production', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        ALLOWED_ORIGINS: 'https://app.telepath.example',
      },
      async () => {
        resetRateLimiterForTests();
        const response = await handler(
          createRequest(validGenerateClueBody, {
            origin: 'http://localhost:5173',
            host: 'app.telepath.example',
            'x-forwarded-for': '198.51.100.16',
          }),
        );

        const payload = await toErrorPayload(response);
        assert.equal(response.status, 403);
        assert.match(payload.error, /Origin not allowed/);
      },
    );
  });
});
