import type { PlaytestSettings } from '../types/playtest.js';

export const PLAYTEST_SETTINGS_STORAGE_KEY = 'telepath.playtestSettings.v1';

export const DEFAULT_PLAYTEST_SETTINGS: PlaytestSettings = {
  haikuOnlyClues: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
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

const normalizePlaytestSettings = (value: unknown): PlaytestSettings => {
  if (!isRecord(value)) {
    return DEFAULT_PLAYTEST_SETTINGS;
  }

  return {
    // TODO(post-MVP): restore persisted clue-model selection once Sonnet costs are acceptable.
    haikuOnlyClues: true,
  };
};

export const loadPlaytestSettings = (
  storage: Storage | null = getBrowserStorage(),
): PlaytestSettings => {
  if (!storage) {
    return DEFAULT_PLAYTEST_SETTINGS;
  }

  try {
    const rawValue = storage.getItem(PLAYTEST_SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_PLAYTEST_SETTINGS;
    }

    return normalizePlaytestSettings(JSON.parse(rawValue));
  } catch {
    return DEFAULT_PLAYTEST_SETTINGS;
  }
};

export const savePlaytestSettings = (
  settings: PlaytestSettings,
  storage: Storage | null = getBrowserStorage(),
): PlaytestSettings => {
  const normalizedSettings = normalizePlaytestSettings(settings);

  if (!storage) {
    return normalizedSettings;
  }

  try {
    storage.setItem(
      PLAYTEST_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizedSettings),
    );
  } catch {
    // Ignore storage quota/private mode write failures.
  }

  return normalizedSettings;
};
