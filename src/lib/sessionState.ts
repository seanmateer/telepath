import type {
  BonusDirection,
  GameMode,
  GamePhase,
  GameState,
  Personality,
  Round,
  RoundResult,
  ScoreBreakdown,
  ScoreZone,
  SpectrumCard,
  Team,
} from '../types/game.js';

export const APP_SHELL_STORAGE_KEY = 'telepath.appShell.v1';
export const GAME_SESSION_STORAGE_KEY = 'telepath.gameSession.v1';

const SNAPSHOT_VERSION = 1;

export type AppShellScreen = 'mode' | 'setup' | 'game' | 'end';

export type AppShellSnapshot = {
  version: number;
  screen: AppShellScreen;
  gameMode: GameMode;
  personality: Personality;
  endGameState: GameState | null;
};

export type AppShellSnapshotInput = Omit<AppShellSnapshot, 'version'>;

export type GameSessionSnapshot = {
  version: number;
  personality: Personality;
  gameMode: GameMode;
  gameState: GameState;
  dialValue: number;
  aiReasoning: string | null;
  humanClueInput: string;
};

export type GameSessionSnapshotInput = Omit<GameSessionSnapshot, 'version'>;

const APP_SHELL_SCREENS: readonly AppShellScreen[] = [
  'mode',
  'setup',
  'game',
  'end',
];

const GAME_PHASES: readonly GamePhase[] = [
  'setup',
  'psychic-clue',
  'human-guess',
  'ai-bonus-guess',
  'reveal',
  'score',
  'next-round',
  'game-over',
];

const GAME_MODES: readonly GameMode[] = ['coop', 'competitive'];
const PERSONALITIES: readonly Personality[] = ['lumen', 'sage', 'flux'];
const TEAMS: readonly Team[] = ['human', 'ai'];
const BONUS_DIRECTIONS: readonly BonusDirection[] = ['left', 'right'];
const SCORE_ZONES: readonly ScoreZone[] = ['bullseye', 'adjacent', 'outer', 'miss'];
const ACTUAL_DIRECTIONS: readonly RoundResult['actualDirection'][] = [
  'left',
  'right',
  'center',
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isOneOf = <T extends string>(
  value: unknown,
  options: readonly T[],
): value is T => {
  return typeof value === 'string' && options.includes(value as T);
};

const isSpectrumCard = (value: unknown): value is SpectrumCard => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.id) &&
    typeof value.left === 'string' &&
    typeof value.right === 'string'
  );
};

const isScoreBreakdown = (value: unknown): value is ScoreBreakdown => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOneOf(value.zone, SCORE_ZONES) &&
    isFiniteNumber(value.basePoints) &&
    isFiniteNumber(value.bonusPoints) &&
    isFiniteNumber(value.totalPoints) &&
    typeof value.bonusCorrect === 'boolean'
  );
};

const isRoundResult = (value: unknown): value is RoundResult => {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidBonusCardDrawn =
    value.bonusCardDrawn === undefined || typeof value.bonusCardDrawn === 'boolean';

  return (
    isOneOf(value.actualDirection, ACTUAL_DIRECTIONS) &&
    isOneOf(value.scoringTeam, TEAMS) &&
    isFiniteNumber(value.scoringPoints) &&
    (value.bonusTeam === null || isOneOf(value.bonusTeam, TEAMS)) &&
    isFiniteNumber(value.bonusTeamPoints) &&
    isScoreBreakdown(value.score) &&
    hasValidBonusCardDrawn
  );
};

const isRound = (value: unknown): value is Round => {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidClue = value.clue === null || typeof value.clue === 'string';
  const hasValidGuess =
    value.guessPosition === null || isFiniteNumber(value.guessPosition);
  const hasValidBonusGuess =
    value.bonusGuess === null ||
    (isRecord(value.bonusGuess) &&
      isOneOf(value.bonusGuess.team, TEAMS) &&
      isOneOf(value.bonusGuess.direction, BONUS_DIRECTIONS));
  const hasValidResult = value.result === null || isRoundResult(value.result);

  return (
    isFiniteNumber(value.roundNumber) &&
    isOneOf(value.psychicTeam, TEAMS) &&
    isSpectrumCard(value.card) &&
    isFiniteNumber(value.targetPosition) &&
    hasValidClue &&
    hasValidGuess &&
    hasValidBonusGuess &&
    hasValidResult
  );
};

const isGameState = (value: unknown): value is GameState => {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidSettings =
    isRecord(value.settings) &&
    isOneOf(value.settings.personality, PERSONALITIES) &&
    isFiniteNumber(value.settings.pointsToWin);
  const hasValidDeck =
    Array.isArray(value.deck) && value.deck.every((card) => isSpectrumCard(card));
  const hasValidDiscardPile =
    Array.isArray(value.discardPile) &&
    value.discardPile.every((card) => isSpectrumCard(card));
  const hasValidRound = value.round === null || isRound(value.round);
  const hasValidScores =
    isRecord(value.scores) &&
    isFiniteNumber(value.scores.human) &&
    isFiniteNumber(value.scores.ai);

  return (
    isOneOf(value.phase, GAME_PHASES) &&
    isOneOf(value.mode, GAME_MODES) &&
    hasValidSettings &&
    hasValidDeck &&
    hasValidDiscardPile &&
    hasValidRound &&
    hasValidScores &&
    isFiniteNumber(value.coopScore) &&
    isFiniteNumber(value.totalCards) &&
    (value.winner === null || isOneOf(value.winner, TEAMS))
  );
};

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const clampDialValue = (value: number): number => {
  return Math.max(0, Math.min(100, Math.round(value)));
};

const normalizeAppShellSnapshot = (value: unknown): AppShellSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (value.version !== SNAPSHOT_VERSION) {
    return null;
  }

  if (
    !isOneOf(value.screen, APP_SHELL_SCREENS) ||
    !isOneOf(value.gameMode, GAME_MODES) ||
    !isOneOf(value.personality, PERSONALITIES)
  ) {
    return null;
  }

  const endGameState =
    value.endGameState === null || isGameState(value.endGameState)
      ? value.endGameState
      : null;

  const screen =
    value.screen === 'end' && endGameState === null ? 'mode' : value.screen;

  return {
    version: SNAPSHOT_VERSION,
    screen,
    gameMode: value.gameMode,
    personality: value.personality,
    endGameState,
  };
};

const normalizeGameSessionSnapshot = (
  value: unknown,
): GameSessionSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (value.version !== SNAPSHOT_VERSION) {
    return null;
  }

  if (
    !isOneOf(value.personality, PERSONALITIES) ||
    !isOneOf(value.gameMode, GAME_MODES) ||
    !isGameState(value.gameState) ||
    !isFiniteNumber(value.dialValue) ||
    (value.aiReasoning !== null && typeof value.aiReasoning !== 'string') ||
    typeof value.humanClueInput !== 'string'
  ) {
    return null;
  }

  return {
    version: SNAPSHOT_VERSION,
    personality: value.personality,
    gameMode: value.gameMode,
    gameState: value.gameState,
    dialValue: clampDialValue(value.dialValue),
    aiReasoning: value.aiReasoning,
    humanClueInput: value.humanClueInput,
  };
};

export const loadAppShellSnapshot = (
  storage: Storage | null = getSessionStorage(),
): AppShellSnapshot | null => {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(APP_SHELL_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    return normalizeAppShellSnapshot(JSON.parse(rawValue));
  } catch {
    return null;
  }
};

export const saveAppShellSnapshot = (
  snapshot: AppShellSnapshotInput,
  storage: Storage | null = getSessionStorage(),
): AppShellSnapshot => {
  const normalized: AppShellSnapshot = {
    version: SNAPSHOT_VERSION,
    screen: snapshot.screen,
    gameMode: snapshot.gameMode,
    personality: snapshot.personality,
    endGameState: snapshot.endGameState,
  };

  if (!storage) {
    return normalized;
  }

  try {
    storage.setItem(APP_SHELL_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota/private mode write failures.
  }

  return normalized;
};

export const clearAppShellSnapshot = (
  storage: Storage | null = getSessionStorage(),
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(APP_SHELL_STORAGE_KEY);
  } catch {
    // Ignore storage quota/private mode write failures.
  }
};

export const loadGameSessionSnapshot = (
  storage: Storage | null = getSessionStorage(),
): GameSessionSnapshot | null => {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(GAME_SESSION_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    return normalizeGameSessionSnapshot(JSON.parse(rawValue));
  } catch {
    return null;
  }
};

export const saveGameSessionSnapshot = (
  snapshot: GameSessionSnapshotInput,
  storage: Storage | null = getSessionStorage(),
): GameSessionSnapshot => {
  const normalized: GameSessionSnapshot = {
    version: SNAPSHOT_VERSION,
    personality: snapshot.personality,
    gameMode: snapshot.gameMode,
    gameState: snapshot.gameState,
    dialValue: clampDialValue(snapshot.dialValue),
    aiReasoning: snapshot.aiReasoning,
    humanClueInput: snapshot.humanClueInput,
  };

  if (!storage) {
    return normalized;
  }

  try {
    storage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota/private mode write failures.
  }

  return normalized;
};

export const clearGameSessionSnapshot = (
  storage: Storage | null = getSessionStorage(),
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(GAME_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage quota/private mode write failures.
  }
};
