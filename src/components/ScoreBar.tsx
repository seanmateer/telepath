import { motion } from 'framer-motion';
import type { Personality } from '../types/game';

type ScoreBarProps = {
  humanScore: number;
  aiScore: number;
  personality: Personality;
  roundNumber: number;
  pointsToWin: number;
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
}: ScoreBarProps) => {
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
