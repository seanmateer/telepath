import type { GameState, Personality, SpectrumCard } from '../types/game';

export const DEFAULT_POINTS_TO_WIN = 10;

type InitialGameOptions = {
  personality?: Personality;
  deck?: SpectrumCard[];
  pointsToWin?: number;
};

export const createInitialGameState = (
  options: InitialGameOptions = {},
): GameState => {
  return {
    phase: 'setup',
    settings: {
      personality: options.personality ?? 'lumen',
      pointsToWin: options.pointsToWin ?? DEFAULT_POINTS_TO_WIN,
    },
    deck: options.deck ?? [],
    discardPile: [],
    round: null,
    scores: {
      human: 0,
      ai: 0,
    },
    winner: null,
  };
};
