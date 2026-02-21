import type { SpectrumCard, SpectrumDeck } from '../types/game.js';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isSpectrumCard = (value: unknown): value is SpectrumCard => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    typeof value.left === 'string' &&
    value.left.trim().length > 0 &&
    typeof value.right === 'string' &&
    value.right.trim().length > 0
  );
};

export const isSpectrumDeck = (value: unknown): value is SpectrumDeck => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.version !== 'string' ||
    value.version.trim().length === 0 ||
    typeof value.pack !== 'string' ||
    value.pack.trim().length === 0 ||
    typeof value.description !== 'string' ||
    value.description.trim().length === 0 ||
    !Array.isArray(value.cards)
  ) {
    return false;
  }

  return value.cards.every((card) => isSpectrumCard(card));
};

export const shuffleSpectrumCards = (
  cards: readonly SpectrumCard[],
  random: () => number = Math.random,
): SpectrumCard[] => {
  const shuffledCards = [...cards];

  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentCard = shuffledCards[index];
    shuffledCards[index] = shuffledCards[swapIndex];
    shuffledCards[swapIndex] = currentCard;
  }

  return shuffledCards;
};

export const buildShuffledDeck = (
  deck: SpectrumDeck,
  random: () => number = Math.random,
): SpectrumCard[] => {
  return shuffleSpectrumCards(deck.cards, random);
};

export const loadSpectrumDeck = async (
  deckUrl = '/spectrum-deck.json',
): Promise<SpectrumDeck> => {
  const response = await fetch(deckUrl);

  if (!response.ok) {
    throw new Error(`Failed to load spectrum deck: HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isSpectrumDeck(payload)) {
    throw new Error('Invalid spectrum deck format.');
  }

  return payload;
};

export const loadShuffledSpectrumDeck = async (
  deckUrl = '/spectrum-deck.json',
  random: () => number = Math.random,
): Promise<SpectrumCard[]> => {
  const deck = await loadSpectrumDeck(deckUrl);
  return buildShuffledDeck(deck, random);
};
