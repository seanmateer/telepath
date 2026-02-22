import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_PLAYTEST_SETTINGS,
  PLAYTEST_SETTINGS_STORAGE_KEY,
  loadPlaytestSettings,
  savePlaytestSettings,
} from '../playtestSettings.js';

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

describe('playtest settings storage', () => {
  it('returns defaults when no settings have been saved', () => {
    const storage = new MemoryStorage();

    assert.deepEqual(loadPlaytestSettings(storage), DEFAULT_PLAYTEST_SETTINGS);
  });

  it('falls back to defaults when stored JSON is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem(PLAYTEST_SETTINGS_STORAGE_KEY, '{not json');

    assert.deepEqual(loadPlaytestSettings(storage), DEFAULT_PLAYTEST_SETTINGS);
  });

  it('round-trips saved settings through local storage', () => {
    const storage = new MemoryStorage();

    savePlaytestSettings({ haikuOnlyClues: true }, storage);
    const loaded = loadPlaytestSettings(storage);

    assert.deepEqual(loaded, { haikuOnlyClues: true });
  });
});
