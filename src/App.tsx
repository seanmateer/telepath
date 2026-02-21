import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Dial } from './components/Dial';
import {
  createInitialGameState,
  revealRound,
  scoreRound,
  startGame,
  startNextRound,
  submitBonusGuess,
  submitHumanGuess,
  submitPsychicClue,
} from './lib/gameState';
import { loadShuffledSpectrumDeck } from './lib/spectrumDeck';
import type { BonusDirection, GameState } from './types/game';

const SNAP_INCREMENT = 5;
const SNAP_ANIMATION_MS = 180;
const DEFAULT_DIAL_VALUE = 50;
const DEMO_CLUES = ['Balanced warmth', 'Nearly boiling', 'Mild breeze'];

const easeOutCubic = (value: number): number => {
  return 1 - (1 - value) ** 3;
};

export const App = () => {
  const [dialValue, setDialValue] = useState(DEFAULT_DIAL_VALUE);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dialValueRef = useRef(dialValue);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    dialValueRef.current = dialValue;
  }, [dialValue]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const stopDialAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const getDemoClue = useCallback((roundNumber: number): string => {
    return DEMO_CLUES[(roundNumber - 1) % DEMO_CLUES.length];
  }, []);

  const initializeGame = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const shuffledDeck = await loadShuffledSpectrumDeck();
      let nextState = createInitialGameState({ personality: 'lumen', pointsToWin: 10 });
      nextState = startGame(nextState, { deck: shuffledDeck, startingPsychicTeam: 'human' });

      const roundNumber = nextState.round?.roundNumber ?? 1;
      nextState = submitPsychicClue(nextState, getDemoClue(roundNumber));

      setGameState(nextState);
      setDialValue(DEFAULT_DIAL_VALUE);
      stopDialAnimation();
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to initialize game state.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getDemoClue, stopDialAnimation]);

  useEffect(() => {
    void initializeGame();
  }, [initializeGame]);

  const handleDialChange = useCallback(
    (value: number) => {
      if (!gameState || gameState.phase !== 'human-guess') {
        return;
      }

      stopDialAnimation();
      setDialValue(value);
    },
    [gameState, stopDialAnimation],
  );

  const handleDialRelease = useCallback(
    (value: number) => {
      if (!gameState || gameState.phase !== 'human-guess') {
        return;
      }

      const snappedTarget = Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
      const startValue = dialValueRef.current;
      const endValue = Math.max(0, Math.min(100, snappedTarget));
      const startTime = performance.now();

      stopDialAnimation();

      const animate = (timestamp: number): void => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / SNAP_ANIMATION_MS);
        const easedProgress = easeOutCubic(progress);
        const nextValue = Math.round(
          startValue + (endValue - startValue) * easedProgress,
        );

        setDialValue(nextValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [gameState, stopDialAnimation],
  );

  const chooseAIBonusDirection = useCallback((state: GameState): BonusDirection => {
    const round = state.round;
    if (!round || round.guessPosition === null) {
      return 'left';
    }

    if (round.targetPosition === round.guessPosition) {
      return 'left';
    }

    return round.targetPosition < round.guessPosition ? 'left' : 'right';
  }, []);

  const handleLockGuess = useCallback(() => {
    if (!gameState || gameState.phase !== 'human-guess') {
      return;
    }

    try {
      const withGuess = submitHumanGuess(gameState, dialValueRef.current);
      const withBonusGuess = submitBonusGuess(
        withGuess,
        chooseAIBonusDirection(withGuess),
      );
      const revealed = revealRound(withBonusGuess);
      const scored = scoreRound(revealed);

      setGameState(scored);
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to resolve round result.';
      setError(message);
    }
  }, [chooseAIBonusDirection, gameState]);

  const handleAdvance = useCallback(() => {
    if (!gameState) {
      return;
    }

    if (gameState.phase === 'game-over') {
      void initializeGame();
      return;
    }

    if (gameState.phase !== 'next-round') {
      return;
    }

    try {
      let nextState = startNextRound(gameState);

      if (nextState.phase !== 'game-over') {
        const roundNumber = nextState.round?.roundNumber ?? 1;
        nextState = submitPsychicClue(nextState, getDemoClue(roundNumber));
      }

      setGameState(nextState);
      setDialValue(DEFAULT_DIAL_VALUE);
      stopDialAnimation();
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to start next round.';
      setError(message);
    }
  }, [gameState, getDemoClue, initializeGame, stopDialAnimation]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10 text-center">
        <p className="text-base font-medium text-slate-700">Loading dial sandbox…</p>
      </main>
    );
  }

  if (error || !gameState || !gameState.round) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10 text-center">
        <section className="space-y-3">
          <p className="text-base font-medium text-rose-700">
            {error ?? 'Game state unavailable.'}
          </p>
          <button
            type="button"
            onClick={() => void initializeGame()}
            className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  const currentRound = gameState.round;
  const revealValue =
    gameState.phase === 'next-round' || gameState.phase === 'game-over'
      ? currentRound.targetPosition
      : null;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-center">
      <motion.section
        className="w-full max-w-[430px] space-y-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Telepath
        </h1>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Phase 3 Dial + State Machine Wiring
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-left text-sm text-slate-700">
          <p>Round {currentRound.roundNumber}</p>
          <p>Phase: {gameState.phase}</p>
          <p>
            Score: Human {gameState.scores.human} — AI {gameState.scores.ai}
          </p>
          <p>Clue: {currentRound.clue ?? '—'}</p>
        </div>
        <Dial
          value={dialValue}
          leftLabel={currentRound.card.left}
          rightLabel={currentRound.card.right}
          onChange={handleDialChange}
          onRelease={handleDialRelease}
          revealValue={revealValue}
        />
        <div className="flex justify-center">
          {gameState.phase === 'human-guess' ? (
            <button
              type="button"
              onClick={handleLockGuess}
              className="rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
            >
              Lock Guess
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAdvance}
              className="rounded-full border border-sky-300 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-200"
            >
              {gameState.phase === 'game-over' ? 'Restart Game' : 'Next Round'}
            </button>
          )}
        </div>
        {revealValue !== null ? (
          <p className="text-sm font-medium text-slate-700">
            Target reveal: {Math.round(revealValue)}%
          </p>
        ) : null}
      </motion.section>
    </main>
  );
};
