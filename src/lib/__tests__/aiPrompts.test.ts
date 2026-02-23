import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildClueSystemPrompt,
  buildClueUserPrompt,
} from '../aiPrompts.js';
import type { Personality, SpectrumCard } from '../../types/game.js';

const PERSONALITIES: Personality[] = ['lumen', 'sage', 'flux'];

const CLUE_GUARDRAIL_LINES = [
  'Direction rule is strict: 0 always maps to the LEFT endpoint and 100 always maps to the RIGHT endpoint.',
  'Never invert endpoint mapping in reasoning (forbidden: claiming 0 = right or 100 = left).',
  'In reasoning, prefer directional language ("toward LEFT/RIGHT endpoint") over raw percentages.',
  'Never restate the spectrum axis in other words.',
  'Forbidden: endpoint words, simple variants, and prefixed/negated forms (example: "uncommon" is invalid when endpoint is "common").',
  'Avoid definitional synonym/antonym clues that directly describe either endpoint.',
  'Use an external anchor (object, scenario, behavior, or image), not a dictionary-style descriptor of the axis.',
  'Internally self-check before finalizing: if clue could be interpreted as a direct restatement of either endpoint, regenerate.',
  'Reasoning must explain anchor-to-position mapping, not endpoint paraphrasing.',
];

describe('buildClueSystemPrompt', () => {
  it('includes anti-restatement guardrails for every personality', () => {
    for (const personality of PERSONALITIES) {
      const prompt = buildClueSystemPrompt(personality);
      for (const line of CLUE_GUARDRAIL_LINES) {
        assert.ok(
          prompt.includes(line),
          `Expected ${personality} prompt to include: ${line}`,
        );
      }
    }
  });

  it('preserves the strict JSON response schema contract', () => {
    for (const personality of PERSONALITIES) {
      const prompt = buildClueSystemPrompt(personality);
      assert.ok(
        prompt.includes(
          'Return only valid JSON with exactly this schema: {"clue":"string","reasoning":"string"}',
        ),
      );
      assert.ok(prompt.includes('No markdown. No prose outside JSON.'));
    }
  });
});

describe('buildClueUserPrompt', () => {
  it('includes spectrum-specific anti-leak context', () => {
    const card: SpectrumCard = { id: 1, left: 'Rare', right: 'Common' };
    const prompt = buildClueUserPrompt({ card, targetPosition: 19 });

    assert.ok(
      prompt.includes('Axis endpoints for this round: "Rare" and "Common".'),
    );
    assert.ok(
      prompt.includes('Scale for this round: 0 = far Rare, 50 = center, 100 = far Common.'),
    );
    assert.ok(prompt.includes('Hidden target value on that scale: 19.'));
    assert.ok(
      prompt.includes(
        'Do not use endpoint-adjacent forms (exact, prefixed/negated, comparative/adverb/adjective variants).',
      ),
    );
    assert.ok(
      prompt.includes(
        'Bad clue style for this game: axis restatement. Good clue style: external anchor.',
      ),
    );
  });
});
