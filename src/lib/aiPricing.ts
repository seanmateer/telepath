export type ModelTokenPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export const MODEL_TOKEN_PRICING: Record<string, ModelTokenPricing> = {
  'claude-sonnet-4-5-20250929': {
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
  },
  'claude-haiku-4-5-20251001': {
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 5,
  },
};

const ONE_MILLION = 1_000_000;

const isValidTokenCount = (value: number): boolean => {
  return Number.isFinite(value) && value >= 0;
};

export const estimateUsageUsd = (
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null => {
  if (!isValidTokenCount(inputTokens) || !isValidTokenCount(outputTokens)) {
    return null;
  }

  const pricing = MODEL_TOKEN_PRICING[model];
  if (!pricing) {
    return null;
  }

  return (
    (inputTokens / ONE_MILLION) * pricing.inputUsdPerMillion +
    (outputTokens / ONE_MILLION) * pricing.outputUsdPerMillion
  );
};
