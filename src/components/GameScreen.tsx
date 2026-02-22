import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dial } from './Dial';
import { ScoreBar } from './ScoreBar';
import { ReasoningPanel } from './ReasoningPanel';
import { RoundTransition } from './RoundTransition';
import {
  createInitialGameState,
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
} from '../lib/gameState';
import { loadShuffledSpectrumDeck } from '../lib/spectrumDeck';
import { useAI } from '../hooks/useAI';
import type { BonusDirection, GameMode, GameState, Personality } from '../types/game';

type GameScreenProps = {
  personality: Personality;
  gameMode: GameMode;
  onGameOver: (state: GameState) => void;
};

const SNAP_INCREMENT = 5;
const SNAP_ANIMATION_MS = 180;
const DEFAULT_DIAL_VALUE = 50;

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;

export const GameScreen = ({ personality, gameMode, onGameOver }: GameScreenProps) => {
  const [dialValue, setDialValue] = useState(DEFAULT_DIAL_VALUE);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [humanClueInput, setHumanClueInput] = useState('');
  const dialValueRef = useRef(dialValue);
  const animationFrameRef = useRef<number | null>(null);
  const { generateClue, placeDial } = useAI();

  // Stable refs for AI functions to avoid re-render loops
  const generateClueRef = useRef(generateClue);
  generateClueRef.current = generateClue;
  const placeDialRef = useRef(placeDial);
  placeDialRef.current = placeDial;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

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

  // Initialize game — runs once on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError(null);
      setAiReasoning(null);

      try {
        const shuffledDeck = await loadShuffledSpectrumDeck();
        let nextState = createInitialGameState({ personality, pointsToWin: 10 });

        if (gameMode === 'coop') {
          nextState = startCoopGame(nextState, { deck: shuffledDeck });
        } else {
          nextState = startGame(nextState, { deck: shuffledDeck, startingPsychicTeam: 'human' });
        }

        if (cancelled) return;

        // Human is psychic first round — no AI call needed
        // AI is psychic on even rounds — generate a clue
        if (nextState.round?.psychicTeam === 'ai') {
          setAiThinking(true);
          const clueResult = await generateClueRef.current({
            card: nextState.round.card,
            targetPosition: nextState.round.targetPosition,
            personality,
          });
          if (cancelled) return;
          nextState = submitPsychicClue(nextState, clueResult.clue);
          setAiReasoning(clueResult.reasoning);
          setAiThinking(false);
        }

        setGameState(nextState);
        setDialValue(DEFAULT_DIAL_VALUE);
      } catch (caughtError: unknown) {
        if (cancelled) return;
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to initialize game.';
        setError(message);
        setAiThinking(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [personality]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDialChange = useCallback(
    (value: number) => {
      if (!gameState || gameState.phase !== 'human-guess') return;
      stopDialAnimation();
      setDialValue(value);
    },
    [gameState, stopDialAnimation],
  );

  const handleDialRelease = useCallback(
    (value: number) => {
      if (!gameState || gameState.phase !== 'human-guess') return;

      const snappedTarget = Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
      const startValue = dialValueRef.current;
      const endValue = Math.max(0, Math.min(100, snappedTarget));
      const startTime = performance.now();

      stopDialAnimation();

      const animate = (timestamp: number): void => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / SNAP_ANIMATION_MS);
        const easedProgress = easeOutCubic(progress);
        const nextValue = Math.round(startValue + (endValue - startValue) * easedProgress);
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
    if (!round || round.guessPosition === null) return 'left';
    if (round.targetPosition === round.guessPosition) return 'left';
    return round.targetPosition < round.guessPosition ? 'left' : 'right';
  }, []);

  const handleSubmitClue = useCallback(async () => {
    if (!gameState || gameState.phase !== 'psychic-clue') return;
    if (humanClueInput.trim().length === 0) return;

    try {
      setAiThinking(true);
      let nextState = submitPsychicClue(gameState, humanClueInput.trim());

      // AI places the dial as guesser
      const dialResult = await placeDialRef.current({
        card: nextState.round!.card,
        clue: humanClueInput.trim(),
        personality,
      });

      // Submit AI's guess — co-op skips bonus, competitive uses bonus flow
      if (gameMode === 'coop') {
        nextState = submitTeamGuess(nextState, dialResult.position);
        const revealed = revealRound(nextState);
        const scored = scoreCoopRound(revealed);
        setAiReasoning(dialResult.reasoning);
        setGameState(scored);
        setDialValue(dialResult.position);
        setHumanClueInput('');
        setAiThinking(false);
        setShowTransition(true);
      } else {
        nextState = submitHumanGuess(nextState, dialResult.position);
        setAiReasoning(dialResult.reasoning);
        setGameState(nextState);
        setDialValue(dialResult.position);
        setHumanClueInput('');
        setAiThinking(false);
      }
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to process clue.';
      setError(message);
      setAiThinking(false);
    }
  }, [gameState, humanClueInput, personality, gameMode]);

  const handleHumanBonusGuess = useCallback(
    (direction: BonusDirection) => {
      if (!gameState || gameState.phase !== 'ai-bonus-guess') return;

      try {
        const withBonus = submitBonusGuess(gameState, direction);
        const revealed = revealRound(withBonus);
        const scored = scoreRound(revealed);
        setGameState(scored);
        setShowTransition(true);
      } catch (caughtError: unknown) {
        const message =
          caughtError instanceof Error ? caughtError.message : 'Failed to resolve round.';
        setError(message);
      }
    },
    [gameState],
  );

  const handleLockGuess = useCallback(() => {
    if (!gameState || gameState.phase !== 'human-guess') return;

    try {
      if (gameMode === 'coop') {
        // Co-op: skip bonus guess, go directly to reveal → score
        const withGuess = submitTeamGuess(gameState, dialValueRef.current);
        const revealed = revealRound(withGuess);
        const scored = scoreCoopRound(revealed);
        setGameState(scored);
        setShowTransition(true);
      } else {
        // Competitive: AI makes bonus guess, then reveal → score
        const withGuess = submitHumanGuess(gameState, dialValueRef.current);
        const withBonusGuess = submitBonusGuess(withGuess, chooseAIBonusDirection(withGuess));
        const revealed = revealRound(withBonusGuess);
        const scored = scoreRound(revealed);
        setGameState(scored);
        setShowTransition(true);
      }
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to resolve round.';
      setError(message);
    }
  }, [chooseAIBonusDirection, gameState, gameMode]);

  const handleTransitionDone = useCallback(async () => {
    setShowTransition(false);

    if (!gameState) return;

    if (gameState.phase === 'game-over') {
      onGameOverRef.current(gameState);
      return;
    }

    if (gameState.phase !== 'next-round') return;

    try {
      let nextState = startNextRound(gameState);

      if (nextState.phase === 'game-over') {
        onGameOverRef.current(nextState);
        return;
      }

      setAiReasoning(null);

      // If AI is psychic, generate a clue
      if (nextState.round?.psychicTeam === 'ai') {
        setAiThinking(true);
        const clueResult = await generateClueRef.current({
          card: nextState.round.card,
          targetPosition: nextState.round.targetPosition,
          personality,
        });
        nextState = submitPsychicClue(nextState, clueResult.clue);
        setAiReasoning(clueResult.reasoning);
        setAiThinking(false);
      }

      setGameState(nextState);
      setDialValue(DEFAULT_DIAL_VALUE);
      stopDialAnimation();
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to start next round.';
      setError(message);
      setAiThinking(false);
    }
  }, [gameState, personality, stopDialAnimation]);

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
          <p className="mt-4 text-sm text-ink-muted">Setting up the game...</p>
        </motion.div>
      </main>
    );
  }

  if (error || !gameState || !gameState.round) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-flux">
            {error ?? 'Something went wrong.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 min-h-[44px] rounded-full border border-flux/30 bg-flux-light px-5 py-3 text-sm font-medium text-flux transition hover:bg-flux/10"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const currentRound = gameState.round;
  const isHumanPsychic = currentRound.psychicTeam === 'human';
  const isRevealed =
    gameState.phase === 'next-round' || gameState.phase === 'game-over';
  const revealValue = isRevealed ? currentRound.targetPosition : null;

  return (
    <main className="flex min-h-[100dvh] flex-col px-4 pb-8 pt-4 sm:px-6">
      {/* Score bar */}
      <ScoreBar
        humanScore={gameState.scores.human}
        aiScore={gameState.scores.ai}
        personality={personality}
        roundNumber={currentRound.roundNumber}
        pointsToWin={gameState.settings.pointsToWin}
        gameMode={gameMode}
        coopScore={gameState.coopScore}
        totalCards={gameState.totalCards}
        cardsRemaining={gameState.deck.length}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-sm">
          {/* Phase indicator */}
          <motion.div
            className="mb-6 text-center"
            key={`phase-${gameState.phase}-${currentRound.roundNumber}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {aiThinking ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted" />
                <p className="text-sm text-ink-muted">
                  {isHumanPsychic ? 'AI is reading your clue...' : 'AI is thinking of a clue...'}
                </p>
              </div>
            ) : gameState.phase === 'psychic-clue' && isHumanPsychic ? (
              <p className="text-sm font-medium text-ink-light">
                You&apos;re the psychic. Give a clue.
              </p>
            ) : gameState.phase === 'human-guess' ? (
              <p className="text-sm font-medium text-ink-light">
                Place the dial where you think the target is.
              </p>
            ) : gameState.phase === 'ai-bonus-guess' && gameMode === 'competitive' ? (
              <p className="text-sm font-medium text-ink-light">
                Is the real target left or right of the guess?
              </p>
            ) : isRevealed ? (
              <p className="text-sm font-medium text-ink-light">
                Round complete
              </p>
            ) : null}
          </motion.div>

          {/* Clue display */}
          <AnimatePresence mode="wait">
            {currentRound.clue && (
              <motion.div
                key={`clue-${currentRound.roundNumber}`}
                className="mb-6 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35 }}
              >
                <p className="text-xs font-medium uppercase tracking-widest text-ink-faint">
                  {isHumanPsychic ? 'Your clue' : 'AI\'s clue'}
                </p>
                <p className="mt-1 font-serif text-3xl text-ink">
                  {currentRound.clue}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Human clue input (when human is psychic) */}
          {gameState.phase === 'psychic-clue' && isHumanPsychic && !aiThinking && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={humanClueInput}
                  onChange={(e) => setHumanClueInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSubmitClue();
                  }}
                  placeholder="Enter your clue..."
                  maxLength={40}
                  aria-label="Enter a one-word clue for your team"
                  autoComplete="off"
                  className="flex-1 rounded-xl border border-warm-200 bg-white/80 px-4 py-3 text-center text-lg font-medium text-ink placeholder:text-ink-faint focus:border-warm-400 focus:outline-none focus:ring-1 focus:ring-warm-300"
                />
              </div>
              <div className="mt-2 text-center">
                <p className="text-xs text-ink-faint">
                  {currentRound.card.left} &larr; &middot; &middot; &middot; &rarr; {currentRound.card.right}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Target at {currentRound.targetPosition}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSubmitClue()}
                disabled={humanClueInput.trim().length === 0}
                className="mt-3 w-full rounded-full bg-ink py-3 text-sm font-medium text-warm-50 transition-all hover:bg-ink-light disabled:opacity-40 disabled:hover:bg-ink"
              >
                Give Clue
              </button>
            </motion.div>
          )}

          {/* Dial */}
          {(gameState.phase === 'human-guess' ||
            gameState.phase === 'ai-bonus-guess' ||
            isRevealed) && (
            <Dial
              value={dialValue}
              leftLabel={currentRound.card.left}
              rightLabel={currentRound.card.right}
              onChange={handleDialChange}
              onRelease={handleDialRelease}
              revealValue={revealValue}
            />
          )}

          {/* Action area */}
          <div className="mt-6 flex justify-center">
            {gameState.phase === 'human-guess' && (
              <motion.button
                type="button"
                onClick={handleLockGuess}
                className="rounded-full bg-ink px-8 py-3 text-sm font-medium text-warm-50 transition-all hover:bg-ink-light hover:shadow-glow active:scale-[0.97]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                whileTap={{ scale: 0.97 }}
              >
                Lock Guess
              </motion.button>
            )}

            {gameState.phase === 'ai-bonus-guess' && gameMode === 'competitive' && (
              <motion.div
                className="flex gap-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() => handleHumanBonusGuess('left')}
                  className="min-h-[44px] rounded-full border border-warm-200 bg-white/80 px-6 py-3 text-sm font-medium text-ink transition hover:bg-warm-100"
                >
                  &larr; Left
                </button>
                <button
                  type="button"
                  onClick={() => handleHumanBonusGuess('right')}
                  className="min-h-[44px] rounded-full border border-warm-200 bg-white/80 px-6 py-3 text-sm font-medium text-ink transition hover:bg-warm-100"
                >
                  Right &rarr;
                </button>
              </motion.div>
            )}
          </div>

          {/* Reasoning panel (after reveal) */}
          {isRevealed && aiReasoning && (
            <div className="mt-6">
              <ReasoningPanel
                reasoning={aiReasoning}
                personality={personality}
              />
            </div>
          )}
        </div>
      </div>

      {/* Round transition overlay */}
      <AnimatePresence>
        {showTransition && gameState.round?.result && (
          <RoundTransition
            result={gameState.round.result}
            isGameOver={gameState.phase === 'game-over'}
            gameMode={gameMode}
            coopScore={gameState.coopScore}
            onDone={() => void handleTransitionDone()}
          />
        )}
      </AnimatePresence>
    </main>
  );
};
