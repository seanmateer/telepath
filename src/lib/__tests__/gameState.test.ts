import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BONUS_POINT_VALUE,
  COOP_DECK_SIZE,
  calculateRoundScore,
  createInitialGameState,
  getCoopRating,
  revealRound,
  scoreCoopRound,
  scoreRound,
  startCoopGame,
  startGame,
  startNextRound,
  submitBonusGuess,
  submitHumanGuess,
  submitPsychicClue,
  submitTeamGuess,
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

// ===========================
// CO-OP MODE TESTS
// ===========================

const COOP_CARDS: SpectrumCard[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  left: `Left${i}`,
  right: `Right${i}`,
}));

describe('co-op mode: startCoopGame', () => {
  it('deals exactly 7 cards and sets mode to coop', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.3 });

    assert.equal(state.mode, 'coop');
    assert.equal(state.totalCards, COOP_DECK_SIZE);
    // 1 card drawn for round 1, rest in deck
    assert.equal(state.deck.length, COOP_DECK_SIZE - 1);
    assert.equal(state.coopScore, 0);
    assert.equal(state.phase, 'psychic-clue');
  });

  it('randomly assigns first psychic', () => {
    let state1 = createInitialGameState();
    state1 = startCoopGame(state1, { deck: COOP_CARDS, random: () => 0.1 });
    // random() < 0.5 → 'human'
    assert.equal(state1.round?.psychicTeam, 'human');

    let state2 = createInitialGameState();
    state2 = startCoopGame(state2, { deck: COOP_CARDS, random: () => 0.9 });
    // random() >= 0.5 → 'ai'
    assert.equal(state2.round?.psychicTeam, 'ai');
  });
});

describe('co-op mode: team guess skips bonus', () => {
  it('goes from human-guess directly to reveal via submitTeamGuess', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.3 });
    state = submitPsychicClue(state, 'Test clue');
    assert.equal(state.phase, 'human-guess');

    state = submitTeamGuess(state, 50);
    assert.equal(state.phase, 'reveal');
    // No bonus guess phase
    assert.equal(state.round?.bonusGuess, null);
  });
});

describe('co-op mode: scoreCoopRound', () => {
  it('scores bullseye as 3 points and draws a bonus card when discard pile available', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.5 });

    // Play round 1 (miss) to get a card into the discard pile
    state = submitPsychicClue(state, 'Miss');
    const target1 = state.round!.targetPosition;
    const missGuess = target1 >= 50 ? 0 : 100;
    state = submitTeamGuess(state, missGuess);
    state = revealRound(state);
    state = scoreCoopRound(state);
    state = startNextRound(state, () => 0.5);

    // Now discard pile has 1 card; play round 2 as bullseye
    state = submitPsychicClue(state, 'Bullseye');
    const target2 = state.round!.targetPosition;
    state = submitTeamGuess(state, target2);
    state = revealRound(state);
    state = scoreCoopRound(state);

    assert.equal(state.coopScore, 3); // 0 from miss + 3 from bullseye
    assert.equal(state.round?.result?.bonusCardDrawn, true);
  });

  it('scores bullseye as 3 points without bonus card when discard pile empty', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.5 });
    state = submitPsychicClue(state, 'Bullseye');
    const target = state.round!.targetPosition;
    state = submitTeamGuess(state, target);
    state = revealRound(state);
    state = scoreCoopRound(state);

    assert.equal(state.coopScore, 3);
    // No bonus card because discard pile is empty in round 1
    assert.equal(state.round?.result?.bonusCardDrawn, false);
  });

  it('scores adjacent as 3 points', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.5 });
    state = submitPsychicClue(state, 'Close');
    const target = state.round!.targetPosition;
    // 7 away = adjacent zone
    state = submitTeamGuess(state, Math.min(100, target + 7));
    state = revealRound(state);
    state = scoreCoopRound(state);

    assert.equal(state.coopScore, 3);
  });

  it('scores outer as 2 points', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.5 });
    state = submitPsychicClue(state, 'Far');
    const target = state.round!.targetPosition;
    // 15 away = outer zone
    state = submitTeamGuess(state, Math.min(100, target + 15));
    state = revealRound(state);
    state = scoreCoopRound(state);

    assert.equal(state.coopScore, 2);
  });

  it('scores miss as 0 points', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.5 });
    state = submitPsychicClue(state, 'Way off');
    const target = state.round!.targetPosition;
    // 50 away = miss
    const guess = target >= 50 ? target - 50 : target + 50;
    state = submitTeamGuess(state, guess);
    state = revealRound(state);
    state = scoreCoopRound(state);

    assert.equal(state.coopScore, 0);
  });
});

describe('co-op mode: alternating psychic', () => {
  it('alternates psychic each round', () => {
    let state = createInitialGameState();
    state = startCoopGame(state, { deck: COOP_CARDS, random: () => 0.3 });
    const firstPsychic = state.round!.psychicTeam;

    // Complete round 1
    state = submitPsychicClue(state, 'Clue 1');
    state = submitTeamGuess(state, 50);
    state = revealRound(state);
    state = scoreCoopRound(state);
    state = startNextRound(state, () => 0.5);

    const secondPsychic = state.round!.psychicTeam;
    assert.notEqual(firstPsychic, secondPsychic);

    // Complete round 2
    state = submitPsychicClue(state, 'Clue 2');
    state = submitTeamGuess(state, 50);
    state = revealRound(state);
    state = scoreCoopRound(state);
    state = startNextRound(state, () => 0.5);

    const thirdPsychic = state.round!.psychicTeam;
    assert.equal(firstPsychic, thirdPsychic);
  });
});

describe('co-op mode: game ends when deck is empty', () => {
  it('ends after all cards played', () => {
    let state = createInitialGameState();
    // Use exactly 2 cards for faster test
    const twoCards = COOP_CARDS.slice(0, 2);
    state = startCoopGame(state, { deck: twoCards, random: () => 0.3 });

    // Round 1 — deliberately miss to avoid bullseye bonus card
    state = submitPsychicClue(state, 'Clue 1');
    const target1 = state.round!.targetPosition;
    const missGuess1 = target1 >= 50 ? 0 : 100;
    state = submitTeamGuess(state, missGuess1);
    state = revealRound(state);
    state = scoreCoopRound(state);
    assert.equal(state.phase, 'next-round');

    state = startNextRound(state, () => 0.5);
    // Round 2 (last card) — also miss to avoid bonus card
    state = submitPsychicClue(state, 'Clue 2');
    const target2 = state.round!.targetPosition;
    const missGuess2 = target2 >= 50 ? 0 : 100;
    state = submitTeamGuess(state, missGuess2);
    state = revealRound(state);
    state = scoreCoopRound(state);

    assert.equal(state.phase, 'game-over');
  });
});

describe('co-op mode: score accumulation', () => {
  it('accumulates score across rounds', () => {
    let state = createInitialGameState();
    const threeCards = COOP_CARDS.slice(0, 3);
    state = startCoopGame(state, { deck: threeCards, random: () => 0.5 });

    // Round 1: hit bullseye (3 pts)
    state = submitPsychicClue(state, 'Exact');
    const target1 = state.round!.targetPosition;
    state = submitTeamGuess(state, target1);
    state = revealRound(state);
    state = scoreCoopRound(state);
    assert.equal(state.coopScore, 3);

    state = startNextRound(state, () => 0.5);

    // Round 2: miss (0 pts)
    state = submitPsychicClue(state, 'Bad');
    const target2 = state.round!.targetPosition;
    const missGuess = target2 >= 50 ? target2 - 50 : target2 + 50;
    state = submitTeamGuess(state, missGuess);
    state = revealRound(state);
    state = scoreCoopRound(state);
    assert.equal(state.coopScore, 3); // unchanged

    state = startNextRound(state, () => 0.5);

    // Round 3: outer (2 pts)
    state = submitPsychicClue(state, 'Close-ish');
    const target3 = state.round!.targetPosition;
    state = submitTeamGuess(state, Math.min(100, target3 + 15));
    state = revealRound(state);
    state = scoreCoopRound(state);
    assert.equal(state.coopScore, 5); // 3 + 0 + 2
  });
});

describe('getCoopRating', () => {
  it('returns correct ratings for score ranges', () => {
    assert.equal(getCoopRating(0), "Are you sure it's plugged in?");
    assert.equal(getCoopRating(3), "Are you sure it's plugged in?");
    assert.equal(getCoopRating(4), 'Try turning it off and back on again');
    assert.equal(getCoopRating(7), 'Not bad! Not great, but not bad');
    assert.equal(getCoopRating(10), 'SO CLOSE');
    assert.equal(getCoopRating(13), 'You won!');
    assert.equal(getCoopRating(16), "You're on the same wavelength");
    assert.equal(getCoopRating(19), 'Galaxy brain');
    assert.equal(getCoopRating(22), 'Psychic for real');
    assert.equal(getCoopRating(30), 'Psychic for real');
  });
});
