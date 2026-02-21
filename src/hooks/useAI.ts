import {
  CLUE_MODEL,
  buildClueSystemPrompt,
  buildClueUserPrompt,
} from '../lib/aiPrompts.js';
import type { Personality, SpectrumCard } from '../types/game.js';

type ClueResponse = {
  clue: string;
  reasoning: string;
};

type DialPlacementResponse = {
  position: number;
  reasoning: string;
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

type GenerateClueInput = {
  card: SpectrumCard;
  targetPosition: number;
  personality: Personality;
};

const CLUE_MAX_TOKENS = 220;
const CLUE_TEMPERATURE = 0.75;

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
  };
};

const callAIProxy = async (payload: AIProxyRequest): Promise<unknown> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let parsedPayload: unknown;
  try {
    parsedPayload = await response.json();
  } catch {
    throw new Error('AI proxy response was not valid JSON.');
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

  return parsedPayload.data;
};

export const useAI = () => {
  const generateClue = async (
    input: GenerateClueInput,
  ): Promise<ClueResponse> => {
    try {
      const data = await callAIProxy({
        model: CLUE_MODEL,
        systemPrompt: buildClueSystemPrompt(input.personality),
        userPrompt: buildClueUserPrompt({
          card: input.card,
          targetPosition: input.targetPosition,
        }),
        maxTokens: CLUE_MAX_TOKENS,
        temperature: CLUE_TEMPERATURE,
      });

      if (!isClueResponse(data)) {
        throw new Error('AI clue response failed validation.');
      }

      return {
        clue: normalizeClue(data.clue),
        reasoning: normalizeReasoning(data.reasoning),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown AI error.';
      return createFallbackClueResponse(input, errorMessage);
    }
  };

  const placeDial = async (): Promise<DialPlacementResponse> => {
    return {
      position: 50,
      reasoning:
        'Dial placement fallback used because AI dial integration is not implemented yet.',
    };
  };

  return {
    generateClue,
    placeDial,
  };
};
