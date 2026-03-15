import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildShuffledDeck,
  isSpectrumDeck,
} from '../../src/lib/spectrumDeck.js';
import type { SpectrumCard, SpectrumDeck } from '../../src/types/game.js';

let cachedDeck: SpectrumDeck | null = null;

export const resetServerDeckCacheForTests = (): void => {
  cachedDeck = null;
};

export const loadServerSpectrumDeck = async (): Promise<SpectrumDeck> => {
  if (cachedDeck) {
    return cachedDeck;
  }

  const deckPath = resolve(process.cwd(), 'public/spectrum-deck.json');
  const rawDeck = await readFile(deckPath, 'utf8');
  const parsedDeck: unknown = JSON.parse(rawDeck);

  if (!isSpectrumDeck(parsedDeck)) {
    throw new Error('Invalid spectrum deck format at public/spectrum-deck.json.');
  }

  cachedDeck = parsedDeck;
  return cachedDeck;
};

export const loadServerShuffledSpectrumDeck = async (
  random: () => number = Math.random,
): Promise<SpectrumCard[]> => {
  const deck = await loadServerSpectrumDeck();
  return buildShuffledDeck(deck, random);
};
