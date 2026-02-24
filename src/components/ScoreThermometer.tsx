import { motion } from 'framer-motion';

type CoopTier = {
  minScore: number;
  label: string;
};

const COOP_TIERS: CoopTier[] = [
  { minScore: 22, label: 'Psychic for real' },
  { minScore: 19, label: 'Galaxy brain' },
  { minScore: 16, label: 'Same wavelength' },
  { minScore: 13, label: 'You won!' },
  { minScore: 10, label: 'So close' },
  { minScore: 7, label: 'Not bad' },
  { minScore: 4, label: 'Try again' },
  { minScore: 0, label: 'Plugged in?' },
];

// Maximum score for the thermometer scale — 7 cards × 3 pts = 21 base,
// but bonus rounds can push beyond, so we cap the visual at the top tier.
const THERMOMETER_MAX = 25;

type ScoreThermometerProps = {
  score: number;
  /** Delay before fill animation starts (seconds) */
  animationDelay?: number;
};

export const ScoreThermometer = ({
  score,
  animationDelay = 0.4,
}: ScoreThermometerProps) => {
  const clampedScore = Math.min(score, THERMOMETER_MAX);
  const fillPercent = (clampedScore / THERMOMETER_MAX) * 100;

  // Find the achieved tier index (0 = highest)
  const achievedTierIndex = COOP_TIERS.findIndex((t) => score >= t.minScore);
  const achievedTier = achievedTierIndex >= 0 ? achievedTierIndex : COOP_TIERS.length - 1;

  return (
    <div className="flex w-full items-stretch gap-3" role="img" aria-label={`Score: ${score} points`}>
      {/* Tier labels — left side */}
      <div className="flex flex-col-reverse justify-between py-0.5" style={{ minWidth: '5.5rem' }}>
        {COOP_TIERS.slice().reverse().map((tier, visualIndex) => {
          // visualIndex 0 = bottom tier (0 pts), 7 = top tier (22 pts)
          const tierIndex = COOP_TIERS.length - 1 - visualIndex;
          const isAchieved = tierIndex === achievedTier;
          const isPassed = tierIndex > achievedTier;

          return (
            <motion.div
              key={tier.minScore}
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: animationDelay + 0.6 + visualIndex * 0.04,
              }}
            >
              <span
                className={`text-[11px] tabular-nums leading-none ${
                  isAchieved
                    ? 'font-semibold text-ink'
                    : isPassed
                      ? 'font-medium text-ink-light'
                      : 'text-ink-faint'
                }`}
              >
                {tier.minScore}
              </span>
              <span
                className={`truncate text-[11px] leading-none ${
                  isAchieved
                    ? 'font-semibold text-ink'
                    : isPassed
                      ? 'font-medium text-ink-light'
                      : 'text-ink-faint'
                }`}
              >
                {tier.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Thermometer bar — right side */}
      <div className="relative flex-1 overflow-hidden rounded-full" style={{ minHeight: '14rem' }}>
        {/* Track background */}
        <div className="absolute inset-0 rounded-full bg-warm-100/80" />

        {/* Tier separator lines */}
        {COOP_TIERS.map((tier) => {
          const y = 100 - (tier.minScore / THERMOMETER_MAX) * 100;
          if (tier.minScore === 0) return null;
          return (
            <div
              key={tier.minScore}
              className="absolute left-0 right-0 border-t border-warm-200/50"
              style={{ top: `${y}%` }}
            />
          );
        })}

        {/* Fill */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{
            background: 'linear-gradient(to top, rgb(var(--spectrum-left)), rgb(var(--spectrum-mid)), rgb(var(--spectrum-right)), rgb(var(--flux)))',
          }}
          initial={{ height: '0%' }}
          animate={{ height: `${fillPercent}%` }}
          transition={{
            duration: 1.2,
            delay: animationDelay,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        />

        {/* Score marker line */}
        <motion.div
          className="absolute left-0 right-0 flex items-center"
          style={{ bottom: `${fillPercent}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: animationDelay + 1.2 }}
        >
          <div className="h-0.5 w-full bg-surface/90 shadow-sm" />
        </motion.div>
      </div>
    </div>
  );
};
