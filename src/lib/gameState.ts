import type {
  BonusDirection,
  GamePhase,
  GameState,
  Personality,
  Round,
  ScoreZone,
  ScoreBreakdown,
  SpectrumCard,
  Team,
} from '../types/game';

export const DEFAULT_POINTS_TO_WIN = 10;
export const MIN_POSITION = 0;
export const MAX_POSITION = 100;
export const BULLSEYE_MAX_DISTANCE = 4;
export const ADJACENT_MAX_DISTANCE = 10;
export const OUTER_MAX_DISTANCE = 18;
export const BONUS_POINT_VALUE = 1;

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

export const resolveScoreZone = (distance: number): ScoreZone => {
  if (distance <= BULLSEYE_MAX_DISTANCE) {
    return 'bullseye';
  }
  if (distance <= ADJACENT_MAX_DISTANCE) {
    return 'adjacent';
  }
  if (distance <= OUTER_MAX_DISTANCE) {
    return 'outer';
  }
  return 'miss';
};

export const getBasePointsForZone = (zone: ScoreZone): number => {
  switch (zone) {
    case 'bullseye':
      return 4;
    case 'adjacent':
      return 3;
    case 'outer':
      return 2;
    case 'miss':
      return 0;
    default: {
      const exhaustive: never = zone;
      return exhaustive;
    }
  }
};

export const calculateRoundScore = (round: Round): ScoreBreakdown => {
  if (round.guessPosition === null) {
    throw new Error('Cannot score round without a main guess.');
  }

  const distance = Math.abs(round.targetPosition - round.guessPosition);
  const zone = resolveScoreZone(distance);
  const basePoints = getBasePointsForZone(zone);
  const actualDirection = resolveActualDirection(
    round.targetPosition,
    round.guessPosition,
  );
  const bonusCorrect =
    round.bonusGuess !== null &&
    actualDirection !== 'center' &&
    round.bonusGuess.direction === actualDirection;
  const bonusPoints = bonusCorrect ? BONUS_POINT_VALUE : 0;

  return {
    zone,
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
    bonusCorrect,
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
        scoringPoints: 0,
        bonusTeam: null,
        bonusTeamPoints: 0,
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

  const score = calculateRoundScore(round);
  const scoringTeam = round.psychicTeam;
  const bonusTeam = score.bonusCorrect ? round.bonusGuess?.team ?? null : null;

  const updatedScores = {
    ...state.scores,
    [scoringTeam]: state.scores[scoringTeam] + score.basePoints,
  };

  if (bonusTeam && score.bonusPoints > 0) {
    updatedScores[bonusTeam] += score.bonusPoints;
  }

  return {
    ...state,
    phase: 'next-round',
    scores: updatedScores,
    round: {
      ...round,
      result: {
        ...round.result,
        scoringPoints: score.basePoints,
        bonusTeam,
        bonusTeamPoints: score.bonusPoints,
        score,
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
