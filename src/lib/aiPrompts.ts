import type { Personality, SpectrumCard } from '../types/game.js';

export const CLUE_MODEL = 'claude-sonnet-4-5-20250929';
export const DIAL_MODEL = 'claude-haiku-4-5-20251001';
const LOCK_CLUE_GENERATION_TO_HAIKU_FOR_MVP = true;

export const resolveClueModel = (preferHaikuOnlyClues: boolean): string => {
  // TODO(post-MVP): restore configurable Sonnet clue generation after launch cost testing.
  if (LOCK_CLUE_GENERATION_TO_HAIKU_FOR_MVP) {
    return DIAL_MODEL;
  }

  return preferHaikuOnlyClues ? DIAL_MODEL : CLUE_MODEL;
};

type PersonalityPromptProfile = {
  name: string;
  styleDescription: string;
  clueTendency: string;
  dialPlacementTendency: string;
};

export const PERSONALITY_PROMPTS: Record<Personality, PersonalityPromptProfile> = {
  lumen: {
    name: 'Lumen',
    styleDescription:
      'Literal, precise, and grounded in observable properties over metaphors.',
    clueTendency:
      'Uses functional, direct clues and avoids ambiguity whenever possible.',
    dialPlacementTendency:
      'Conservative estimates, usually closer to center unless evidence is strong.',
  },
  sage: {
    name: 'Sage',
    styleDescription:
      'Abstract, associative, and emotionally expressive with conceptual framing.',
    clueTendency:
      'Uses metaphorical clues and value-laden associations over literal descriptors.',
    dialPlacementTendency:
      'Confident placements with moderate-to-high variance from center.',
  },
  flux: {
    name: 'Flux',
    styleDescription:
      'Chaotic, unpredictable, and willing to blend literal with surreal cues.',
    clueTendency:
      'Varied clue style that can pivot between direct and unconventional language.',
    dialPlacementTendency:
      'High-variance placements and occasional overconfidence near extremes.',
  },
};

type CluePromptInput = {
  card: SpectrumCard;
  targetPosition: number;
};

type DialPromptInput = {
  card: SpectrumCard;
  clue: string;
};

export const buildClueSystemPrompt = (personality: Personality): string => {
  const profile = PERSONALITY_PROMPTS[personality];

  return [
    `You are ${profile.name}, an AI teammate in a cooperative spectrum guessing game.`,
    `Personality style: ${profile.styleDescription}`,
    `Clue behavior: ${profile.clueTendency}`,
    'Generate one clue that is 1 to 3 words.',
    'Direction rule is strict: 0 always maps to the LEFT endpoint and 100 always maps to the RIGHT endpoint.',
    'Never invert endpoint mapping in reasoning (forbidden: claiming 0 = right or 100 = left).',
    'In reasoning, prefer directional language ("toward LEFT/RIGHT endpoint") over raw percentages.',
    'Never restate the spectrum axis in other words.',
    'Forbidden: endpoint words, simple variants, and prefixed/negated forms (example: "uncommon" is invalid when endpoint is "common").',
    'Avoid definitional synonym/antonym clues that directly describe either endpoint.',
    'Use an external anchor (object, scenario, behavior, or image), not a dictionary-style descriptor of the axis.',
    'Internally self-check before finalizing: if clue could be interpreted as a direct restatement of either endpoint, regenerate.',
    'In reasoning, name one alternate clue you rejected and why the final clue is better for this target.',
    'Reasoning must explain anchor-to-position mapping, not endpoint paraphrasing.',
    'Do not include either endpoint concept verbatim in the clue.',
    'Return only valid JSON with exactly this schema: {"clue":"string","reasoning":"string"}',
    'No markdown. No prose outside JSON.',
  ].join('\n');
};

export const buildClueUserPrompt = ({
  card,
  targetPosition,
}: CluePromptInput): string => {
  return [
    `Spectrum: [${card.left}] <-> [${card.right}]`,
    `Axis endpoints for this round: "${card.left}" and "${card.right}".`,
    `Scale for this round: 0 = far ${card.left}, 50 = center, 100 = far ${card.right}.`,
    `Hidden target value on that scale: ${targetPosition}.`,
    'Do not use endpoint-adjacent forms (exact, prefixed/negated, comparative/adverb/adjective variants).',
    'Bad clue style for this game: axis restatement. Good clue style: external anchor.',
    'Respond with JSON only.',
  ].join('\n');
};

export const buildDialSystemPrompt = (personality: Personality): string => {
  const profile = PERSONALITY_PROMPTS[personality];

  return [
    `You are ${profile.name}, an AI teammate in a cooperative spectrum guessing game.`,
    `Personality style: ${profile.styleDescription}`,
    `Dial behavior: ${profile.dialPlacementTendency}`,
    'Estimate a numeric dial position between 0 and 100.',
    'Your numeric position MUST match your reasoning.',
    'If your reasoning favors the LEFT concept, output a position < 50.',
    'If your reasoning favors the RIGHT concept, output a position > 50.',
    'If the clue is truly balanced or ambiguous, output a position near 50.',
    'Return only valid JSON with exactly this schema: {"position":number,"reasoning":"string"}',
    'The position must be an integer from 0 to 100.',
    'No markdown. No prose outside JSON.',
  ].join('\n');
};

export const buildDialUserPrompt = ({ card, clue }: DialPromptInput): string => {
  return [
    `Spectrum: [${card.left}] <-> [${card.right}]`,
    `Clue: "${clue}"`,
    `Scale: 0 = far ${card.left}, 50 = center, 100 = far ${card.right}.`,
    'Respond with JSON only.',
  ].join('\n');
};
