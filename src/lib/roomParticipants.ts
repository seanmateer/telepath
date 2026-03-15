import type { CursorColorName } from '../types/room.js';

export const MAX_DISPLAY_NAME_LENGTH = 24;

const CURSOR_COLORS: readonly CursorColorName[] = [
  'blue',
  'teal',
  'sage',
  'gold',
  'coral',
  'rose',
];

const FALLBACK_ADJECTIVES = [
  'Bright',
  'Quiet',
  'Swift',
  'Kind',
  'Lucky',
  'Clever',
  'Warm',
  'Calm',
] as const;

const FALLBACK_NOUNS = [
  'Fox',
  'Otter',
  'Kite',
  'Pine',
  'Comet',
  'Finch',
  'Brook',
  'Cedar',
] as const;

export const normalizeDisplayName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > MAX_DISPLAY_NAME_LENGTH) {
    return null;
  }

  return normalized;
};

export const getParticipantInitials = (displayName: string): string => {
  const normalized = normalizeDisplayName(displayName) ?? displayName.trim();
  if (normalized.length === 0) {
    return '??';
  }

  const words = normalized.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }

  return `${words[0]![0] ?? ''}${words[words.length - 1]![0] ?? ''}`.toUpperCase();
};

export const createFallbackDisplayName = (
  random: () => number = Math.random,
): string => {
  const adjective =
    FALLBACK_ADJECTIVES[Math.floor(random() * FALLBACK_ADJECTIVES.length)] ??
    FALLBACK_ADJECTIVES[0];
  const noun =
    FALLBACK_NOUNS[Math.floor(random() * FALLBACK_NOUNS.length)] ??
    FALLBACK_NOUNS[0];

  return `${adjective} ${noun}`;
};

export const getCursorColorForJoinOrder = (joinOrder: number): CursorColorName => {
  const normalizedJoinOrder = Math.max(1, Math.floor(joinOrder));
  return CURSOR_COLORS[(normalizedJoinOrder - 1) % CURSOR_COLORS.length]!;
};
