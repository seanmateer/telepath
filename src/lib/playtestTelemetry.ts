import { estimateUsageUsd } from './aiPricing.js';
import type {
  AIUsageSample,
  EndTelemetryGameInput,
  RecordTelemetryUsageInput,
  StartTelemetryGameInput,
  TelemetryGameSummary,
  TelemetryModelMode,
  TelemetryRoundSummary,
  TelemetrySnapshot,
} from '../types/playtest.js';

export const PLAYTEST_TELEMETRY_STORAGE_KEY = 'telepath.aiTelemetry.v1';
export const MAX_STORED_TELEMETRY_GAMES = 10;
export const MAX_STORED_TELEMETRY_ROUNDS = 100;

const TELEMETRY_STORE_VERSION = 1;

type ActiveTelemetryGame = {
  summary: TelemetryGameSummary;
  rounds: TelemetryRoundSummary[];
};

export type TelemetryStore = {
  version: number;
  activeGame: ActiveTelemetryGame | null;
  games: TelemetryGameSummary[];
  rounds: TelemetryRoundSummary[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isTelemetryModelMode = (
  value: unknown,
): value is TelemetryModelMode => {
  return (
    value === 'haiku-only' ||
    value === 'dual-models' ||
    value === 'unknown'
  );
};

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const toNonNegativeNumber = (value: number): number => {
  return value >= 0 ? value : 0;
};

const toNonNegativeInteger = (value: number): number => {
  return Math.max(0, Math.round(value));
};

const sanitizeUsageSample = (usage: AIUsageSample): AIUsageSample => {
  return {
    model: usage.model,
    inputTokens: toNonNegativeInteger(usage.inputTokens),
    outputTokens: toNonNegativeInteger(usage.outputTokens),
    estimatedUsd:
      typeof usage.estimatedUsd === 'number' && Number.isFinite(usage.estimatedUsd)
        ? toNonNegativeNumber(usage.estimatedUsd)
        : null,
  };
};

const resolveEstimatedUsd = (usage: AIUsageSample): number | null => {
  if (typeof usage.estimatedUsd === 'number' && Number.isFinite(usage.estimatedUsd)) {
    return toNonNegativeNumber(usage.estimatedUsd);
  }

  return estimateUsageUsd(usage.model, usage.inputTokens, usage.outputTokens);
};

const isTelemetryGameSummary = (value: unknown): value is TelemetryGameSummary => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.gameSessionId === 'string' &&
    (value.gameMode === 'coop' || value.gameMode === 'competitive') &&
    typeof value.startedAtMs === 'number' &&
    (value.endedAtMs === null || typeof value.endedAtMs === 'number') &&
    typeof value.roundsPlayed === 'number' &&
    typeof value.aiCalls === 'number' &&
    typeof value.clueCalls === 'number' &&
    typeof value.dialCalls === 'number' &&
    typeof value.inputTokens === 'number' &&
    typeof value.outputTokens === 'number' &&
    (value.estimatedUsd === null || typeof value.estimatedUsd === 'number') &&
    typeof value.unknownEstimateCount === 'number'
  );
};

const isTelemetryRoundSummary = (value: unknown): value is TelemetryRoundSummary => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.gameSessionId === 'string' &&
    (value.gameMode === 'coop' || value.gameMode === 'competitive') &&
    typeof value.roundNumber === 'number' &&
    typeof value.aiCalls === 'number' &&
    typeof value.clueCalls === 'number' &&
    typeof value.dialCalls === 'number' &&
    typeof value.inputTokens === 'number' &&
    typeof value.outputTokens === 'number' &&
    (value.estimatedUsd === null || typeof value.estimatedUsd === 'number') &&
    typeof value.unknownEstimateCount === 'number' &&
    (value.modelMode === undefined || isTelemetryModelMode(value.modelMode)) &&
    typeof value.lastUpdatedMs === 'number'
  );
};

const sanitizeGameSummary = (summary: TelemetryGameSummary): TelemetryGameSummary => {
  return {
    ...summary,
    roundsPlayed: toNonNegativeInteger(summary.roundsPlayed),
    aiCalls: toNonNegativeInteger(summary.aiCalls),
    clueCalls: toNonNegativeInteger(summary.clueCalls),
    dialCalls: toNonNegativeInteger(summary.dialCalls),
    inputTokens: toNonNegativeInteger(summary.inputTokens),
    outputTokens: toNonNegativeInteger(summary.outputTokens),
    estimatedUsd:
      typeof summary.estimatedUsd === 'number' && Number.isFinite(summary.estimatedUsd)
        ? toNonNegativeNumber(summary.estimatedUsd)
        : null,
    unknownEstimateCount: toNonNegativeInteger(summary.unknownEstimateCount),
  };
};

const sanitizeRoundSummary = (summary: TelemetryRoundSummary): TelemetryRoundSummary => {
  return {
    ...summary,
    roundNumber: toNonNegativeInteger(summary.roundNumber),
    modelMode: isTelemetryModelMode(summary.modelMode)
      ? summary.modelMode
      : 'unknown',
    aiCalls: toNonNegativeInteger(summary.aiCalls),
    clueCalls: toNonNegativeInteger(summary.clueCalls),
    dialCalls: toNonNegativeInteger(summary.dialCalls),
    inputTokens: toNonNegativeInteger(summary.inputTokens),
    outputTokens: toNonNegativeInteger(summary.outputTokens),
    estimatedUsd:
      typeof summary.estimatedUsd === 'number' && Number.isFinite(summary.estimatedUsd)
        ? toNonNegativeNumber(summary.estimatedUsd)
        : null,
    unknownEstimateCount: toNonNegativeInteger(summary.unknownEstimateCount),
    lastUpdatedMs: Math.max(0, Math.round(summary.lastUpdatedMs)),
  };
};

const sortRoundSummaries = (
  rounds: TelemetryRoundSummary[],
): TelemetryRoundSummary[] => {
  return [...rounds].sort((a, b) => {
    if (a.lastUpdatedMs === b.lastUpdatedMs) {
      return b.roundNumber - a.roundNumber;
    }

    return b.lastUpdatedMs - a.lastUpdatedMs;
  });
};

const pruneStore = (store: TelemetryStore): TelemetryStore => {
  return {
    ...store,
    games: store.games.slice(0, MAX_STORED_TELEMETRY_GAMES),
    rounds: sortRoundSummaries(store.rounds).slice(0, MAX_STORED_TELEMETRY_ROUNDS),
  };
};

const normalizeTelemetryStore = (value: unknown): TelemetryStore => {
  if (!isRecord(value)) {
    return createEmptyTelemetryStore();
  }

  const games = Array.isArray(value.games)
    ? value.games
        .filter((entry): entry is TelemetryGameSummary => isTelemetryGameSummary(entry))
        .map((entry) => sanitizeGameSummary(entry))
    : [];

  const rounds = Array.isArray(value.rounds)
    ? value.rounds
        .filter((entry): entry is TelemetryRoundSummary => isTelemetryRoundSummary(entry))
        .map((entry) => sanitizeRoundSummary(entry))
    : [];

  let activeGame: ActiveTelemetryGame | null = null;
  if (isRecord(value.activeGame)) {
    const summaryValue = value.activeGame.summary;
    const roundsValue = value.activeGame.rounds;

    if (
      isTelemetryGameSummary(summaryValue) &&
      Array.isArray(roundsValue)
    ) {
      activeGame = {
        summary: sanitizeGameSummary(summaryValue),
        rounds: roundsValue
          .filter((entry): entry is TelemetryRoundSummary => isTelemetryRoundSummary(entry))
          .map((entry) => sanitizeRoundSummary(entry)),
      };
    }
  }

  return pruneStore({
    version: TELEMETRY_STORE_VERSION,
    activeGame,
    games,
    rounds,
  });
};

export const createEmptyTelemetryStore = (): TelemetryStore => {
  return {
    version: TELEMETRY_STORE_VERSION,
    activeGame: null,
    games: [],
    rounds: [],
  };
};

const createGameSummary = (
  input: StartTelemetryGameInput,
  startedAtMs: number,
): TelemetryGameSummary => {
  return {
    gameSessionId: input.gameSessionId,
    gameMode: input.gameMode,
    startedAtMs,
    endedAtMs: null,
    roundsPlayed: 0,
    aiCalls: 0,
    clueCalls: 0,
    dialCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedUsd: 0,
    unknownEstimateCount: 0,
  };
};

const createRoundSummary = (
  input: RecordTelemetryUsageInput,
  timestampMs: number,
): TelemetryRoundSummary => {
  return {
    id: `${input.gameSessionId}:${input.roundNumber}`,
    gameSessionId: input.gameSessionId,
    gameMode: input.gameMode,
    roundNumber: input.roundNumber,
    modelMode: 'unknown',
    aiCalls: 0,
    clueCalls: 0,
    dialCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedUsd: 0,
    unknownEstimateCount: 0,
    lastUpdatedMs: timestampMs,
  };
};

const isHaikuModel = (model: string): boolean => {
  return model.toLowerCase().includes('haiku');
};

const resolveRoundModelMode = (
  currentMode: TelemetryModelMode,
  usage: AIUsageSample,
): TelemetryModelMode => {
  if (!isHaikuModel(usage.model)) {
    return 'dual-models';
  }

  if (currentMode === 'unknown') {
    return 'haiku-only';
  }

  return currentMode;
};

const applyUsageToRound = (
  round: TelemetryRoundSummary,
  callType: RecordTelemetryUsageInput['callType'],
  usage: AIUsageSample,
  estimatedUsd: number | null,
  timestampMs: number,
): TelemetryRoundSummary => {
  const nextRound: TelemetryRoundSummary = {
    ...round,
    modelMode: resolveRoundModelMode(round.modelMode, usage),
    aiCalls: round.aiCalls + 1,
    inputTokens: round.inputTokens + usage.inputTokens,
    outputTokens: round.outputTokens + usage.outputTokens,
    lastUpdatedMs: timestampMs,
  };

  if (callType === 'clue') {
    nextRound.clueCalls += 1;
  } else {
    nextRound.dialCalls += 1;
  }

  if (estimatedUsd === null) {
    nextRound.unknownEstimateCount += 1;
  } else {
    nextRound.estimatedUsd = (nextRound.estimatedUsd ?? 0) + estimatedUsd;
  }

  return nextRound;
};

const applyUsageToGame = (
  game: TelemetryGameSummary,
  callType: RecordTelemetryUsageInput['callType'],
  usage: AIUsageSample,
  estimatedUsd: number | null,
  roundNumber: number,
): TelemetryGameSummary => {
  const nextGame: TelemetryGameSummary = {
    ...game,
    aiCalls: game.aiCalls + 1,
    roundsPlayed: Math.max(game.roundsPlayed, roundNumber),
    inputTokens: game.inputTokens + usage.inputTokens,
    outputTokens: game.outputTokens + usage.outputTokens,
  };

  if (callType === 'clue') {
    nextGame.clueCalls += 1;
  } else {
    nextGame.dialCalls += 1;
  }

  if (estimatedUsd === null) {
    nextGame.unknownEstimateCount += 1;
  } else {
    nextGame.estimatedUsd = (nextGame.estimatedUsd ?? 0) + estimatedUsd;
  }

  return nextGame;
};

const finalizeActiveGame = (
  activeGame: ActiveTelemetryGame,
  endedAtMs: number,
  roundsPlayedOverride?: number,
): { game: TelemetryGameSummary; rounds: TelemetryRoundSummary[] } => {
  const maxRoundFromCalls = activeGame.rounds.reduce((max, round) => {
    return Math.max(max, round.roundNumber);
  }, activeGame.summary.roundsPlayed);

  const game: TelemetryGameSummary = {
    ...activeGame.summary,
    endedAtMs,
    roundsPlayed:
      roundsPlayedOverride === undefined
        ? maxRoundFromCalls
        : Math.max(maxRoundFromCalls, toNonNegativeInteger(roundsPlayedOverride)),
  };

  return {
    game,
    rounds: sortRoundSummaries(activeGame.rounds),
  };
};

const appendCompletedGame = (
  store: TelemetryStore,
  game: TelemetryGameSummary,
  rounds: TelemetryRoundSummary[],
): TelemetryStore => {
  return pruneStore({
    ...store,
    activeGame: null,
    games: [sanitizeGameSummary(game), ...store.games],
    rounds: [...rounds.map((entry) => sanitizeRoundSummary(entry)), ...store.rounds],
  });
};

export const reduceStartGameSession = (
  store: TelemetryStore,
  input: StartTelemetryGameInput,
): TelemetryStore => {
  const startedAtMs = input.startedAtMs ?? Date.now();

  if (
    store.activeGame &&
    store.activeGame.summary.gameSessionId === input.gameSessionId
  ) {
    return store;
  }

  let nextStore = store;
  if (store.activeGame) {
    const finalized = finalizeActiveGame(store.activeGame, startedAtMs);
    nextStore = appendCompletedGame(store, finalized.game, finalized.rounds);
  }

  return {
    ...nextStore,
    activeGame: {
      summary: createGameSummary(input, startedAtMs),
      rounds: [],
    },
  };
};

export const reduceRecordUsage = (
  store: TelemetryStore,
  input: RecordTelemetryUsageInput,
): TelemetryStore => {
  const activeGame = store.activeGame;
  if (!activeGame || activeGame.summary.gameSessionId !== input.gameSessionId) {
    return store;
  }

  const timestampMs = input.timestampMs ?? Date.now();
  const sanitizedUsage = sanitizeUsageSample(input.usage);
  const estimatedUsd = resolveEstimatedUsd(sanitizedUsage);

  const nextSummary = applyUsageToGame(
    activeGame.summary,
    input.callType,
    sanitizedUsage,
    estimatedUsd,
    input.roundNumber,
  );

  const roundId = `${input.gameSessionId}:${input.roundNumber}`;
  const roundIndex = activeGame.rounds.findIndex((round) => round.id === roundId);

  const baseRound =
    roundIndex === -1
      ? createRoundSummary(input, timestampMs)
      : activeGame.rounds[roundIndex];

  const nextRound = applyUsageToRound(
    baseRound,
    input.callType,
    sanitizedUsage,
    estimatedUsd,
    timestampMs,
  );

  const nextRounds =
    roundIndex === -1
      ? sortRoundSummaries([nextRound, ...activeGame.rounds])
      : activeGame.rounds.map((round, index) =>
          index === roundIndex ? nextRound : round,
        );

  return {
    ...store,
    activeGame: {
      summary: nextSummary,
      rounds: nextRounds,
    },
  };
};

export const reduceEndGameSession = (
  store: TelemetryStore,
  input: EndTelemetryGameInput,
): TelemetryStore => {
  const activeGame = store.activeGame;
  if (!activeGame || activeGame.summary.gameSessionId !== input.gameSessionId) {
    return store;
  }

  const endedAtMs = input.endedAtMs ?? Date.now();
  const finalized = finalizeActiveGame(
    activeGame,
    endedAtMs,
    input.roundsPlayed,
  );

  return appendCompletedGame(store, finalized.game, finalized.rounds);
};

export const reduceClearTelemetry = (): TelemetryStore => {
  return createEmptyTelemetryStore();
};

const toTelemetrySnapshot = (store: TelemetryStore): TelemetrySnapshot => {
  const activeRounds = store.activeGame
    ? sortRoundSummaries(
        store.activeGame.rounds.map((round) => sanitizeRoundSummary(round)),
      )
    : [];

  return {
    currentGame: store.activeGame
      ? sanitizeGameSummary(store.activeGame.summary)
      : null,
    recentGames: store.games.map((game) => sanitizeGameSummary(game)),
    recentRounds: sortRoundSummaries([
      ...activeRounds,
      ...store.rounds.map((round) => sanitizeRoundSummary(round)),
    ]).slice(0, MAX_STORED_TELEMETRY_ROUNDS),
  };
};

const readTelemetryStore = (
  storage: Storage | null = getBrowserStorage(),
): TelemetryStore => {
  if (!storage) {
    return createEmptyTelemetryStore();
  }

  try {
    const raw = storage.getItem(PLAYTEST_TELEMETRY_STORAGE_KEY);
    if (!raw) {
      return createEmptyTelemetryStore();
    }

    return normalizeTelemetryStore(JSON.parse(raw));
  } catch {
    return createEmptyTelemetryStore();
  }
};

const writeTelemetryStore = (
  store: TelemetryStore,
  storage: Storage | null = getBrowserStorage(),
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(PLAYTEST_TELEMETRY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write failures.
  }
};

export const loadTelemetrySnapshot = (
  storage: Storage | null = getBrowserStorage(),
): TelemetrySnapshot => {
  return toTelemetrySnapshot(readTelemetryStore(storage));
};

export const startGameSession = (
  input: StartTelemetryGameInput,
  storage: Storage | null = getBrowserStorage(),
): TelemetrySnapshot => {
  const store = reduceStartGameSession(readTelemetryStore(storage), input);
  writeTelemetryStore(store, storage);
  return toTelemetrySnapshot(store);
};

export const recordUsage = (
  input: RecordTelemetryUsageInput,
  storage: Storage | null = getBrowserStorage(),
): TelemetrySnapshot => {
  const store = reduceRecordUsage(readTelemetryStore(storage), input);
  writeTelemetryStore(store, storage);
  return toTelemetrySnapshot(store);
};

export const endGameSession = (
  input: EndTelemetryGameInput,
  storage: Storage | null = getBrowserStorage(),
): TelemetrySnapshot => {
  const store = reduceEndGameSession(readTelemetryStore(storage), input);
  writeTelemetryStore(store, storage);
  return toTelemetrySnapshot(store);
};

export const clearTelemetry = (
  storage: Storage | null = getBrowserStorage(),
): TelemetrySnapshot => {
  const store = reduceClearTelemetry();
  writeTelemetryStore(store, storage);
  return toTelemetrySnapshot(store);
};
