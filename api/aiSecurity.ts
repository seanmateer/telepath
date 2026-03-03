import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  buildClueSystemPrompt,
  buildClueUserPrompt,
  buildDialSystemPrompt,
  buildDialUserPrompt,
  DIAL_MODEL,
  resolveClueModel,
} from '../src/lib/aiPrompts.js';
import type { AIActionRequest } from '../src/types/ai.js';
import type { Personality, SpectrumCard } from '../src/types/game.js';

export const DEFAULT_ALLOWED_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
] as const;

const LOCAL_DEV_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const CLUE_MAX_TOKENS = 220;
const CLUE_TEMPERATURE = 0.75;
const DIAL_MAX_TOKENS = 220;
const DIAL_TEMPERATURE = 0.55;

export const MAX_REQUEST_BODY_BYTES = 12_000;
export const MAX_SPECTRUM_LABEL_LENGTH = 80;
export const MAX_CLUE_LENGTH = 40;
export const MIN_DIAL_POSITION = 0;
export const MAX_DIAL_POSITION = 100;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PreparedAnthropicRequest = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
};

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

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

const PERSONALITIES: readonly Personality[] = ['lumen', 'sage', 'flux'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isOneOf = <T extends string>(
  value: unknown,
  options: readonly T[],
): value is T => {
  return typeof value === 'string' && options.includes(value as T);
};

const normalizeText = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
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

export const isProductionEnvironment = (): boolean => {
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

const validateShortTextField = (
  value: unknown,
  fieldName: string,
  maxLength: number,
): ValidationResult<string> => {
  if (typeof value !== 'string') {
    return {
      ok: false,
      error: `Invalid payload. \`${fieldName}\` must be a string.`,
    };
  }

  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return {
      ok: false,
      error: `Invalid payload. \`${fieldName}\` is required.`,
    };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      error: `Invalid payload. \`${fieldName}\` exceeds ${maxLength} characters.`,
    };
  }

  return {
    ok: true,
    data: normalized,
  };
};

const validateSpectrumCard = (value: unknown): ValidationResult<SpectrumCard> => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. `card` must be an object.' };
  }

  if (
    typeof value.id !== 'number' ||
    !Number.isInteger(value.id) ||
    value.id < 0
  ) {
    return {
      ok: false,
      error: 'Invalid payload. `card.id` must be a non-negative integer.',
    };
  }

  const left = validateShortTextField(
    value.left,
    'card.left',
    MAX_SPECTRUM_LABEL_LENGTH,
  );
  if (!left.ok) {
    return left;
  }

  const right = validateShortTextField(
    value.right,
    'card.right',
    MAX_SPECTRUM_LABEL_LENGTH,
  );
  if (!right.ok) {
    return right;
  }

  return {
    ok: true,
    data: {
      id: value.id,
      left: left.data,
      right: right.data,
    },
  };
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
  options: { includeLocalDevOrigins?: boolean } = {},
): ReadonlySet<string> => {
  const allowedOrigins = new Set<string>();

  if (options.includeLocalDevOrigins ?? true) {
    for (const origin of LOCAL_DEV_ORIGINS) {
      allowedOrigins.add(origin);
    }
  }

  if (envValue && envValue.trim().length > 0) {
    for (const rawOrigin of parseCsv(envValue)) {
      const normalized = normalizeOrigin(rawOrigin);
      if (normalized) {
        allowedOrigins.add(normalized);
      }
    }

    return allowedOrigins;
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
  options: { allowMissingOrigin?: boolean } = {},
): boolean => {
  if (!originHeader) {
    return options.allowMissingOrigin ?? false;
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

export const validateAIActionRequest = (
  value: unknown,
): ValidationResult<AIActionRequest> => {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid payload. Expected a JSON object.' };
  }

  const { action, personality, card } = value;

  if (action !== 'generate-clue' && action !== 'place-dial') {
    return {
      ok: false,
      error:
        'Unsupported action. Allowed actions: generate-clue, place-dial.',
    };
  }

  if (!isOneOf(personality, PERSONALITIES)) {
    return {
      ok: false,
      error: 'Invalid payload. `personality` must be lumen, sage, or flux.',
    };
  }

  const validatedCard = validateSpectrumCard(card);
  if (!validatedCard.ok) {
    return validatedCard;
  }

  if (action === 'generate-clue') {
    const { targetPosition } = value;
    if (
      typeof targetPosition !== 'number' ||
      !Number.isInteger(targetPosition) ||
      targetPosition < MIN_DIAL_POSITION ||
      targetPosition > MAX_DIAL_POSITION
    ) {
      return {
        ok: false,
        error:
          'Invalid payload. `targetPosition` must be an integer between 0 and 100.',
      };
    }

    return {
      ok: true,
      data: {
        action,
        personality,
        card: validatedCard.data,
        targetPosition,
      },
    };
  }

  const clue = validateShortTextField(value.clue, 'clue', MAX_CLUE_LENGTH);
  if (!clue.ok) {
    return clue;
  }

  return {
    ok: true,
    data: {
      action,
      personality,
      card: validatedCard.data,
      clue: clue.data,
    },
  };
};

const resolvePreparedModel = (
  model: string,
  allowedModels: ReadonlySet<string>,
): ValidationResult<string> => {
  if (!allowedModels.has(model)) {
    return {
      ok: false,
      error: `Server model allowlist misconfigured for ${model}.`,
    };
  }

  return { ok: true, data: model };
};

export const buildAnthropicRequest = (
  request: AIActionRequest,
  allowedModels: ReadonlySet<string>,
): ValidationResult<PreparedAnthropicRequest> => {
  if (request.action === 'generate-clue') {
    const model = resolvePreparedModel(resolveClueModel(true), allowedModels);
    if (!model.ok) {
      return model;
    }

    return {
      ok: true,
      data: {
        model: model.data,
        systemPrompt: buildClueSystemPrompt(request.personality),
        userPrompt: buildClueUserPrompt({
          card: request.card,
          targetPosition: request.targetPosition,
        }),
        maxTokens: CLUE_MAX_TOKENS,
        temperature: CLUE_TEMPERATURE,
      },
    };
  }

  const model = resolvePreparedModel(DIAL_MODEL, allowedModels);
  if (!model.ok) {
    return model;
  }

  return {
    ok: true,
    data: {
      model: model.data,
      systemPrompt: buildDialSystemPrompt(request.personality),
      userPrompt: buildDialUserPrompt({
        card: request.card,
        clue: request.clue,
      }),
      maxTokens: DIAL_MAX_TOKENS,
      temperature: DIAL_TEMPERATURE,
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
