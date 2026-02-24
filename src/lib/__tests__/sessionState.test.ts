import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInitialGameState, startCoopGame } from '../gameState.js';
import {
  APP_SHELL_STORAGE_KEY,
  GAME_SESSION_STORAGE_KEY,
  clearAppShellSnapshot,
  clearGameSessionSnapshot,
  loadAppShellSnapshot,
  loadGameSessionSnapshot,
  saveAppShellSnapshot,
  saveGameSessionSnapshot,
} from '../sessionState.js';
import type { GameState } from '../../types/game.js';

type StorageMap = Map<string, string>;

class MemoryStorage implements Storage {
  private readonly store: StorageMap = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const buildGameState = (): GameState => {
  const initialState = createInitialGameState({ personality: 'sage' });

  return startCoopGame(initialState, {
    deck: [
      { id: 1, left: 'Cold', right: 'Hot' },
      { id: 2, left: 'Soft', right: 'Hard' },
      { id: 3, left: 'Quiet', right: 'Loud' },
    ],
    random: () => 0.1,
  });
};

describe('app shell snapshot storage', () => {
  it('returns null when no app shell snapshot has been saved', () => {
    const storage = new MemoryStorage();

    assert.equal(loadAppShellSnapshot(storage), null);
  });

  it('round-trips app shell snapshot through session storage', () => {
    const storage = new MemoryStorage();
    const gameState = buildGameState();

    saveAppShellSnapshot(
      {
        screen: 'end',
        gameMode: 'coop',
        personality: 'flux',
        endGameState: gameState,
      },
      storage,
    );

    const loaded = loadAppShellSnapshot(storage);

    assert.ok(loaded);
    assert.equal(loaded.screen, 'end');
    assert.equal(loaded.gameMode, 'coop');
    assert.equal(loaded.personality, 'flux');
    assert.deepEqual(loaded.endGameState, gameState);
  });

  it('falls back to mode screen when stored end screen lacks valid end game state', () => {
    const storage = new MemoryStorage();

    storage.setItem(
      APP_SHELL_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        screen: 'end',
        gameMode: 'coop',
        personality: 'lumen',
        endGameState: null,
      }),
    );

    const loaded = loadAppShellSnapshot(storage);

    assert.ok(loaded);
    assert.equal(loaded.screen, 'mode');
    assert.equal(loaded.endGameState, null);
  });

  it('clears app shell snapshot from session storage', () => {
    const storage = new MemoryStorage();

    saveAppShellSnapshot(
      {
        screen: 'game',
        gameMode: 'coop',
        personality: 'lumen',
        endGameState: null,
      },
      storage,
    );
    clearAppShellSnapshot(storage);

    assert.equal(storage.getItem(APP_SHELL_STORAGE_KEY), null);
  });
});

describe('game session snapshot storage', () => {
  it('returns null when stored JSON is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem(GAME_SESSION_STORAGE_KEY, '{not-json');

    assert.equal(loadGameSessionSnapshot(storage), null);
  });

  it('round-trips game session snapshot and clamps dial value', () => {
    const storage = new MemoryStorage();
    const gameState = buildGameState();

    saveGameSessionSnapshot(
      {
        personality: 'sage',
        gameMode: 'coop',
        gameState,
        dialValue: 142,
        aiReasoning: 'Test reasoning',
        humanClueInput: 'warm',
      },
      storage,
    );

    const loaded = loadGameSessionSnapshot(storage);

    assert.ok(loaded);
    assert.equal(loaded.personality, 'sage');
    assert.equal(loaded.gameMode, 'coop');
    assert.equal(loaded.dialValue, 100);
    assert.equal(loaded.aiReasoning, 'Test reasoning');
    assert.equal(loaded.humanClueInput, 'warm');
    assert.deepEqual(loaded.gameState, gameState);
  });

  it('clears game session snapshot from session storage', () => {
    const storage = new MemoryStorage();
    const gameState = buildGameState();

    saveGameSessionSnapshot(
      {
        personality: 'sage',
        gameMode: 'coop',
        gameState,
        dialValue: 50,
        aiReasoning: null,
        humanClueInput: '',
      },
      storage,
    );
    clearGameSessionSnapshot(storage);

    assert.equal(storage.getItem(GAME_SESSION_STORAGE_KEY), null);
  });
});
