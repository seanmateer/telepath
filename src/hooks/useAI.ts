type UnimplementedAIError = {
  error: string;
};

const notImplementedMessage =
  'AI calls are not wired yet. Use /api/ai.ts in Phase 2 integration.';

export const useAI = () => {
  const generateClue = async (): Promise<UnimplementedAIError> => {
    return { error: notImplementedMessage };
  };

  const placeDial = async (): Promise<UnimplementedAIError> => {
    return { error: notImplementedMessage };
  };

  return {
    generateClue,
    placeDial,
  };
};
