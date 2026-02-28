import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { GameMode, Personality } from '../types/game';

/* ── Slot-machine digit roller ───────────────────────────────── */

const DIGIT_HEIGHT = 1.25; // em, matches line-height

const SlotDigit = ({ digit }: { digit: number }) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span>{digit}</span>;
  }

  return (
    <span
      className="inline-block overflow-hidden"
      style={{ height: `${DIGIT_HEIGHT}em`, lineHeight: `${DIGIT_HEIGHT}em` }}
    >
      <motion.span
        className="inline-flex flex-col"
        animate={{ y: `${-digit * DIGIT_HEIGHT}em` }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span
            key={d}
            className="block text-center"
            style={{ height: `${DIGIT_HEIGHT}em` }}
            aria-hidden={d !== digit}
          >
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

const SlotMachineNumber = ({ value }: { value: number }) => {
  const digits = String(value).split('');

  return (
    <span className="inline-flex text-lg font-semibold tabular-nums text-ink">
      <AnimatePresence initial={false}>
        {digits.map((d, i) => (
          <motion.span
            key={`pos-${digits.length - i}`}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SlotDigit digit={Number(d)} />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
};

type ScoreBarProps = {
  humanScore: number;
  aiScore: number;
  personality: Personality;
  roundNumber: number;
  pointsToWin: number;
  gameMode: GameMode;
  coopScore: number;
  totalCards: number;
  cardsRemaining: number;
  onCoopScoreClick?: () => void;
};

const personalityNames: Record<Personality, string> = {
  lumen: 'Lumen',
  sage: 'Sage',
  flux: 'Flux',
};

export const ScoreBar = ({
  humanScore,
  aiScore,
  personality,
  roundNumber,
  pointsToWin,
  gameMode,
  coopScore,
  totalCards,
  cardsRemaining,
  onCoopScoreClick,
}: ScoreBarProps) => {
  if (gameMode === 'coop') {
    const scoreDisplay = (
      <div className="flex items-baseline gap-1.5">
        <SlotMachineNumber value={coopScore} />
        <span className="text-xs font-medium text-ink-muted">pts</span>
      </div>
    );

    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
        {/* Team score */}
        {onCoopScoreClick ? (
          <button
            type="button"
            onClick={onCoopScoreClick}
            className="-m-2 min-h-[44px] rounded-lg p-2 text-left transition hover:bg-warm-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-300"
            aria-label={`Open score thermometer (${coopScore} points)`}
            aria-haspopup="dialog"
          >
            {scoreDisplay}
          </button>
        ) : (
          scoreDisplay
        )}

        {/* Round indicator */}
        <motion.div
          className="text-center"
          key={roundNumber}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p className="text-[10px] font-medium uppercase tracking-widest text-ink-faint">
            Round {roundNumber} of {totalCards}
          </p>
          <div className="mt-0.5 flex items-center justify-center gap-1" aria-hidden="true">
            {Array.from({ length: totalCards }).map((_, i) => (
              <div
                key={i}
                className={`h-1 w-1 rounded-full transition-colors duration-300 ${
                  i < roundNumber ? 'bg-ink' : 'bg-ink-faint/30'
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* Partner name */}
        <div className="flex items-baseline justify-end gap-1.5 text-right">
          <span className="text-xs font-medium text-ink-muted">
            w/ {personalityNames[personality]}
          </span>
          <span className="text-[10px] text-ink-faint">
            {cardsRemaining} left
          </span>
        </div>
      </div>
    );
  }

  // Competitive mode
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-ink">
          {humanScore}
        </span>
        <span className="text-xs font-medium text-ink-muted">You</span>
      </div>

      <motion.div
        className="text-center"
        key={roundNumber}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <p className="text-[10px] font-medium uppercase tracking-widest text-ink-faint">
          Round {roundNumber}
        </p>
        <div className="mt-0.5 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: pointsToWin }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-1 rounded-full transition-colors duration-300 ${
                i < Math.max(humanScore, aiScore)
                  ? humanScore > aiScore
                    ? 'bg-ink'
                    : 'bg-ink-muted'
                  : 'bg-ink-faint/30'
              }`}
            />
          ))}
        </div>
      </motion.div>

      <div className="flex items-baseline justify-end gap-1.5">
        <span className="text-xs font-medium text-ink-muted">
          {personalityNames[personality]}
        </span>
        <span className="text-lg font-semibold tabular-nums text-ink">
          {aiScore}
        </span>
      </div>
    </div>
  );
};
