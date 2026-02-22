import { motion } from 'framer-motion';
import type { RoundResult, ScoreZone } from '../types/game';

type CoopRoundSummaryProps = {
  result: RoundResult;
  coopScore: number;
  isGameOver: boolean;
  onContinue: () => void;
};

const zoneLabels: Record<ScoreZone, string> = {
  bullseye: 'Bullseye!',
  adjacent: 'Close!',
  outer: 'Almost',
  miss: 'Miss',
};

const zoneColors: Record<ScoreZone, string> = {
  bullseye: 'text-score-bullseye',
  adjacent: 'text-score-adjacent',
  outer: 'text-score-outer',
  miss: 'text-score-miss',
};

export const CoopRoundSummary = ({
  result,
  coopScore,
  isGameOver,
  onContinue,
}: CoopRoundSummaryProps) => {
  const zone = result.score.zone;
  const basePoints = result.score.basePoints;
  const bonusCardDrawn = result.bonusCardDrawn === true;

  return (
    <motion.section
      className="mt-6 rounded-2xl border border-warm-200/70 bg-white/75 px-5 py-5 text-center shadow-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className={`font-serif text-3xl ${zoneColors[zone]}`}>
        {zoneLabels[zone]}
      </p>
      <div className="mt-3 flex items-baseline justify-center gap-1">
        <span className="text-4xl font-semibold tabular-nums text-ink">
          +{basePoints}
        </span>
        <span className="text-sm text-ink-muted">pts</span>
      </div>
      {bonusCardDrawn && (
        <p className="mt-2 text-sm font-medium text-score-bullseye">
          +1 bonus round!
        </p>
      )}
      <p className="mt-2 text-sm text-ink-muted">
        Total: {coopScore} pts
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-4 min-h-[44px] w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-warm-50 transition hover:bg-ink-light"
      >
        {isGameOver ? 'See Results' : 'Next Round'}
      </button>
    </motion.section>
  );
};
