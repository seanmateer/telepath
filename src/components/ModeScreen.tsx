import { motion } from 'framer-motion';
import type { GameMode } from '../types/game';

type ModeScreenProps = {
  onSelectMode: (mode: GameMode) => void;
};

type ModeOption = {
  id: GameMode;
  name: string;
  tagline: string;
  description: string;
  enabled: boolean;
  badge?: string;
};

const modes: ModeOption[] = [
  {
    id: 'coop',
    name: 'Co-op',
    tagline: 'You & AI are teammates',
    description:
      'Take turns as the psychic. Give clues and read each other\u2019s minds to score together.',
    enabled: true,
  },
  {
    id: 'competitive',
    name: 'Competitive',
    tagline: 'Humans vs. AI',
    description:
      'Go head-to-head against the AI. Two teams, alternating psychics, first to 10 wins.',
    enabled: false,
    badge: 'Coming in 1.0',
  },
];

export const ModeScreen = ({ onSelectMode }: ModeScreenProps) => {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          Choose a mode
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          How do you want to play?
        </p>

        <div className="mt-8 space-y-3">
          {modes.map((mode, index) => (
            <motion.button
              key={mode.id}
              type="button"
              onClick={() => mode.enabled && onSelectMode(mode.id)}
              disabled={!mode.enabled}
              className={`relative w-full rounded-2xl border-2 px-5 py-4 text-left transition-colors transition-shadow ${
                mode.enabled
                  ? 'border-warm-300 bg-surface/60 hover:bg-surface/80 hover:border-warm-400 hover:shadow-card'
                  : 'cursor-not-allowed border-warm-200/40 bg-warm-50/30 opacity-60'
              }`}
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform, opacity',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.15 + index * 0.08,
                ease: 'easeOut',
              }}
              whileTap={mode.enabled ? { scale: 0.985 } : undefined}
            >
              {mode.badge && (
                <span className="absolute right-4 top-4 rounded-full bg-warm-200/60 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                  {mode.badge}
                </span>
              )}
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-ink">
                  {mode.name}
                </span>
                <span className="text-xs font-medium text-ink-muted">
                  {mode.tagline}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-light">
                {mode.description}
              </p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </main>
  );
};
