import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Dial } from './Dial';
import { CoopRoundSummary } from './CoopRoundSummary';
import { PlaytestUtilityPanel } from './PlaytestUtilityPanel';
import { ScoreBar } from './ScoreBar';
import { ScoreThermometerModal } from './ScoreThermometerModal';
import { ReasoningPanel } from './ReasoningPanel';
import { RoundTransition } from './RoundTransition';
import {
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
} from '../lib/gameState';
import {
  clearTelemetry,
  endGameSession,
  loadTelemetrySnapshot,
  recordUsage,
  startGameSession,
} from '../lib/playtestTelemetry';
import {
  clearGameSessionSnapshot,
  loadGameSessionSnapshot,
  saveGameSessionSnapshot,
} from '../lib/sessionState';
import { loadShuffledSpectrumDeck } from '../lib/spectrumDeck';
import { useAI } from '../hooks/useAI';
import type { BonusDirection, GameMode, GameState, Personality } from '../types/game';
import type { AIUsageSample, PlaytestSettings } from '../types/playtest';

type GameScreenProps = {
  personality: Personality;
  gameMode: GameMode;
  playtestSettings: PlaytestSettings;
  onPlaytestSettingsChange: (settings: PlaytestSettings) => void;
  onGameOver: (state: GameState) => void;
};

const SNAP_INCREMENT = 5;
const SNAP_ANIMATION_MS = 180;
const AI_DIAL_SWEEP_MS = 650;
const COOP_REVEAL_ANIMATION_MS = 420;
const DEFAULT_DIAL_VALUE = 50;

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;

const createGameSessionId = (): string => {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const personalityNames: Record<Personality, string> = {
  lumen: 'Lumen',
  sage: 'Sage',
  flux: 'Flux',
};

export const GameScreen = ({
  personality,
  gameMode,
  playtestSettings,
  onPlaytestSettingsChange,
  onGameOver,
}: GameScreenProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [dialValue, setDialValue] = useState(DEFAULT_DIAL_VALUE);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [showScoreThermometer, setShowScoreThermometer] = useState(false);
  const [sceneTransitionTick, setSceneTransitionTick] = useState(0);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [humanClueInput, setHumanClueInput] = useState('');
  const [isRevealingTarget, setIsRevealingTarget] = useState(false);
  const [telemetrySnapshot, setTelemetrySnapshot] = useState(() =>
    loadTelemetrySnapshot(),
  );
  const dialValueRef = useRef(dialValue);
  const animationFrameRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const gameSessionIdRef = useRef<string | null>(null);
  const telemetryEndedRef = useRef(false);
  const roundAdvanceInFlightRef = useRef(false);
  const { generateClue, placeDial } = useAI({
    useHaikuOnlyClues: playtestSettings.haikuOnlyClues,
  });

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
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }

      const gameSessionId = gameSessionIdRef.current;
      if (!gameSessionId || telemetryEndedRef.current) {
        return;
      }

      telemetryEndedRef.current = true;
      endGameSession({ gameSessionId });
    };
  }, []);

  useEffect(() => {
    if (
      loading ||
      aiThinking ||
      isRevealingTarget ||
      !gameState ||
      error ||
      gameState.phase === 'game-over'
    ) {
      if (gameState?.phase === 'game-over') {
        clearGameSessionSnapshot();
      }
      return;
    }

    saveGameSessionSnapshot({
      personality,
      gameMode,
      gameState,
      dialValue,
      aiReasoning,
      humanClueInput,
    });
  }, [
    aiReasoning,
    aiThinking,
    dialValue,
    error,
    gameMode,
    gameState,
    humanClueInput,
    isRevealingTarget,
    loading,
    personality,
  ]);

  const stopDialAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const recordTelemetryUsage = useCallback(
    (
      roundNumber: number,
      callType: 'clue' | 'dial',
      usage: AIUsageSample | null,
    ) => {
      const gameSessionId = gameSessionIdRef.current;
      if (!gameSessionId || !usage) {
        return;
      }

      setTelemetrySnapshot(
        recordUsage({
          gameSessionId,
          gameMode,
          roundNumber,
          callType,
          usage,
        }),
      );
    },
    [gameMode],
  );

  const finalizeTelemetrySession = useCallback((roundsPlayed?: number) => {
    const gameSessionId = gameSessionIdRef.current;
    if (!gameSessionId || telemetryEndedRef.current) {
      return;
    }

    telemetryEndedRef.current = true;
    setTelemetrySnapshot(
      endGameSession({
        gameSessionId,
        roundsPlayed,
      }),
    );
  }, []);

  const handleClearTelemetry = useCallback(() => {
    const gameSessionId = gameSessionIdRef.current;

    if (!gameSessionId || telemetryEndedRef.current) {
      setTelemetrySnapshot(clearTelemetry());
      return;
    }

    clearTelemetry();
    setTelemetrySnapshot(
      startGameSession({
        gameSessionId,
        gameMode,
      }),
    );
  }, [gameMode]);

  const animateDialToValue = useCallback(
    (targetValue: number, durationMs: number): Promise<void> => {
      const startValue = dialValueRef.current;
      const endValue = Math.max(0, Math.min(100, targetValue));

      stopDialAnimation();

      if (durationMs <= 0 || startValue === endValue) {
        setDialValue(endValue);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const startTime = performance.now();

        const animate = (timestamp: number): void => {
          const elapsed = timestamp - startTime;
          const progress = Math.min(1, elapsed / durationMs);
          const easedProgress = easeOutCubic(progress);
          const nextValue = Math.round(startValue + (endValue - startValue) * easedProgress);
          setDialValue(nextValue);

          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
          }

          animationFrameRef.current = null;
          setDialValue(endValue);
          resolve();
        };

        animationFrameRef.current = requestAnimationFrame(animate);
      });
    },
    [stopDialAnimation],
  );

  // Initialize game — runs once on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError(null);
      setAiReasoning(null);

      try {
        const savedSession = loadGameSessionSnapshot();
        if (
          savedSession &&
          savedSession.personality === personality &&
          savedSession.gameMode === gameMode
        ) {
          const gameSessionId = createGameSessionId();
          gameSessionIdRef.current = gameSessionId;
          telemetryEndedRef.current = false;
          setTelemetrySnapshot(
            startGameSession({
              gameSessionId,
              gameMode,
            }),
          );

          setGameState(savedSession.gameState);
          setDialValue(savedSession.dialValue);
          setAiReasoning(savedSession.aiReasoning);
          setHumanClueInput(savedSession.humanClueInput);
          setLoading(false);
          return;
        }

        if (savedSession) {
          clearGameSessionSnapshot();
        }

        const shuffledDeck = await loadShuffledSpectrumDeck();
        let nextState = createInitialGameState({ personality, pointsToWin: 10 });

        if (gameMode === 'coop') {
          nextState = startCoopGame(nextState, { deck: shuffledDeck });
        } else {
          nextState = startGame(nextState, { deck: shuffledDeck, startingPsychicTeam: 'human' });
        }

        if (cancelled) return;

        const gameSessionId = createGameSessionId();
        gameSessionIdRef.current = gameSessionId;
        telemetryEndedRef.current = false;
        setTelemetrySnapshot(
          startGameSession({
            gameSessionId,
            gameMode,
          }),
        );

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
          recordTelemetryUsage(
            nextState.round.roundNumber,
            'clue',
            clueResult.usage,
          );
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
  }, [gameMode, personality]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDialChange = useCallback(
    (value: number) => {
      if (!gameState || gameState.phase !== 'human-guess' || gameState.round?.psychicTeam !== 'ai') {
        return;
      }
      stopDialAnimation();
      setDialValue(value);
    },
    [gameState, stopDialAnimation],
  );

  const handleDialRelease = useCallback(
    (value: number) => {
      if (!gameState || gameState.phase !== 'human-guess' || gameState.round?.psychicTeam !== 'ai') {
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
    if (!gameState || gameState.phase !== 'psychic-clue' || aiThinking) return;
    const trimmedClue = humanClueInput.trim();
    if (trimmedClue.length === 0) return;

    try {
      setError(null);
      setAiThinking(true);
      let nextState = submitPsychicClue(gameState, trimmedClue);

      if (gameMode === 'coop') {
        // Show clue immediately, then let AI visibly place the dial before reveal.
        setSceneTransitionTick((tick) => tick + 1);
        setGameState(nextState);
        setHumanClueInput('');

        const dialResult = await placeDialRef.current({
          card: nextState.round!.card,
          clue: trimmedClue,
          personality,
        });
        recordTelemetryUsage(
          nextState.round!.roundNumber,
          'dial',
          dialResult.usage,
        );

        await animateDialToValue(dialResult.position, AI_DIAL_SWEEP_MS);

        nextState = submitTeamGuess(nextState, dialResult.position);
        setAiReasoning(dialResult.reasoning);
        setGameState(nextState);
        setAiThinking(false);
        return;
      }

      // Competitive flow remains unchanged.
      const dialResult = await placeDialRef.current({
        card: nextState.round!.card,
        clue: trimmedClue,
        personality,
      });
      recordTelemetryUsage(
        nextState.round!.roundNumber,
        'dial',
        dialResult.usage,
      );
      nextState = submitHumanGuess(nextState, dialResult.position);
      setAiReasoning(dialResult.reasoning);
      setSceneTransitionTick((tick) => tick + 1);
      setGameState(nextState);
      setDialValue(dialResult.position);
      setHumanClueInput('');
      setAiThinking(false);
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to process clue.';
      if (gameMode === 'coop') {
        // If AI placement fails, restore the clue step so the user can retry.
        setGameState(gameState);
        setHumanClueInput(trimmedClue);
      }
      setError(message);
      setAiThinking(false);
    }
  }, [
    aiThinking,
    animateDialToValue,
    gameState,
    humanClueInput,
    personality,
    gameMode,
    recordTelemetryUsage,
  ]);

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

  const handleRevealCoopRound = useCallback(() => {
    if (
      !gameState ||
      gameState.mode !== 'coop' ||
      gameState.phase !== 'reveal' ||
      isRevealingTarget
    ) {
      return;
    }

    setError(null);
    setIsRevealingTarget(true);

    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    const revealState = gameState;

    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;

      try {
        const revealed = revealRound(revealState);
        const scored = scoreCoopRound(revealed);
        setGameState(scored);
      } catch (caughtError: unknown) {
        const message =
          caughtError instanceof Error ? caughtError.message : 'Failed to reveal round.';
        setError(message);
      } finally {
        setIsRevealingTarget(false);
      }
    }, COOP_REVEAL_ANIMATION_MS);
  }, [gameState, isRevealingTarget]);

  const handleLockGuess = useCallback(() => {
    if (!gameState || gameState.phase !== 'human-guess') return;

    try {
      if (gameMode === 'coop') {
        // Co-op: lock guess first, then let players manually reveal.
        const withGuess = submitTeamGuess(gameState, dialValueRef.current);
        setGameState(withGuess);
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
    if (roundAdvanceInFlightRef.current) {
      return;
    }

    roundAdvanceInFlightRef.current = true;
    setShowTransition(false);
    try {
      if (!gameState) {
        return;
      }

      if (gameState.phase === 'game-over') {
        finalizeTelemetrySession(gameState.round?.roundNumber ?? 0);
        clearGameSessionSnapshot();
        onGameOverRef.current(gameState);
        return;
      }

      if (gameState.phase !== 'next-round') {
        return;
      }

      let nextState = startNextRound(gameState);

      if (nextState.phase === 'game-over') {
        finalizeTelemetrySession(nextState.round?.roundNumber ?? 0);
        clearGameSessionSnapshot();
        onGameOverRef.current(nextState);
        return;
      }

      setAiReasoning(null);
      setGameState(nextState);
      setDialValue(DEFAULT_DIAL_VALUE);
      stopDialAnimation();
      setIsRevealingTarget(false);

      // If AI is psychic, generate a clue
      if (nextState.round?.psychicTeam === 'ai') {
        setAiThinking(true);
        const clueResult = await generateClueRef.current({
          card: nextState.round.card,
          targetPosition: nextState.round.targetPosition,
          personality,
        });
        recordTelemetryUsage(
          nextState.round.roundNumber,
          'clue',
          clueResult.usage,
        );
        nextState = submitPsychicClue(nextState, clueResult.clue);
        setAiReasoning(clueResult.reasoning);
      }

      setGameState(nextState);
      setAiThinking(false);
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Failed to start next round.';
      setError(message);
      setAiThinking(false);
    } finally {
      roundAdvanceInFlightRef.current = false;
    }
  }, [
    finalizeTelemetrySession,
    gameState,
    personality,
    recordTelemetryUsage,
    stopDialAnimation,
  ]);

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
            onClick={() => {
              clearGameSessionSnapshot();
              window.location.reload();
            }}
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
  const isAwaitingAiClue =
    aiThinking &&
    gameState.phase === 'psychic-clue' &&
    currentRound.psychicTeam === 'ai';
  const isAiReadingHumanClue =
    aiThinking &&
    gameState.phase === 'human-guess' &&
    isHumanPsychic;
  const isRevealed =
    gameState.phase === 'next-round' || gameState.phase === 'game-over';
  const isPsychicPreviewPhase =
    gameState.phase === 'psychic-clue' && isHumanPsychic && !aiThinking;
  const isRevealPhase = gameState.phase === 'reveal';
  const showDial =
    isAwaitingAiClue ||
    isPsychicPreviewPhase ||
    gameState.phase === 'human-guess' ||
    gameState.phase === 'ai-bonus-guess' ||
    isRevealPhase ||
    isRevealed;
  const showScoringZones =
    isPsychicPreviewPhase || isRevealingTarget || isRevealed;
  const dialTargetValue = showScoringZones ? currentRound.targetPosition : null;
  const isDialInteractive =
    gameState.phase === 'human-guess' &&
    currentRound.psychicTeam === 'ai' &&
    !aiThinking;
  const coopRating = gameMode === 'coop' ? getCoopRating(gameState.coopScore) : null;
  const roundContentTransition = prefersReducedMotion
    ? { duration: 0.24, ease: 'easeOut' as const }
    : { duration: 0.36, ease: 'easeOut' as const };
  const roundContentInitial = prefersReducedMotion
    ? { opacity: 0, x: 0 }
    : { opacity: 0, x: 18 };
  const roundContentExit = prefersReducedMotion
    ? { opacity: 0, x: 0 }
    : { opacity: 0, x: -18 };

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
        onCoopScoreClick={
          gameMode === 'coop' ? () => setShowScoreThermometer(true) : undefined
        }
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`round-${currentRound.roundNumber}-scene-${sceneTransitionTick}`}
            className="w-full max-w-sm sm:max-w-[30rem] lg:max-w-[36rem]"
            initial={roundContentInitial}
            animate={{ opacity: 1, x: 0 }}
            exit={roundContentExit}
            transition={roundContentTransition}
          >
            {/* Phase indicator */}
            <motion.div
              className="mb-6 text-center"
              key={`phase-${gameState.phase}-${currentRound.roundNumber}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isAwaitingAiClue ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted" />
                  <p className="text-sm text-ink-muted">
                    {personalityNames[personality]} is thinking of a clue...
                  </p>
                </div>
              ) : isAiReadingHumanClue ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted" />
                  <p className="text-sm text-ink-muted">
                    AI is reading your clue...
                  </p>
                </div>
              ) : gameState.phase === 'psychic-clue' && isHumanPsychic ? (
                <p className="text-sm font-medium text-ink-light">
                  You&apos;re the psychic. Give a clue.
                </p>
              ) : gameState.phase === 'human-guess' ? (
                <p className="text-sm font-medium text-ink-light">
                  {isHumanPsychic
                    ? 'AI is placing the dial...'
                    : 'Place the dial where you think the target is.'}
                </p>
              ) : gameState.phase === 'ai-bonus-guess' && gameMode === 'competitive' ? (
                <p className="text-sm font-medium text-ink-light">
                  Is the real target left or right of the guess?
                </p>
              ) : gameState.phase === 'reveal' && gameMode === 'coop' ? (
                <p className="text-sm font-medium text-ink-light">
                  {isRevealingTarget
                    ? 'Revealing target...'
                    : 'Review the guess, then reveal the target.'}
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
                    {isHumanPsychic ? 'Your clue' : `${personalityNames[personality]}'s clue`}
                  </p>
                  <p className="mt-1 font-serif text-3xl text-ink">
                    {currentRound.clue}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Human clue input (when human is psychic) */}
            {isPsychicPreviewPhase && (
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
                    className="flex-1 rounded-xl border border-warm-200 bg-surface/80 px-4 py-3 text-center text-lg font-medium text-ink placeholder:text-ink-faint focus:border-warm-400 focus:outline-none focus:ring-1 focus:ring-warm-300"
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
            {showDial && (
              <Dial
                value={dialValue}
                leftLabel={currentRound.card.left}
                rightLabel={currentRound.card.right}
                onChange={isDialInteractive ? handleDialChange : undefined}
                onRelease={isDialInteractive ? handleDialRelease : undefined}
                targetValue={dialTargetValue}
                showScoringZones={showScoringZones}
                scoringMode={gameMode}
                interactive={isDialInteractive}
                showDialHand={!isPsychicPreviewPhase && !isAwaitingAiClue}
                showValueLabel={!isPsychicPreviewPhase && !isAwaitingAiClue}
              />
            )}

            {/* Action area */}
            <div className="mt-6 flex justify-center">
              {gameState.phase === 'human-guess' && currentRound.psychicTeam === 'ai' && (
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

              {gameMode === 'coop' && gameState.phase === 'reveal' && (
                <motion.button
                  type="button"
                  onClick={handleRevealCoopRound}
                  disabled={isRevealingTarget}
                  className="rounded-full bg-ink px-8 py-3 text-sm font-medium text-warm-50 transition-all hover:bg-ink-light hover:shadow-glow active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-ink disabled:hover:shadow-none"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {isRevealingTarget ? 'Revealing...' : 'Reveal Target'}
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
                    className="min-h-[44px] rounded-full border border-warm-200 bg-surface/80 px-6 py-3 text-sm font-medium text-ink transition hover:bg-warm-100"
                  >
                    &larr; Left
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHumanBonusGuess('right')}
                    className="min-h-[44px] rounded-full border border-warm-200 bg-surface/80 px-6 py-3 text-sm font-medium text-ink transition hover:bg-warm-100"
                  >
                    Right &rarr;
                  </button>
                </motion.div>
              )}
            </div>

            {gameMode === 'coop' && currentRound.result && isRevealed && (
              <CoopRoundSummary
                result={currentRound.result}
                coopScore={gameState.coopScore}
                isGameOver={gameState.phase === 'game-over'}
                disabled={aiThinking}
                onContinue={() => void handleTransitionDone()}
              />
            )}

            {/* Reasoning panel (after reveal) */}
            {isRevealed && aiReasoning && (
              <div className="mt-6">
                <ReasoningPanel
                  reasoning={aiReasoning}
                  personality={personality}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Round transition overlay */}
      <AnimatePresence>
        {gameMode === 'competitive' && showTransition && gameState.round?.result && (
          <RoundTransition
            result={gameState.round.result}
            isGameOver={gameState.phase === 'game-over'}
            gameMode={gameMode}
            coopScore={gameState.coopScore}
            disabled={aiThinking}
            onDone={() => void handleTransitionDone()}
          />
        )}
      </AnimatePresence>

      <ScoreThermometerModal
        isOpen={gameMode === 'coop' && showScoreThermometer}
        score={gameState.coopScore}
        rating={coopRating ?? ''}
        onClose={() => setShowScoreThermometer(false)}
      />

      <PlaytestUtilityPanel
        settings={playtestSettings}
        telemetry={telemetrySnapshot}
        onSettingsChange={onPlaytestSettingsChange}
        onClearTelemetry={handleClearTelemetry}
      />
    </main>
  );
};
