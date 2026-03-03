import type { Personality, SpectrumCard } from './game.js';

export type GenerateClueAction = {
  action: 'generate-clue';
  personality: Personality;
  card: SpectrumCard;
  targetPosition: number;
};

export type PlaceDialAction = {
  action: 'place-dial';
  personality: Personality;
  card: SpectrumCard;
  clue: string;
};

export type AIActionRequest = GenerateClueAction | PlaceDialAction;
