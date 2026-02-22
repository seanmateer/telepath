import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_STORED_TELEMETRY_GAMES,
  MAX_STORED_TELEMETRY_ROUNDS,
  createEmptyTelemetryStore,
  reduceClearTelemetry,
  reduceEndGameSession,
  reduceRecordUsage,
  reduceStartGameSession,
} from '../playtestTelemetry.js';
import type { AIUsageSample } from '../../types/playtest.js';

const HAIKU_USAGE: AIUsageSample = {
  model: 'claude-haiku-4-5-20251001',
  inputTokens: 120,
  outputTokens: 45,
  estimatedUsd: null,
};

describe('playtest telemetry reducers', () => {
  it('starts a new active game session', () => {
    const started = reduceStartGameSession(createEmptyTelemetryStore(), {
      gameSessionId: 'game-1',
      gameMode: 'coop',
      startedAtMs: 100,
    });

    assert.equal(started.activeGame?.summary.gameSessionId, 'game-1');
    assert.equal(started.activeGame?.summary.gameMode, 'coop');
    assert.equal(started.games.length, 0);
    assert.equal(started.rounds.length, 0);
  });

  it('records usage into active game and round summaries', () => {
    const started = reduceStartGameSession(createEmptyTelemetryStore(), {
      gameSessionId: 'game-1',
      gameMode: 'coop',
      startedAtMs: 100,
    });

    const afterClue = reduceRecordUsage(started, {
      gameSessionId: 'game-1',
      gameMode: 'coop',
      roundNumber: 2,
      callType: 'clue',
      usage: HAIKU_USAGE,
      timestampMs: 200,
    });

    const afterDial = reduceRecordUsage(afterClue, {
      gameSessionId: 'game-1',
      gameMode: 'coop',
      roundNumber: 2,
      callType: 'dial',
      usage: HAIKU_USAGE,
      timestampMs: 201,
    });

    const activeSummary = afterDial.activeGame?.summary;
    assert.ok(activeSummary);
    assert.equal(activeSummary.aiCalls, 2);
    assert.equal(activeSummary.clueCalls, 1);
    assert.equal(activeSummary.dialCalls, 1);
    assert.equal(activeSummary.roundsPlayed, 2);
    assert.equal(activeSummary.inputTokens, 240);
    assert.equal(activeSummary.outputTokens, 90);

    const roundSummary = afterDial.activeGame?.rounds[0];
    assert.ok(roundSummary);
    assert.equal(roundSummary.roundNumber, 2);
    assert.equal(roundSummary.aiCalls, 2);
    assert.equal(roundSummary.clueCalls, 1);
    assert.equal(roundSummary.dialCalls, 1);
  });

  it('finalizes active game into history on end session', () => {
    const started = reduceStartGameSession(createEmptyTelemetryStore(), {
      gameSessionId: 'game-1',
      gameMode: 'competitive',
      startedAtMs: 100,
    });

    const withUsage = reduceRecordUsage(started, {
      gameSessionId: 'game-1',
      gameMode: 'competitive',
      roundNumber: 1,
      callType: 'clue',
      usage: HAIKU_USAGE,
      timestampMs: 120,
    });

    const ended = reduceEndGameSession(withUsage, {
      gameSessionId: 'game-1',
      endedAtMs: 500,
      roundsPlayed: 7,
    });

    assert.equal(ended.activeGame, null);
    assert.equal(ended.games.length, 1);
    assert.equal(ended.rounds.length, 1);
    assert.equal(ended.games[0]?.gameSessionId, 'game-1');
    assert.equal(ended.games[0]?.endedAtMs, 500);
    assert.equal(ended.games[0]?.roundsPlayed, 7);
  });

  it('retains only the configured number of recent games and rounds', () => {
    let store = createEmptyTelemetryStore();

    for (let index = 0; index < MAX_STORED_TELEMETRY_GAMES + 3; index += 1) {
      const gameId = `game-${index}`;
      store = reduceStartGameSession(store, {
        gameSessionId: gameId,
        gameMode: 'coop',
        startedAtMs: 1_000 + index,
      });

      for (let round = 1; round <= 12; round += 1) {
        store = reduceRecordUsage(store, {
          gameSessionId: gameId,
          gameMode: 'coop',
          roundNumber: round,
          callType: 'dial',
          usage: HAIKU_USAGE,
          timestampMs: 2_000 + index * 100 + round,
        });
      }

      store = reduceEndGameSession(store, {
        gameSessionId: gameId,
        endedAtMs: 3_000 + index,
      });
    }

    assert.equal(store.games.length, MAX_STORED_TELEMETRY_GAMES);
    assert.equal(store.rounds.length, MAX_STORED_TELEMETRY_ROUNDS);
  });

  it('clears all telemetry data', () => {
    const started = reduceStartGameSession(createEmptyTelemetryStore(), {
      gameSessionId: 'game-1',
      gameMode: 'coop',
      startedAtMs: 100,
    });

    const cleared = reduceClearTelemetry();

    assert.equal(started.activeGame?.summary.gameSessionId, 'game-1');
    assert.equal(cleared.activeGame, null);
    assert.equal(cleared.games.length, 0);
    assert.equal(cleared.rounds.length, 0);
  });
});
