import { motion, useReducedMotion } from 'framer-motion';
import type { ScoreZone } from '../types/game';

type RoundScorePillProps = {
  zone: ScoreZone;
  points: number;
  bonusCardDrawn: boolean;
};

const zoneLabels: Record<ScoreZone, string> = {
  bullseye: 'Bullseye!',
  adjacent: 'Close!',
  outer: 'Almost',
  miss: 'Miss',
};

const zoneTextColors: Record<ScoreZone, string> = {
  bullseye: 'text-score-bullseye',
  adjacent: 'text-score-adjacent',
  outer: 'text-score-outer',
  miss: 'text-score-miss',
};

const zoneBgColors: Record<ScoreZone, string> = {
  bullseye: 'bg-score-bullseye/[0.14]',
  adjacent: 'bg-score-adjacent/[0.14]',
  outer: 'bg-score-outer/[0.14]',
  miss: 'bg-score-miss/[0.14]',
};

export const RoundScorePill = ({
  zone,
  points,
  bonusCardDrawn,
}: RoundScorePillProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 shadow-sm ${zoneBgColors[zone]}`}
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.85 }
      }
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, scale: 1 }
      }
      transition={{
        duration: 0.4,
        ease: prefersReducedMotion
          ? 'easeOut'
          : [0.175, 0.885, 0.32, 1.275],
      }}
    >
      <span className={`font-serif text-lg leading-none ${zoneTextColors[zone]}`}>
        {zoneLabels[zone]}
      </span>
      <span className="text-sm font-semibold leading-none text-ink-muted">
        +{points} pts
      </span>
      {bonusCardDrawn && (
        <span className="text-xs font-semibold leading-none text-score-bullseye">
          +1 bonus!
        </span>
      )}
    </motion.div>
  );
};
