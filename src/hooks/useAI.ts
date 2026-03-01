import {
  buildClueSystemPrompt,
  buildClueUserPrompt,
  buildDialSystemPrompt,
  buildDialUserPrompt,
  DIAL_MODEL,
  resolveClueModel,
} from '../lib/aiPrompts.js';
import type { Personality, SpectrumCard } from '../types/game.js';
import type { AIUsageSample } from '../types/playtest.js';

type ClueResponse = {
  clue: string;
  reasoning: string;
  usage: AIUsageSample | null;
};

type DialPlacementResponse = {
  position: number;
  reasoning: string;
  usage: AIUsageSample | null;
};

type AIProxyRequest = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

type AIProxySuccessPayload = {
  ok: true;
  data: unknown;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

type AIProxyErrorPayload = {
  ok: false;
  error: string;
};

type AIProxyPayload = AIProxySuccessPayload | AIProxyErrorPayload;

type AIProxyResult = {
  data: unknown;
  usage: AIUsageSample;
};

type GenerateClueInput = {
  card: SpectrumCard;
  targetPosition: number;
  personality: Personality;
};

type PlaceDialInput = {
  card: SpectrumCard;
  clue: string;
  personality: Personality;
};

type UseAIOptions = {
  useHaikuOnlyClues?: boolean;
};

const CLUE_MAX_TOKENS = 220;
const CLUE_TEMPERATURE = 0.75;
const DIAL_MAX_TOKENS = 220;
const DIAL_TEMPERATURE = 0.55;
const DIAL_MIN_POSITION = 0;
const DIAL_MAX_POSITION = 100;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isAIProxyPayload = (value: unknown): value is AIProxyPayload => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return (
      'data' in value &&
      typeof value.model === 'string' &&
      isRecord(value.usage) &&
      typeof value.usage.inputTokens === 'number' &&
      typeof value.usage.outputTokens === 'number'
    );
  }

  return typeof value.error === 'string';
};

const isClueResponse = (value: unknown): value is ClueResponse => {
  return (
    isRecord(value) &&
    typeof value.clue === 'string' &&
    value.clue.trim().length > 0 &&
    typeof value.reasoning === 'string' &&
    value.reasoning.trim().length > 0
  );
};

const isDialPlacementResponse = (
  value: unknown,
): value is DialPlacementResponse => {
  return (
    isRecord(value) &&
    typeof value.position === 'number' &&
    Number.isFinite(value.position) &&
    typeof value.reasoning === 'string' &&
    value.reasoning.trim().length > 0
  );
};

const clampDialPosition = (position: number): number => {
  if (position < DIAL_MIN_POSITION) {
    return DIAL_MIN_POSITION;
  }
  if (position > DIAL_MAX_POSITION) {
    return DIAL_MAX_POSITION;
  }
  return Math.round(position);
};

const normalizeClue = (clue: string): string => {
  const words = clue
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return 'Balanced';
  }

  return words.slice(0, 3).join(' ');
};

const normalizeReasoning = (reasoning: string): string => {
  const trimmed = reasoning.trim();
  return trimmed.length > 0 ? trimmed : 'Reasoning unavailable.';
};

const getFallbackClue = (targetPosition: number): string => {
  if (targetPosition <= 20) {
    return 'Far left';
  }
  if (targetPosition <= 40) {
    return 'Left leaning';
  }
  if (targetPosition <= 60) {
    return 'Middle ground';
  }
  if (targetPosition <= 80) {
    return 'Right leaning';
  }
  return 'Far right';
};

const createFallbackClueResponse = (
  input: GenerateClueInput,
  errorMessage: string,
): ClueResponse => {
  return {
    clue: getFallbackClue(input.targetPosition),
    reasoning: `Fallback clue used because AI request failed: ${errorMessage}`,
    usage: null,
  };
};

const createFallbackDialPlacement = (
  input: PlaceDialInput,
  errorMessage: string,
): DialPlacementResponse => {
  const lowerClue = input.clue.toLowerCase();

  const leftSignals = ['left', 'low', 'cold', 'soft', 'small'];
  const rightSignals = ['right', 'high', 'hot', 'hard', 'large'];

  const hasLeftSignal = leftSignals.some((token) => lowerClue.includes(token));
  const hasRightSignal = rightSignals.some((token) => lowerClue.includes(token));

  let fallbackPosition = 50;
  if (hasLeftSignal && !hasRightSignal) {
    fallbackPosition = 30;
  } else if (hasRightSignal && !hasLeftSignal) {
    fallbackPosition = 70;
  }

  return {
    position: fallbackPosition,
    reasoning: `Fallback dial placement used because AI request failed: ${errorMessage}`,
    usage: null,
  };
};

const isLikelyHtml = (value: string): boolean => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.startsWith('<');
};

const toUsageSample = (
  model: string,
  inputTokens: number,
  outputTokens: number,
): AIUsageSample => {
  return {
    model,
    inputTokens,
    outputTokens,
    estimatedUsd: null,
  };
};

const callAIProxy = async (payload: AIProxyRequest): Promise<AIProxyResult> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawPayload = await response.text();
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawPayload);
  } catch {
    if (isLikelyHtml(rawPayload)) {
      throw new Error(
        'AI proxy returned HTML instead of JSON. Local dev should route /api/ai through the server handler.',
      );
    }

    const contentType = response.headers.get('content-type') ?? 'unknown';
    throw new Error(
      `AI proxy response was not valid JSON (HTTP ${response.status}, content-type: ${contentType}).`,
    );
  }

  if (!isAIProxyPayload(parsedPayload)) {
    throw new Error('AI proxy response shape was invalid.');
  }

  if (!response.ok || !parsedPayload.ok) {
    const errorMessage =
      !parsedPayload.ok && parsedPayload.error.trim().length > 0
        ? parsedPayload.error
        : `AI proxy request failed with HTTP ${response.status}.`;
    throw new Error(errorMessage);
  }

  return {
    data: parsedPayload.data,
    usage: toUsageSample(
      parsedPayload.model,
      parsedPayload.usage.inputTokens,
      parsedPayload.usage.outputTokens,
    ),
  };
};

export const useAI = (options: UseAIOptions = {}) => {
  const clueModel = resolveClueModel(options.useHaikuOnlyClues ?? false);

  const generateClue = async (
    input: GenerateClueInput,
  ): Promise<ClueResponse> => {
    try {
      const result = await callAIProxy({
        model: clueModel,
        systemPrompt: buildClueSystemPrompt(input.personality),
        userPrompt: buildClueUserPrompt({
          card: input.card,
          targetPosition: input.targetPosition,
        }),
        maxTokens: CLUE_MAX_TOKENS,
        temperature: CLUE_TEMPERATURE,
      });

      if (!isClueResponse(result.data)) {
        throw new Error('AI clue response failed validation.');
      }

      return {
        clue: normalizeClue(result.data.clue),
        reasoning: normalizeReasoning(result.data.reasoning),
        usage: result.usage,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown AI error.';
      return createFallbackClueResponse(input, errorMessage);
    }
  };

  const placeDial = async (
    input: PlaceDialInput,
  ): Promise<DialPlacementResponse> => {
    try {
      const result = await callAIProxy({
        model: DIAL_MODEL,
        systemPrompt: buildDialSystemPrompt(input.personality),
        userPrompt: buildDialUserPrompt({
          card: input.card,
          clue: input.clue,
        }),
        maxTokens: DIAL_MAX_TOKENS,
        temperature: DIAL_TEMPERATURE,
      });

      if (!isDialPlacementResponse(result.data)) {
        throw new Error('AI dial response failed validation.');
      }

      return {
        position: clampDialPosition(result.data.position),
        reasoning: normalizeReasoning(result.data.reasoning),
        usage: result.usage,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown AI error.';
      return createFallbackDialPlacement(input, errorMessage);
    }
  };

  return {
    generateClue,
    placeDial,
  };
};
