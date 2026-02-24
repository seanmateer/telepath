import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  PlaytestSettings,
  TelemetryGameSummary,
  TelemetryRoundSummary,
  TelemetrySnapshot,
} from '../types/playtest.js';

type PlaytestUtilityPanelProps = {
  settings: PlaytestSettings;
  telemetry: TelemetrySnapshot;
  onSettingsChange: (nextSettings: PlaytestSettings) => void;
  onClearTelemetry: () => void;
};

const formatUsd = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }

  const precision = value < 0.01 ? 4 : 2;
  return `$${value.toFixed(precision)}`;
};

const formatTimestamp = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatCostLabel = (
  estimatedUsd: number | null,
  unknownEstimateCount: number,
): string => {
  if (unknownEstimateCount > 0 && estimatedUsd !== null) {
    return `${formatUsd(estimatedUsd)} + unknown`;
  }

  if (unknownEstimateCount > 0) {
    return 'unknown';
  }

  return formatUsd(estimatedUsd);
};

const summarizeGame = (game: TelemetryGameSummary): string => {
  return `${game.aiCalls} calls · ${game.inputTokens} in / ${game.outputTokens} out`;
};

const summarizeRound = (round: TelemetryRoundSummary): string => {
  return `${round.aiCalls} calls (${round.clueCalls} clue, ${round.dialCalls} dial)`;
};

const getRoundModeLabel = (round: TelemetryRoundSummary): string => {
  if (round.modelMode === 'haiku-only') {
    return 'Haiku only';
  }
  if (round.modelMode === 'dual-models') {
    return 'Dual models';
  }
  return 'Unknown mode';
};

type TelemetryGameAccordionProps = {
  game: TelemetryGameSummary;
  rounds: TelemetryRoundSummary[];
  defaultOpen?: boolean;
  showCurrentBadge?: boolean;
};

const TelemetryGameAccordion = ({
  game,
  rounds,
  defaultOpen = false,
  showCurrentBadge = false,
}: TelemetryGameAccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen, game.gameSessionId]);

  const roundsAscending = useMemo(() => {
    return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  }, [rounds]);

  return (
    <div className="overflow-hidden rounded-lg border border-warm-200/60 bg-surface/80">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full min-h-[44px] items-center justify-between px-3 py-2 text-left transition hover:bg-warm-50"
      >
        <div>
          <p className="text-xs font-medium text-ink">
            {formatTimestamp(game.startedAtMs)} · {game.gameMode === 'coop' ? 'Co-op' : 'Competitive'} · {game.roundsPlayed} rounds
            {showCurrentBadge && (
              <span className="ml-2 rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                Current
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-light">
            {summarizeGame(game)} · Est. {formatCostLabel(game.estimatedUsd, game.unknownEstimateCount)}
          </p>
        </div>
        <motion.span
          className="text-ink-faint"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3.5 5.25L7 8.75L10.5 5.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="space-y-1.5 border-t border-warm-200/50 px-3 py-2">
              {roundsAscending.length === 0 ? (
                <p className="text-xs text-ink-faint">No round telemetry yet.</p>
              ) : (
                roundsAscending.map((round) => (
                  <div
                    key={round.id}
                    className="rounded-md border border-warm-200/50 bg-surface/70 px-2 py-1.5 text-xs text-ink-light"
                  >
                    <p className="font-medium text-ink">
                      Round {round.roundNumber} · {summarizeRound(round)}
                      <span className="ml-2 rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                        {getRoundModeLabel(round)}
                      </span>
                    </p>
                    <p className="mt-0.5">
                      {round.inputTokens} in / {round.outputTokens} out · Est. {formatCostLabel(round.estimatedUsd, round.unknownEstimateCount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PlaytestUtilityPanel = ({
  settings,
  telemetry,
  onSettingsChange,
  onClearTelemetry,
}: PlaytestUtilityPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const recentGames = useMemo(() => telemetry.recentGames.slice(0, 10), [telemetry.recentGames]);
  const storedGamesSummary = useMemo(() => {
    const aggregate = recentGames.reduce(
      (summary, game) => {
        return {
          games: summary.games + 1,
          aiCalls: summary.aiCalls + game.aiCalls,
          inputTokens: summary.inputTokens + game.inputTokens,
          outputTokens: summary.outputTokens + game.outputTokens,
          estimatedUsd: summary.estimatedUsd + (game.estimatedUsd ?? 0),
          knownEstimateCount:
            summary.knownEstimateCount + (game.estimatedUsd === null ? 0 : 1),
          unknownEstimateCount:
            summary.unknownEstimateCount + game.unknownEstimateCount,
        };
      },
      {
        games: 0,
        aiCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedUsd: 0,
        knownEstimateCount: 0,
        unknownEstimateCount: 0,
      },
    );

    return {
      ...aggregate,
      estimatedUsd:
        aggregate.knownEstimateCount > 0 ? aggregate.estimatedUsd : null,
    };
  }, [recentGames]);
  const roundsByGame = useMemo(() => {
    const grouped = new Map<string, TelemetryRoundSummary[]>();

    for (const round of telemetry.recentRounds) {
      const existing = grouped.get(round.gameSessionId);
      if (existing) {
        existing.push(round);
      } else {
        grouped.set(round.gameSessionId, [round]);
      }
    }

    return grouped;
  }, [telemetry.recentRounds]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open playtest utilities"
        className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-warm-300 bg-surface/90 text-ink shadow-card transition hover:bg-warm-100 active:scale-[0.97]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="m19.4 13.5 1.4-1.5-1.4-1.5-2 .1a6.6 6.6 0 0 0-.8-1.8l1.2-1.6-2.1-2.1-1.6 1.2a6.7 6.7 0 0 0-1.8-.8l.1-2H11l.1 2a6.7 6.7 0 0 0-1.8.8L7.7 4.1 5.6 6.2l1.2 1.6a6.6 6.6 0 0 0-.8 1.8l-2-.1L2.6 12l1.4 1.5 2-.1c.2.6.4 1.2.8 1.8l-1.2 1.6 2.1 2.1 1.6-1.2c.6.4 1.2.6 1.8.8l-.1 2h3l-.1-2c.6-.2 1.2-.4 1.8-.8l1.6 1.2 2.1-2.1-1.2-1.6c.4-.6.6-1.2.8-1.8l2 .1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-warm-200 bg-warm-50 p-4 shadow-card"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-ink-muted">
                  Playtest Utilities
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-warm-300 bg-surface text-ink transition hover:bg-warm-100"
                  aria-label="Close playtest utilities"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2 2l8 8M10 2 2 10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 rounded-lg border border-warm-200/60 bg-surface/80 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={settings.haikuOnlyClues}
                    onChange={(event) =>
                      onSettingsChange({
                        ...settings,
                        haikuOnlyClues: event.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-warm-300 text-ink focus:ring-warm-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">Use Haiku for clue generation</p>
                    <p className="text-xs text-ink-muted">
                      Reduces playtest costs with lower-cost clue model; quality may vary.
                    </p>
                  </div>
                </label>

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    Stored Games Total
                  </h4>
                  <div className="mt-2 rounded-lg border border-warm-200/60 bg-surface/80 px-3 py-2 text-xs text-ink-light">
                    <p className="font-medium text-ink">
                      {storedGamesSummary.games} games · {storedGamesSummary.aiCalls} calls
                    </p>
                    <p className="mt-1">
                      {storedGamesSummary.inputTokens} in / {storedGamesSummary.outputTokens} out
                    </p>
                    <p className="mt-1">
                      Est. cost: {formatCostLabel(
                        storedGamesSummary.estimatedUsd,
                        storedGamesSummary.unknownEstimateCount,
                      )}
                    </p>
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    Current Game
                  </h4>
                  {telemetry.currentGame ? (
                    <div className="mt-2">
                      <TelemetryGameAccordion
                        game={telemetry.currentGame}
                        rounds={
                          roundsByGame.get(telemetry.currentGame.gameSessionId) ?? []
                        }
                        defaultOpen
                        showCurrentBadge
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-faint">No active game telemetry.</p>
                  )}
                </section>

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    Recent Games
                  </h4>
                  {recentGames.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-faint">No completed games yet.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {recentGames.map((game) => (
                        <TelemetryGameAccordion
                          key={game.gameSessionId}
                          game={game}
                          rounds={roundsByGame.get(game.gameSessionId) ?? []}
                          defaultOpen={false}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <button
                  type="button"
                  onClick={onClearTelemetry}
                  className="w-full rounded-full border border-warm-300 bg-surface py-2 text-xs font-medium text-ink transition hover:bg-warm-100"
                >
                  Clear telemetry
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
