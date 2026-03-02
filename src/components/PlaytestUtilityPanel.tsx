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

const HAIKU_CLUE_LOCK_TOOLTIP_ID = 'haiku-clue-lock-tooltip';
const HAIKU_CLUE_LOCK_TOOLTIP =
  'Locked during MVP so clue generation always uses Haiku while Sonnet costs are being validated. Re-enable model selection in a post-MVP phase.';

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
        className="fixed bottom-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-warm-200 bg-surface/80 text-ink-muted shadow-card backdrop-blur-sm transition hover:bg-warm-100 active:scale-[0.95]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
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
                <div className="flex items-start gap-3 rounded-lg border border-warm-200/60 bg-surface/80 px-3 py-2">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    onChange={() =>
                      onSettingsChange({
                        ...settings,
                        haikuOnlyClues: true,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-warm-300 text-ink opacity-70 focus:ring-warm-300 disabled:cursor-not-allowed"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        Clue generation locked to Haiku
                      </p>
                      <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        MVP
                      </span>
                      <div className="group relative">
                        <button
                          type="button"
                          aria-label="Why clue generation is locked to Haiku"
                          aria-describedby={HAIKU_CLUE_LOCK_TOOLTIP_ID}
                          title={HAIKU_CLUE_LOCK_TOOLTIP}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-warm-200 text-[11px] font-semibold text-ink-muted transition hover:bg-warm-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-300"
                        >
                          i
                        </button>
                        <div
                          id={HAIKU_CLUE_LOCK_TOOLTIP_ID}
                          role="tooltip"
                          className="pointer-events-none invisible absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-warm-200 bg-surface px-3 py-2 text-[11px] leading-relaxed text-ink-light opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                        >
                          {HAIKU_CLUE_LOCK_TOOLTIP}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Cheaper clue calls for MVP ship testing. Sonnet clue generation is intentionally unavailable for now.
                    </p>
                  </div>
                </div>

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
