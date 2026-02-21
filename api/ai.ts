import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const DEFAULT_MAX_TOKENS = 250;
const DEFAULT_TEMPERATURE = 0.7;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type AIRequestBody = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

type SuccessResponse = {
  ok: true;
  data: JsonValue;
  rawText: string;
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
  __telepathRateLimitStore?: Map<string, RateLimitEntry>;
};

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const getRateLimitStore = (): Map<string, RateLimitEntry> => {
  const store = globalThis as GlobalRateLimitStore;

  if (!store.__telepathRateLimitStore) {
    store.__telepathRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return store.__telepathRateLimitStore;
};

const createJsonResponse = (
  body: SuccessResponse | ErrorResponse,
  status: number,
): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  });
};

const extractClientIp = (req: Request): string => {
  const forwardedFor = req.headers.get('x-forwarded-for');

  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(',');
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return 'unknown';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isValidRequestBody = (value: unknown): value is AIRequestBody => {
  if (!isRecord(value)) {
    return false;
  }

  const { model, systemPrompt, userPrompt, maxTokens, temperature } = value;

  if (
    typeof model !== 'string' ||
    model.trim().length === 0 ||
    typeof systemPrompt !== 'string' ||
    systemPrompt.trim().length === 0 ||
    typeof userPrompt !== 'string' ||
    userPrompt.trim().length === 0
  ) {
    return false;
  }

  if (maxTokens !== undefined) {
    if (
      typeof maxTokens !== 'number' ||
      !Number.isInteger(maxTokens) ||
      maxTokens <= 0 ||
      maxTokens > 4096
    ) {
      return false;
    }
  }

  if (temperature !== undefined) {
    if (
      typeof temperature !== 'number' ||
      Number.isNaN(temperature) ||
      temperature < 0 ||
      temperature > 1
    ) {
      return false;
    }
  }

  return true;
};

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
};

const parseJsonPayload = (value: string): JsonValue | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    return isJsonValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const allowRequest = (ip: string): boolean => {
  const store = getRateLimitStore();
  const now = Date.now();
  const existingEntry = store.get(ip);

  if (!existingEntry || now - existingEntry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (existingEntry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  existingEntry.count += 1;
  store.set(ip, existingEntry);
  return true;
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

export default async function handler(req: Request): Promise<Response> {
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
    );
  }

  const clientIp = extractClientIp(req);
  if (!allowRequest(clientIp)) {
    return createJsonResponse(
      { ok: false, error: 'Rate limit exceeded. Please try again soon.' },
      429,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return createJsonResponse(
      { ok: false, error: 'Invalid JSON request body.' },
      400,
    );
  }

  if (!isValidRequestBody(parsedBody)) {
    return createJsonResponse(
      {
        ok: false,
        error:
          'Invalid payload. Required fields: model, systemPrompt, userPrompt.',
      },
      400,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return createJsonResponse(
      { ok: false, error: 'Server missing ANTHROPIC_API_KEY.' },
      500,
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: parsedBody.model,
      system: parsedBody.systemPrompt,
      max_tokens: parsedBody.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: parsedBody.temperature ?? DEFAULT_TEMPERATURE,
      messages: [{ role: 'user', content: parsedBody.userPrompt }],
    });

    const rawText = getTextResponse(message);
    if (rawText.length === 0) {
      return createJsonResponse(
        { ok: false, error: 'Model returned an empty response.' },
        502,
      );
    }

    const parsedJson = parseJsonPayload(rawText);
    if (!parsedJson) {
      return createJsonResponse(
        { ok: false, error: 'Model response was not valid JSON.' },
        502,
      );
    }

    return createJsonResponse(
      {
        ok: true,
        data: parsedJson,
        rawText,
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      },
      200,
    );
  } catch (error: unknown) {
    const fallbackMessage =
      error instanceof Error ? error.message : 'Unknown Anthropic API error.';
    return createJsonResponse({ ok: false, error: fallbackMessage }, 502);
  }
}
