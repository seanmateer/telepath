import Anthropic from '@anthropic-ai/sdk';
import {
  InMemoryRateLimiter,
  MAX_REQUEST_BODY_BYTES,
  buildAllowedModels,
  buildAllowedOrigins,
  createCorsHeaders,
  isOriginAllowed,
  parseJsonPayload,
  sanitizeUpstreamError,
  validateAIRequestBody,
  type JsonValue,
} from './aiSecurity.js';

export const config = { runtime: 'edge' };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

type SuccessResponse = {
  ok: true;
  data: JsonValue;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

type ErrorResponse = {
  ok: false;
  error: string;
};

type GlobalRateLimitStore = typeof globalThis & {
  __telepathRateLimiter?: InMemoryRateLimiter;
};

const getRateLimiter = (): InMemoryRateLimiter => {
  const store = globalThis as GlobalRateLimitStore;

  if (!store.__telepathRateLimiter) {
    store.__telepathRateLimiter = new InMemoryRateLimiter(
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_REQUESTS,
    );
  }

  return store.__telepathRateLimiter;
};

const createJsonResponse = (
  body: SuccessResponse | ErrorResponse,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  });
};

const extractClientIp = (req: Request): string => {
  const candidates = [
    req.headers.get('x-vercel-forwarded-for'),
    req.headers.get('x-forwarded-for'),
    req.headers.get('x-real-ip'),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const [firstIp] = candidate.split(',');
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  return 'unknown';
};

const getTextResponse = (message: Anthropic.Messages.Message): string => {
  const parts = message.content
    .filter(
      (block): block is Anthropic.TextBlock =>
        block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text.trim())
    .filter((text) => text.length > 0);

  return parts.join('\n').trim();
};

const toBodyByteLength = (value: string): number => {
  return new TextEncoder().encode(value).byteLength;
};

const getRateLimitHeaders = (
  limit: number,
  remaining: number,
): Record<string, string> => {
  return {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(remaining),
  };
};

export default async function handler(req: Request): Promise<Response> {
  const originHeader = req.headers.get('origin');
  const allowedOrigins = buildAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    req.headers.get('host'),
  );
  const corsHeaders = createCorsHeaders(originHeader, allowedOrigins);

  if (!isOriginAllowed(originHeader, allowedOrigins)) {
    return createJsonResponse(
      { ok: false, error: 'Origin not allowed.' },
      403,
      corsHeaders,
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return createJsonResponse(
      { ok: false, error: 'Method not allowed. Use POST.' },
      405,
      corsHeaders,
    );
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return createJsonResponse(
      { ok: false, error: 'Unsupported media type. Use application/json.' },
      415,
      corsHeaders,
    );
  }

  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (
      !Number.isNaN(contentLength) &&
      Number.isFinite(contentLength) &&
      contentLength > MAX_REQUEST_BODY_BYTES
    ) {
      return createJsonResponse(
        { ok: false, error: 'Request body is too large.' },
        413,
        corsHeaders,
      );
    }
  }

  const rateLimiter = getRateLimiter();
  const clientIp = extractClientIp(req);
  const rateLimitKey = `${clientIp}|${originHeader ?? 'no-origin'}`;
  const rateLimitResult = rateLimiter.allow(rateLimitKey);
  const rateLimitHeaders = getRateLimitHeaders(
    rateLimitResult.limit,
    rateLimitResult.remaining,
  );

  if (!rateLimitResult.allowed) {
    return createJsonResponse(
      { ok: false, error: 'Rate limit exceeded. Please try again soon.' },
      429,
      corsHeaders,
      {
        ...rateLimitHeaders,
        'retry-after': String(rateLimitResult.retryAfterSeconds ?? 1),
      },
    );
  }

  let rawRequestBody = '';
  try {
    rawRequestBody = await req.text();
  } catch {
    return createJsonResponse(
      { ok: false, error: 'Invalid request body.' },
      400,
      corsHeaders,
      rateLimitHeaders,
    );
  }

  if (rawRequestBody.trim().length === 0) {
    return createJsonResponse(
      { ok: false, error: 'Request body cannot be empty.' },
      400,
      corsHeaders,
      rateLimitHeaders,
    );
  }

  if (toBodyByteLength(rawRequestBody) > MAX_REQUEST_BODY_BYTES) {
    return createJsonResponse(
      { ok: false, error: 'Request body is too large.' },
      413,
      corsHeaders,
      rateLimitHeaders,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawRequestBody);
  } catch {
    return createJsonResponse(
      { ok: false, error: 'Invalid JSON request body.' },
      400,
      corsHeaders,
      rateLimitHeaders,
    );
  }

  const allowedModels = buildAllowedModels(process.env.ALLOWED_ANTHROPIC_MODELS);
  const validation = validateAIRequestBody(parsedBody, allowedModels);
  if (!validation.ok) {
    return createJsonResponse(
      { ok: false, error: validation.error },
      400,
      corsHeaders,
      rateLimitHeaders,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createJsonResponse(
      { ok: false, error: 'Server missing ANTHROPIC_API_KEY.' },
      500,
      corsHeaders,
      rateLimitHeaders,
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: validation.data.model,
      system: validation.data.systemPrompt,
      max_tokens: validation.data.maxTokens,
      temperature: validation.data.temperature,
      messages: [{ role: 'user', content: validation.data.userPrompt }],
    });

    const rawText = getTextResponse(message);
    if (rawText.length === 0) {
      return createJsonResponse(
        { ok: false, error: 'Model returned an empty response.' },
        502,
        corsHeaders,
        rateLimitHeaders,
      );
    }

    const parsedJson = parseJsonPayload(rawText);
    if (!parsedJson) {
      return createJsonResponse(
        { ok: false, error: 'Model response was not valid JSON.' },
        502,
        corsHeaders,
        rateLimitHeaders,
      );
    }

    return createJsonResponse(
      {
        ok: true,
        data: parsedJson,
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      },
      200,
      corsHeaders,
      rateLimitHeaders,
    );
  } catch (error: unknown) {
    const safeError = sanitizeUpstreamError(error);
    console.error('Anthropic API request failed', {
      status: safeError.status,
      name: error instanceof Error ? error.name : 'unknown',
    });
    return createJsonResponse(
      { ok: false, error: safeError.message },
      safeError.status,
      corsHeaders,
      rateLimitHeaders,
    );
  }
}
