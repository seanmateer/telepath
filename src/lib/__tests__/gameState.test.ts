import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BONUS_POINT_VALUE,
  calculateRoundScore,
  createInitialGameState,
  revealRound,
  scoreRound,
  startGame,
  startNextRound,
  submitBonusGuess,
  submitHumanGuess,
  submitPsychicClue,
} from '../gameState.js';
import type { Round, SpectrumCard } from '../../types/game.js';

const CARD_A: SpectrumCard = { id: 1, left: 'Cold', right: 'Hot' };
const CARD_B: SpectrumCard = { id: 2, left: 'Simple', right: 'Complex' };

const createRoundForScore = (
  targetPosition: number,
  guessPosition: number,
  bonusDirection: 'left' | 'right',
): Round => {
  return {
    roundNumber: 1,
    psychicTeam: 'human',
    card: CARD_A,
    targetPosition,
    clue: 'Test clue',
    guessPosition,
    bonusGuess: {
      team: 'ai',
      direction: bonusDirection,
    },
    result: null,
  };
};

describe('calculateRoundScore', () => {
  it('scores bullseye as 4 points', () => {
    const score = calculateRoundScore(createRoundForScore(50, 50, 'left'));
    assert.equal(score.zone, 'bullseye');
    assert.equal(score.basePoints, 4);
  });

  it('scores adjacent as 3 points', () => {
    const score = calculateRoundScore(createRoundForScore(50, 58, 'left'));
    assert.equal(score.zone, 'adjacent');
    assert.equal(score.basePoints, 3);
  });

  it('scores outer as 2 points', () => {
    const score = calculateRoundScore(createRoundForScore(50, 66, 'left'));
    assert.equal(score.zone, 'outer');
    assert.equal(score.basePoints, 2);
  });

  it('scores miss as 0 points', () => {
    const score = calculateRoundScore(createRoundForScore(20, 75, 'left'));
    assert.equal(score.zone, 'miss');
    assert.equal(score.basePoints, 0);
  });

  it('awards 1 bonus point for correct opposing direction guess', () => {
    const score = calculateRoundScore(createRoundForScore(80, 60, 'right'));
    assert.equal(score.bonusCorrect, true);
    assert.equal(score.bonusPoints, BONUS_POINT_VALUE);
  });
});

describe('gameState transitions', () => {
  it('moves through all core phases in order', () => {
    let state = createInitialGameState({ pointsToWin: 10 });
    state = startGame(state, {
      deck: [CARD_A, CARD_B],
      startingPsychicTeam: 'human',
      random: () => 0.8,
    });
    assert.equal(state.phase, 'psychic-clue');

    state = submitPsychicClue(state, 'Boiling');
    assert.equal(state.phase, 'human-guess');

    state = submitHumanGuess(state, 10);
    assert.equal(state.phase, 'ai-bonus-guess');

    state = submitBonusGuess(state, 'left');
    assert.equal(state.phase, 'reveal');

    state = revealRound(state);
    assert.equal(state.phase, 'score');

    state = scoreRound(state);
    assert.equal(state.phase, 'next-round');

    state = startNextRound(state, () => 0.2);
    assert.equal(state.phase, 'psychic-clue');
  });

  it('alternates psychic team each round', () => {
    let state = createInitialGameState();
    state = startGame(state, {
      deck: [CARD_A, CARD_B],
      startingPsychicTeam: 'human',
      random: () => 0.5,
    });
    assert.equal(state.round?.psychicTeam, 'human');

    state = submitPsychicClue(state, 'Center');
    state = submitHumanGuess(state, 0);
    state = submitBonusGuess(state, 'left');
    state = revealRound(state);
    state = scoreRound(state);
    state = startNextRound(state, () => 0.5);

    assert.equal(state.round?.psychicTeam, 'ai');
  });

  it('ends the game when a team reaches pointsToWin', () => {
    let state = createInitialGameState({ pointsToWin: 4 });
    state = startGame(state, {
      deck: [CARD_A],
      startingPsychicTeam: 'human',
      random: () => 0.5,
    });

    state = submitPsychicClue(state, 'Balanced');
    state = submitHumanGuess(state, 50);
    state = submitBonusGuess(state, 'left');
    state = revealRound(state);
    state = scoreRound(state);

    assert.equal(state.phase, 'game-over');
    assert.equal(state.winner, 'human');
    assert.equal(state.scores.human, 4);
  });
});
