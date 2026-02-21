export type Team = 'human' | 'ai';

export type Personality = 'lumen' | 'sage' | 'flux';

export type GamePhase = 'setup';

export type SpectrumCard = {
  left: string;
  right: string;
};

export type GameState = {
  phase: GamePhase;
  humanScore: number;
  aiScore: number;
  activeTeam: Team;
};
