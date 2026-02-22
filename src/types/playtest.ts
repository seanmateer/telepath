import type { GameMode } from './game.js';

export type PlaytestSettings = {
  haikuOnlyClues: boolean;
};

export type AIUsageSample = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
};

export type TelemetryCallType = 'clue' | 'dial';
export type TelemetryModelMode = 'haiku-only' | 'dual-models' | 'unknown';

export type TelemetryRoundSummary = {
  id: string;
  gameSessionId: string;
  gameMode: GameMode;
  roundNumber: number;
  modelMode: TelemetryModelMode;
  aiCalls: number;
  clueCalls: number;
  dialCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
  unknownEstimateCount: number;
  lastUpdatedMs: number;
};

export type TelemetryGameSummary = {
  gameSessionId: string;
  gameMode: GameMode;
  startedAtMs: number;
  endedAtMs: number | null;
  roundsPlayed: number;
  aiCalls: number;
  clueCalls: number;
  dialCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
  unknownEstimateCount: number;
};

export type TelemetrySnapshot = {
  currentGame: TelemetryGameSummary | null;
  recentGames: TelemetryGameSummary[];
  recentRounds: TelemetryRoundSummary[];
};

export type StartTelemetryGameInput = {
  gameSessionId: string;
  gameMode: GameMode;
  startedAtMs?: number;
};

export type RecordTelemetryUsageInput = {
  gameSessionId: string;
  gameMode: GameMode;
  roundNumber: number;
  callType: TelemetryCallType;
  usage: AIUsageSample;
  timestampMs?: number;
};

export type EndTelemetryGameInput = {
  gameSessionId: string;
  endedAtMs?: number;
  roundsPlayed?: number;
};
