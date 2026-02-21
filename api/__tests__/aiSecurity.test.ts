import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_ALLOWED_MODELS,
  DEFAULT_TEMPERATURE,
  MAX_OUTPUT_TOKENS,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_USER_PROMPT_LENGTH,
  buildAllowedModels,
  buildAllowedOrigins,
  createRateLimiter,
  isOriginAllowed,
  resetRateLimiterForTests,
  sanitizeUpstreamError,
  toRateLimitResult,
  validateAIRequestBody,
} from '../aiSecurity.js';

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

describe('buildAllowedModels', () => {
  it('falls back to default allowed models when env var is empty', () => {
    const models = buildAllowedModels(undefined);
    assert.deepEqual(Array.from(models), Array.from(DEFAULT_ALLOWED_MODELS));
  });

  it('parses comma-separated custom models', () => {
    const models = buildAllowedModels(
      'claude-3-5-sonnet-latest, claude-3-5-haiku-latest',
    );
    assert.equal(models.has('claude-3-5-sonnet-latest'), true);
    assert.equal(models.has('claude-3-5-haiku-latest'), true);
  });
});

describe('buildAllowedOrigins + isOriginAllowed', () => {
  it('always includes localhost dev origins', () => {
    const origins = buildAllowedOrigins(undefined, null);
    assert.equal(origins.has('http://localhost:5173'), true);
    assert.equal(origins.has('http://127.0.0.1:5173'), true);
  });

  it('adds host-derived origin and validates membership', () => {
    const origins = buildAllowedOrigins(undefined, 'telepath.example');
    assert.equal(origins.has('https://telepath.example'), true);
    assert.equal(isOriginAllowed('https://telepath.example', origins), true);
    assert.equal(isOriginAllowed('https://evil.example', origins), false);
  });
});

describe('validateAIRequestBody', () => {
  const allowedModels = new Set(DEFAULT_ALLOWED_MODELS);

  it('accepts valid payloads and assigns defaults', () => {
    const result = validateAIRequestBody(
      {
        model: 'claude-3-5-sonnet-latest',
        systemPrompt: 'You are a strict JSON API.',
        userPrompt: 'Return {"ok":true}',
      },
      allowedModels,
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.maxTokens, 250);
      assert.equal(result.data.temperature, DEFAULT_TEMPERATURE);
    }
  });

  it('rejects unsupported models', () => {
    const result = validateAIRequestBody(
      {
        model: 'claude-unknown',
        systemPrompt: 'a',
        userPrompt: 'b',
      },
      allowedModels,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Unsupported model/);
    }
  });

  it('rejects over-limit prompt lengths and maxTokens', () => {
    const tooLongSystem = 'a'.repeat(MAX_SYSTEM_PROMPT_LENGTH + 1);
    const tooLongUser = 'b'.repeat(MAX_USER_PROMPT_LENGTH + 1);

    const systemResult = validateAIRequestBody(
      {
        model: 'claude-3-5-sonnet-latest',
        systemPrompt: tooLongSystem,
        userPrompt: 'ok',
      },
      allowedModels,
    );
    assert.equal(systemResult.ok, false);

    const userResult = validateAIRequestBody(
      {
        model: 'claude-3-5-sonnet-latest',
        systemPrompt: 'ok',
        userPrompt: tooLongUser,
      },
      allowedModels,
    );
    assert.equal(userResult.ok, false);

    const tokenResult = validateAIRequestBody(
      {
        model: 'claude-3-5-sonnet-latest',
        systemPrompt: 'ok',
        userPrompt: 'ok',
        maxTokens: MAX_OUTPUT_TOKENS + 1,
      },
      allowedModels,
    );
    assert.equal(tokenResult.ok, false);
  });
});

describe('createRateLimiter + toRateLimitResult', () => {
  it('disables rate limiting in non-production when Upstash env vars are missing', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'test',
        VERCEL_ENV: undefined,
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      () => {
        resetRateLimiterForTests();
        const limiter = createRateLimiter(1_000, 2);
        assert.equal(limiter, null);
      },
    );
  });

  it('throws on missing Upstash env vars in production', async () => {
    await withTemporaryEnv(
      {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      () => {
        resetRateLimiterForTests();
        assert.throws(
          () => createRateLimiter(1_000, 2),
          /Rate limiting misconfigured/,
        );
      },
    );
  });

  it('maps Upstash deny responses to retry-after seconds', () => {
    const blocked = toRateLimitResult(
      {
        success: false,
        limit: 20,
        remaining: 0,
        reset: 2_500,
      } as Parameters<typeof toRateLimitResult>[0],
      1_000,
    );

    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 2);
  });
});

describe('sanitizeUpstreamError', () => {
  it('maps known upstream statuses to safe client errors', () => {
    assert.equal(sanitizeUpstreamError({ status: 429 }).status, 429);
    assert.equal(sanitizeUpstreamError({ status: 401 }).status, 502);
    assert.equal(sanitizeUpstreamError({ status: 529 }).status, 503);
    assert.equal(sanitizeUpstreamError(new Error('boom')).status, 502);
  });
});
