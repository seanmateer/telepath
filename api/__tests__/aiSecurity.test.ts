import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_ALLOWED_MODELS,
  MAX_CLUE_LENGTH,
  MAX_SPECTRUM_LABEL_LENGTH,
  buildAllowedModels,
  buildAllowedOrigins,
  buildAnthropicRequest,
  createRateLimiter,
  isOriginAllowed,
  parseJsonPayload,
  resetRateLimiterForTests,
  sanitizeUpstreamError,
  toRateLimitResult,
  validateAIActionRequest,
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
      'claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001',
    );
    assert.equal(models.has('claude-sonnet-4-5-20250929'), true);
    assert.equal(models.has('claude-haiku-4-5-20251001'), true);
  });
});

describe('buildAllowedOrigins + isOriginAllowed', () => {
  it('always includes localhost dev origins', () => {
    const origins = buildAllowedOrigins(undefined, null);
    assert.equal(origins.has('http://localhost:5173'), true);
    assert.equal(origins.has('http://127.0.0.1:5173'), true);
  });

  it('adds host-derived origin only when ALLOWED_ORIGINS is unset', () => {
    const origins = buildAllowedOrigins(undefined, 'telepath.example');
    assert.equal(origins.has('https://telepath.example'), true);
    assert.equal(isOriginAllowed('https://telepath.example', origins), true);
    assert.equal(isOriginAllowed('https://evil.example', origins), false);
  });

  it('does not auto-trust host when ALLOWED_ORIGINS is explicitly configured', () => {
    const origins = buildAllowedOrigins(
      'https://app.telepath.example',
      'preview.telepath.example',
    );

    assert.equal(origins.has('https://app.telepath.example'), true);
    assert.equal(origins.has('https://preview.telepath.example'), false);
    assert.equal(
      isOriginAllowed('https://preview.telepath.example', origins),
      false,
    );
  });

  it('can reject missing origins when a caller requires strict origin presence', () => {
    const origins = buildAllowedOrigins('https://app.telepath.example', null);
    assert.equal(isOriginAllowed(null, origins), false);
    assert.equal(
      isOriginAllowed(null, origins, { allowMissingOrigin: true }),
      true,
    );
  });
});

describe('validateAIActionRequest', () => {
  it('accepts valid generate-clue payloads', () => {
    const result = validateAIActionRequest({
      action: 'generate-clue',
      personality: 'sage',
      card: { id: 7, left: 'Rare', right: 'Common' },
      targetPosition: 19,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.action, 'generate-clue');
      assert.equal(result.data.targetPosition, 19);
    }
  });

  it('accepts valid place-dial payloads and normalizes clue whitespace', () => {
    const result = validateAIActionRequest({
      action: 'place-dial',
      personality: 'lumen',
      card: { id: 11, left: 'Low stakes', right: 'High stakes' },
      clue: '  office    coffee ',
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.action, 'place-dial');
      assert.equal(result.data.clue, 'office coffee');
    }
  });

  it('rejects unsupported actions and legacy prompt-relay payloads', () => {
    const result = validateAIActionRequest({
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: 'Return JSON only',
      userPrompt: '{"ok":true}',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Unsupported action/);
    }
  });

  it('rejects invalid card labels, clue length, and target bounds', () => {
    const badCard = validateAIActionRequest({
      action: 'generate-clue',
      personality: 'sage',
      card: {
        id: 1,
        left: 'L'.repeat(MAX_SPECTRUM_LABEL_LENGTH + 1),
        right: 'Right',
      },
      targetPosition: 10,
    });
    assert.equal(badCard.ok, false);

    const badClue = validateAIActionRequest({
      action: 'place-dial',
      personality: 'flux',
      card: { id: 2, left: 'Quiet', right: 'Loud' },
      clue: 'x'.repeat(MAX_CLUE_LENGTH + 1),
    });
    assert.equal(badClue.ok, false);

    const badTarget = validateAIActionRequest({
      action: 'generate-clue',
      personality: 'lumen',
      card: { id: 3, left: 'Cold', right: 'Hot' },
      targetPosition: 101,
    });
    assert.equal(badTarget.ok, false);
  });
});

describe('buildAnthropicRequest', () => {
  const allowedModels = new Set(DEFAULT_ALLOWED_MODELS);

  it('builds server-side prompts for generate-clue actions', () => {
    const request = validateAIActionRequest({
      action: 'generate-clue',
      personality: 'sage',
      card: { id: 1, left: 'Rare', right: 'Common' },
      targetPosition: 19,
    });

    assert.equal(request.ok, true);
    if (!request.ok) {
      return;
    }

    const prepared = buildAnthropicRequest(request.data, allowedModels);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) {
      return;
    }

    assert.match(prepared.data.model, /claude-/);
    assert.match(prepared.data.systemPrompt, /Return only valid JSON/);
    assert.match(
      prepared.data.userPrompt,
      /Hidden target value on that scale: 19\./,
    );
  });

  it('rejects server-side model selections outside the allowlist', () => {
    const request = validateAIActionRequest({
      action: 'place-dial',
      personality: 'flux',
      card: { id: 2, left: 'Calm', right: 'Chaotic' },
      clue: 'weeknight',
    });

    assert.equal(request.ok, true);
    if (!request.ok) {
      return;
    }

    const prepared = buildAnthropicRequest(
      request.data,
      new Set(['claude-sonnet-4-5-20250929']),
    );
    assert.equal(prepared.ok, false);
    if (!prepared.ok) {
      assert.match(prepared.error, /allowlist misconfigured/i);
    }
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

describe('parseJsonPayload', () => {
  it('parses plain JSON payloads', () => {
    const parsed = parseJsonPayload('{"ok":true}');
    assert.deepEqual(parsed, { ok: true });
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const parsed = parseJsonPayload('```json\n{"ok":true}\n```');
    assert.deepEqual(parsed, { ok: true });
  });

  it('rejects non-JSON content', () => {
    const parsed = parseJsonPayload('not-json');
    assert.equal(parsed, null);
  });
});
