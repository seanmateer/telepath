import type {
  BonusDirection,
  GamePhase,
  GameState,
  Personality,
  Round,
  ScoreBreakdown,
  SpectrumCard,
  Team,
} from '../types/game';

export const DEFAULT_POINTS_TO_WIN = 10;
export const MIN_POSITION = 0;
export const MAX_POSITION = 100;

type InitialGameOptions = {
  personality?: Personality;
  pointsToWin?: number;
};

type StartGameOptions = {
  deck: SpectrumCard[];
  startingPsychicTeam?: Team;
  random?: () => number;
};

const assertPhase = (state: GameState, expectedPhase: GamePhase): void => {
  if (state.phase !== expectedPhase) {
    throw new Error(
      `Invalid state transition. Expected "${expectedPhase}", received "${state.phase}".`,
    );
  }
};

const clampPosition = (value: number): number => {
  if (value < MIN_POSITION) {
    return MIN_POSITION;
  }
  if (value > MAX_POSITION) {
    return MAX_POSITION;
  }
  return Math.round(value);
};

const createTargetPosition = (random: () => number): number => {
  return Math.floor(random() * (MAX_POSITION + 1));
};

const drawCard = (
  deck: readonly SpectrumCard[],
): { card: SpectrumCard; remainingDeck: SpectrumCard[] } => {
  const [card, ...remainingDeck] = deck;
  if (!card) {
    throw new Error('Cannot start round without cards in the deck.');
  }

  return { card, remainingDeck };
};

const createRound = (
  card: SpectrumCard,
  targetPosition: number,
  psychicTeam: Team,
  roundNumber: number,
): Round => {
  return {
    roundNumber,
    psychicTeam,
    card,
    targetPosition: clampPosition(targetPosition),
    clue: null,
    guessPosition: null,
    bonusGuess: null,
    result: null,
  };
};

const getActiveRound = (state: GameState): Round => {
  if (!state.round) {
    throw new Error('No active round found.');
  }

  return state.round;
};

const resolveActualDirection = (
  targetPosition: number,
  guessPosition: number,
): 'left' | 'right' | 'center' => {
  if (targetPosition === guessPosition) {
    return 'center';
  }

  return targetPosition < guessPosition ? 'left' : 'right';
};

const createPlaceholderScore = (): ScoreBreakdown => {
  return {
    zone: 'miss',
    basePoints: 0,
    bonusPoints: 0,
    totalPoints: 0,
    bonusCorrect: false,
  };
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
    deck: [],
    discardPile: [],
    round: null,
    scores: {
      human: 0,
      ai: 0,
    },
    winner: null,
  };
};

export const startGame = (
  state: GameState,
  options: StartGameOptions,
): GameState => {
  assertPhase(state, 'setup');

  const random = options.random ?? Math.random;
  const psychicTeam = options.startingPsychicTeam ?? 'human';
  const { card, remainingDeck } = drawCard(options.deck);

  return {
    ...state,
    phase: 'psychic-clue',
    deck: remainingDeck,
    discardPile: [],
    round: createRound(card, createTargetPosition(random), psychicTeam, 1),
    scores: {
      human: 0,
      ai: 0,
    },
    winner: null,
  };
};

export const submitPsychicClue = (state: GameState, clue: string): GameState => {
  assertPhase(state, 'psychic-clue');

  const trimmedClue = clue.trim();
  if (trimmedClue.length === 0) {
    throw new Error('Psychic clue must not be empty.');
  }

  const round = getActiveRound(state);

  return {
    ...state,
    phase: 'human-guess',
    round: {
      ...round,
      clue: trimmedClue,
    },
  };
};

export const submitHumanGuess = (
  state: GameState,
  guessPosition: number,
): GameState => {
  assertPhase(state, 'human-guess');

  const round = getActiveRound(state);

  return {
    ...state,
    phase: 'ai-bonus-guess',
    round: {
      ...round,
      guessPosition: clampPosition(guessPosition),
    },
  };
};

export const submitBonusGuess = (
  state: GameState,
  direction: BonusDirection,
): GameState => {
  assertPhase(state, 'ai-bonus-guess');

  const round = getActiveRound(state);

  return {
    ...state,
    phase: 'reveal',
    round: {
      ...round,
      bonusGuess: {
        team: round.psychicTeam === 'human' ? 'ai' : 'human',
        direction,
      },
    },
  };
};

export const revealRound = (state: GameState): GameState => {
  assertPhase(state, 'reveal');

  const round = getActiveRound(state);
  if (round.guessPosition === null) {
    throw new Error('Cannot reveal round before a guess is submitted.');
  }

  const actualDirection = resolveActualDirection(
    round.targetPosition,
    round.guessPosition,
  );

  return {
    ...state,
    phase: 'score',
    round: {
      ...round,
      result: {
        actualDirection,
        scoringTeam: round.psychicTeam,
        pointsAwarded: 0,
        score: createPlaceholderScore(),
      },
    },
  };
};

export const scoreRound = (state: GameState): GameState => {
  assertPhase(state, 'score');

  const round = getActiveRound(state);
  if (!round.result) {
    throw new Error('Cannot score round before reveal.');
  }

  return {
    ...state,
    phase: 'next-round',
    round: {
      ...round,
      result: {
        ...round.result,
        pointsAwarded: 0,
        score: createPlaceholderScore(),
      },
    },
  };
};

export const startNextRound = (
  state: GameState,
  random: () => number = Math.random,
): GameState => {
  assertPhase(state, 'next-round');

  const previousRound = getActiveRound(state);
  const { card, remainingDeck } = drawCard(state.deck);

  return {
    ...state,
    phase: 'psychic-clue',
    deck: remainingDeck,
    discardPile: [...state.discardPile, previousRound.card],
    round: createRound(
      card,
      createTargetPosition(random),
      previousRound.psychicTeam,
      previousRound.roundNumber + 1,
    ),
  };
};
