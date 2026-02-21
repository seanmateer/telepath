export const DEFAULT_ALLOWED_MODELS = [
  'claude-3-5-sonnet-latest',
  'claude-3-5-haiku-latest',
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

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number | null;
};

type SafeUpstreamError = {
  status: number;
  message: string;
};

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

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly maxEntries: number = 5_000,
  ) {}

  allow(key: string, now: number = Date.now()): RateLimitResult {
    this.cleanup(now);

    const existing = this.entries.get(key);

    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.entries.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        retryAfterSeconds: null,
      };
    }

    if (existing.count >= this.maxRequests) {
      const retryAfterMs = Math.max(
        0,
        this.windowMs - (now - existing.windowStart),
      );
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    existing.count += 1;
    this.entries.set(key, existing);

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - existing.count,
      retryAfterSeconds: null,
    };
  }

  private cleanup(now: number): void {
    if (this.entries.size <= this.maxEntries) {
      return;
    }

    for (const [key, value] of this.entries.entries()) {
      if (now - value.windowStart >= this.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}

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
  try {
    const parsed: unknown = JSON.parse(value);
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
