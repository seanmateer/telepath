import { motion } from 'framer-motion';
import type { GameMode, Personality } from '../types/game';

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
}: ScoreBarProps) => {
  if (gameMode === 'coop') {
    return (
      <div className="flex items-center justify-between py-2">
        {/* Team score */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tabular-nums text-ink">
            {coopScore}
          </span>
          <span className="text-xs font-medium text-ink-muted">pts</span>
        </div>

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
          <div className="mt-0.5 flex items-center gap-1" aria-hidden="true">
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
        <div className="flex items-baseline gap-1.5 text-right">
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
    <div className="flex items-center justify-between py-2">
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

      <div className="flex items-baseline gap-1.5">
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
