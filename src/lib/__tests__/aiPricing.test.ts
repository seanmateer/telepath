import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MODEL_TOKEN_PRICING,
  estimateUsageUsd,
} from '../aiPricing.js';

describe('estimateUsageUsd', () => {
  it('estimates known sonnet model pricing', () => {
    const estimate = estimateUsageUsd('claude-sonnet-4-5-20250929', 1_000_000, 0);

    assert.equal(estimate, MODEL_TOKEN_PRICING['claude-sonnet-4-5-20250929'].inputUsdPerMillion);
  });

  it('estimates known haiku model pricing', () => {
    const estimate = estimateUsageUsd('claude-haiku-4-5-20251001', 0, 1_000_000);

    assert.equal(estimate, MODEL_TOKEN_PRICING['claude-haiku-4-5-20251001'].outputUsdPerMillion);
  });

  it('returns null for unknown models', () => {
    assert.equal(estimateUsageUsd('claude-unknown', 1000, 1000), null);
  });

  it('returns null for invalid token values', () => {
    assert.equal(estimateUsageUsd('claude-haiku-4-5-20251001', -1, 10), null);
  });
});
