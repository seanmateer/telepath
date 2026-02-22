export type Team = 'human' | 'ai';

export type GameMode = 'coop' | 'competitive';

export type Personality = 'lumen' | 'sage' | 'flux';

export type GamePhase =
  | 'setup'
  | 'psychic-clue'
  | 'human-guess'
  | 'ai-bonus-guess'
  | 'reveal'
  | 'score'
  | 'next-round'
  | 'game-over';

export type ScoreZone = 'bullseye' | 'adjacent' | 'outer' | 'miss';

export type BonusDirection = 'left' | 'right';

export type ActualDirection = BonusDirection | 'center';

export type SpectrumCard = {
  id: number;
  left: string;
  right: string;
};

export type SpectrumDeck = {
  version: string;
  pack: string;
  description: string;
  cards: SpectrumCard[];
};

export type BonusGuess = {
  team: Team;
  direction: BonusDirection;
};

export type ScoreBreakdown = {
  zone: ScoreZone;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  bonusCorrect: boolean;
};

export type RoundResult = {
  actualDirection: ActualDirection;
  scoringTeam: Team;
  scoringPoints: number;
  bonusTeam: Team | null;
  bonusTeamPoints: number;
  score: ScoreBreakdown;
  bonusCardDrawn?: boolean;
};

export type Round = {
  roundNumber: number;
  psychicTeam: Team;
  card: SpectrumCard;
  targetPosition: number;
  clue: string | null;
  guessPosition: number | null;
  bonusGuess: BonusGuess | null;
  result: RoundResult | null;
};

export type GameScore = Record<Team, number>;

export type GameSettings = {
  personality: Personality;
  pointsToWin: number;
};

export type GameState = {
  phase: GamePhase;
  mode: GameMode;
  settings: GameSettings;
  deck: SpectrumCard[];
  discardPile: SpectrumCard[];
  round: Round | null;
  scores: GameScore;
  coopScore: number;
  totalCards: number;
  winner: Team | null;
};
