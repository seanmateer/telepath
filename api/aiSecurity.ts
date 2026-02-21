import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const DEFAULT_ALLOWED_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
] as const;

const LOCAL_DEV_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export const DEFAULT_MAX_TOKENS = 250;
export const DEFAULT_TEMPERATURE = 0.7;

export const MAX_REQUEST_BODY_BYTES = 12_000;
export const MAX_SYSTEM_PROMPT_LENGTH = 2_000;
export const MAX_USER_PROMPT_LENGTH = 4_000;
export const MAX_OUTPUT_TOKENS = 800;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 1;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ValidatedAIRequestBody = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
};

type ValidationSuccess = {
  ok: true;
  data: ValidatedAIRequestBody;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number | null;
};

type UpstashRateLimitResponse = Awaited<ReturnType<Ratelimit['limit']>>;

type SafeUpstreamError = {
  status: number;
  message: string;
};

let cachedRateLimiter: Ratelimit | null = null;
let hasWarnedMissingRateLimiterConfig = false;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeOrigin = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const parseCsv = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const getOriginFromHost = (hostHeader: string | null): string | null => {
  if (!hostHeader) {
    return null;
  }

  const host = hostHeader.trim();
  if (host.length === 0 || host.includes('/')) {
    return null;
  }

  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return normalizeOrigin(`http://${host}`);
  }

  return normalizeOrigin(`https://${host}`);
};

const getUpstreamStatus = (error: unknown): number | null => {
  if (!isRecord(error)) {
    return null;
  }

  const { status } = error;
  if (typeof status !== 'number' || Number.isNaN(status)) {
    return null;
  }

  return status;
};

const isProductionEnvironment = (): boolean => {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
};

const hasUpstashRateLimiterEnv = (): boolean => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  return Boolean(redisUrl?.trim() && redisToken?.trim());
};

export const createRateLimiter = (
  windowMs: number,
  maxRequests: number,
): Ratelimit | null => {
  if (cachedRateLimiter) {
    return cachedRateLimiter;
  }

  if (!hasUpstashRateLimiterEnv()) {
    if (isProductionEnvironment()) {
      throw new Error(
        'Rate limiting misconfigured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
      );
    }

    if (!hasWarnedMissingRateLimiterConfig) {
      hasWarnedMissingRateLimiterConfig = true;
      console.warn(
        'Rate limiting disabled: missing UPSTASH_REDIS_REST_URL and/or UPSTASH_REDIS_REST_TOKEN.',
      );
    }

    return null;
  }

  cachedRateLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
    prefix: 'telepath',
  });

  return cachedRateLimiter;
};

export const toRateLimitResult = (
  response: UpstashRateLimitResponse,
  nowMs: number = Date.now(),
): RateLimitResult => {
  if (response.success) {
    return {
      allowed: true,
      limit: response.limit,
      remaining: response.remaining,
      retryAfterSeconds: null,
    };
  }

  return {
    allowed: false,
    limit: response.limit,
    remaining: response.remaining,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(Math.max(0, response.reset - nowMs) / 1000),
    ),
  };
};

export const resetRateLimiterForTests = (): void => {
  cachedRateLimiter = null;
  hasWarnedMissingRateLimiterConfig = false;
};

export const buildAllowedModels = (
  envValue: string | undefined,
): ReadonlySet<string> => {
  const parsedModels =
    envValue && envValue.trim().length > 0
      ? parseCsv(envValue).filter((model) => model.startsWith('claude-'))
      : [];

  if (parsedModels.length > 0) {
    return new Set(parsedModels);
  }

  return new Set(DEFAULT_ALLOWED_MODELS);
};

export const buildAllowedOrigins = (
  envValue: string | undefined,
  hostHeader: string | null,
): ReadonlySet<string> => {
  const allowedOrigins = new Set<string>(LOCAL_DEV_ORIGINS);

  if (envValue && envValue.trim().length > 0) {
    for (const rawOrigin of parseCsv(envValue)) {
      const normalized = normalizeOrigin(rawOrigin);
      if (normalized) {
        allowedOrigins.add(normalized);
      }
    }
  }

  const hostOrigin = getOriginFromHost(hostHeader);
  if (hostOrigin) {
    allowedOrigins.add(hostOrigin);
  }

  return allowedOrigins;
};

export const isOriginAllowed = (
  originHeader: string | null,
  allowedOrigins: ReadonlySet<string>,
): boolean => {
  if (!originHeader) {
    return true;
  }

  const origin = normalizeOrigin(originHeader);
  if (!origin) {
    return false;
  }

  return allowedOrigins.has(origin);
};

export const createCorsHeaders = (
  originHeader: string | null,
  allowedOrigins: ReadonlySet<string>,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };

  if (!originHeader) {
    return headers;
  }

  const normalizedOrigin = normalizeOrigin(originHeader);
  if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
    headers['access-control-allow-origin'] = normalizedOrigin;
  }

  return headers;
};

export const validateAIRequestBody = (
  value: unknown,
  allowedModels: ReadonlySet<string>,
): ValidationResult => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. Expected a JSON object.' };
  }

  const { model, systemPrompt, userPrompt, maxTokens, temperature } = value;

  if (typeof model !== 'string' || model.trim().length === 0) {
    return { ok: false, error: 'Invalid payload. `model` is required.' };
  }

  if (!allowedModels.has(model)) {
    return {
      ok: false,
      error: `Unsupported model. Allowed models: ${Array.from(allowedModels).join(', ')}`,
    };
  }

  if (typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
    return {
      ok: false,
      error: 'Invalid payload. `systemPrompt` is required.',
    };
  }

  if (systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `Invalid payload. \`systemPrompt\` exceeds ${MAX_SYSTEM_PROMPT_LENGTH} characters.`,
    };
  }

  if (typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    return {
      ok: false,
      error: 'Invalid payload. `userPrompt` is required.',
    };
  }

  if (userPrompt.length > MAX_USER_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `Invalid payload. \`userPrompt\` exceeds ${MAX_USER_PROMPT_LENGTH} characters.`,
    };
  }

  let safeMaxTokens = DEFAULT_MAX_TOKENS;
  if (maxTokens !== undefined) {
    if (
      typeof maxTokens !== 'number' ||
      !Number.isInteger(maxTokens) ||
      maxTokens <= 0 ||
      maxTokens > MAX_OUTPUT_TOKENS
    ) {
      return {
        ok: false,
        error: `Invalid payload. \`maxTokens\` must be an integer between 1 and ${MAX_OUTPUT_TOKENS}.`,
      };
    }

    safeMaxTokens = maxTokens;
  }

  let safeTemperature = DEFAULT_TEMPERATURE;
  if (temperature !== undefined) {
    if (
      typeof temperature !== 'number' ||
      Number.isNaN(temperature) ||
      temperature < MIN_TEMPERATURE ||
      temperature > MAX_TEMPERATURE
    ) {
      return {
        ok: false,
        error: `Invalid payload. \`temperature\` must be between ${MIN_TEMPERATURE} and ${MAX_TEMPERATURE}.`,
      };
    }

    safeTemperature = temperature;
  }

  return {
    ok: true,
    data: {
      model,
      systemPrompt,
      userPrompt,
      maxTokens: safeMaxTokens,
      temperature: safeTemperature,
    },
  };
};

export const isJsonValue = (value: unknown): value is JsonValue => {
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

export const parseJsonPayload = (value: string): JsonValue | null => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonCandidate = fencedMatch ? fencedMatch[1] : trimmed;

  try {
    const parsed: unknown = JSON.parse(jsonCandidate);
    return isJsonValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const sanitizeUpstreamError = (error: unknown): SafeUpstreamError => {
  const status = getUpstreamStatus(error);

  if (status === 429) {
    return {
      status: 429,
      message: 'AI provider rate limit hit. Please retry shortly.',
    };
  }

  if (status === 408 || status === 504) {
    return {
      status: 504,
      message: 'AI provider request timed out.',
    };
  }

  if (status === 400) {
    return {
      status: 502,
      message: 'AI provider rejected the request.',
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 502,
      message: 'AI provider authentication failed.',
    };
  }

  if (status === 500 || status === 502 || status === 503 || status === 529) {
    return {
      status: 503,
      message: 'AI provider is temporarily unavailable.',
    };
  }

  return {
    status: 502,
    message: 'AI provider request failed.',
  };
};
