import { motion } from 'framer-motion';
import type { GameMode, RoundResult } from '../types/game';

type RoundTransitionProps = {
  result: RoundResult;
  isGameOver: boolean;
  gameMode: GameMode;
  coopScore: number;
  onDone: () => void;
};

const zoneLabels: Record<string, string> = {
  bullseye: 'Bullseye!',
  adjacent: 'Close!',
  outer: 'Almost',
  miss: 'Miss',
};

const zoneColors: Record<string, string> = {
  bullseye: 'text-score-bullseye',
  adjacent: 'text-score-adjacent',
  outer: 'text-score-outer',
  miss: 'text-score-miss',
};

export const RoundTransition = ({ result, isGameOver, gameMode, coopScore, onDone }: RoundTransitionProps) => {
  const zone = result.score.zone;
  const basePoints = result.score.basePoints;
  const bonusCorrect = result.score.bonusCorrect;
  const isCoop = gameMode === 'coop';
  const bonusCardDrawn = result.bonusCardDrawn === true;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col items-center px-6 text-center"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
      >
        {/* Score zone */}
        <motion.p
          className={`font-serif text-4xl ${zoneColors[zone]}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }}
        >
          {zoneLabels[zone]}
        </motion.p>

        {/* Points */}
        <motion.div
          className="mt-4 flex items-baseline gap-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <span className="text-5xl font-semibold tabular-nums text-ink">
            +{basePoints}
          </span>
          <span className="text-lg text-ink-muted">pts</span>
        </motion.div>

        {/* Co-op bonus card drawn */}
        {isCoop && bonusCardDrawn && (
          <motion.p
            className="mt-2 text-sm font-medium text-score-bullseye"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.65 }}
          >
            +1 bonus round!
          </motion.p>
        )}

        {/* Competitive bonus */}
        {!isCoop && bonusCorrect && (
          <motion.p
            className="mt-2 text-sm font-medium text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.65 }}
          >
            +1 bonus point
          </motion.p>
        )}

        {/* Co-op running total */}
        {isCoop && (
          <motion.p
            className="mt-3 text-sm text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            Total: {coopScore} pts
          </motion.p>
        )}

        {/* Continue button */}
        <motion.button
          type="button"
          onClick={onDone}
          className="mt-8 rounded-full bg-ink px-8 py-3 text-sm font-medium text-warm-50 transition hover:bg-ink-light"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.8 }}
          whileTap={{ scale: 0.97 }}
        >
          {isGameOver ? 'See Results' : 'Next Round'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
