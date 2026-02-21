import type { GameState } from '../types/game';

export const createInitialGameState = (): GameState => {
  return {
    phase: 'setup',
    humanScore: 0,
    aiScore: 0,
    activeTeam: 'human',
  };
};
