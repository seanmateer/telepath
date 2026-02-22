import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { PlaytestUtilityPanel } from './PlaytestUtilityPanel';
import { clearTelemetry, loadTelemetrySnapshot } from '../lib/playtestTelemetry';
import type { GameMode, Personality } from '../types/game';
import type { PlaytestSettings } from '../types/playtest';

type SetupScreenProps = {
  onStart: (personality: Personality) => void;
  gameMode: GameMode;
  playtestSettings: PlaytestSettings;
  onPlaytestSettingsChange: (settings: PlaytestSettings) => void;
};

type PersonalityOption = {
  id: Personality;
  name: string;
  tagline: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  selectedBorder: string;
};

const personalities: PersonalityOption[] = [
  {
    id: 'lumen',
    name: 'Lumen',
    tagline: 'The Literal',
    description: 'Precise and grounded. Clues based on direct properties. Best for new players.',
    color: 'text-lumen',
    bgColor: 'bg-lumen-light',
    borderColor: 'border-lumen/20',
    selectedBorder: 'border-lumen',
  },
  {
    id: 'sage',
    name: 'Sage',
    tagline: 'The Abstract',
    description: 'Poetic and metaphorical. Leads with emotional connections. Harder to read.',
    color: 'text-sage',
    bgColor: 'bg-sage-light',
    borderColor: 'border-sage/20',
    selectedBorder: 'border-sage',
  },
  {
    id: 'flux',
    name: 'Flux',
    tagline: 'The Chaotic',
    description: 'Unpredictable and bold. Mixes styles freely. Highest variance.',
    color: 'text-flux',
    bgColor: 'bg-flux-light',
    borderColor: 'border-flux/20',
    selectedBorder: 'border-flux',
  },
];

export const SetupScreen = ({
  onStart,
  gameMode,
  playtestSettings,
  onPlaytestSettingsChange,
}: SetupScreenProps) => {
  const [selected, setSelected] = useState<Personality>('lumen');
  const [telemetrySnapshot, setTelemetrySnapshot] = useState(() =>
    loadTelemetrySnapshot(),
  );

  const handleClearTelemetry = useCallback(() => {
    setTelemetrySnapshot(clearTelemetry());
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h2 className="font-serif text-3xl tracking-tight text-ink">
          {gameMode === 'coop' ? 'Choose your partner' : 'Choose your opponent'}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Each AI has a different way of thinking.
        </p>

        <div className="mt-8 space-y-3">
          {personalities.map((p, index) => (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`w-full rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                selected === p.id
                  ? `${p.bgColor} ${p.selectedBorder} shadow-card`
                  : `bg-white/60 ${p.borderColor} hover:bg-white/80`
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + index * 0.08, ease: 'easeOut' }}
              whileTap={{ scale: 0.985 }}
            >
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-semibold ${p.color}`}>
                  {p.name}
                </span>
                <span className="text-xs font-medium text-ink-muted">
                  {p.tagline}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-light">
                {p.description}
              </p>
            </motion.button>
          ))}
        </div>

        <motion.button
          type="button"
          onClick={() => onStart(selected)}
          className="mt-8 w-full rounded-full bg-ink py-3.5 text-sm font-medium tracking-wide text-warm-50 transition-all hover:bg-ink-light hover:shadow-glow active:scale-[0.97]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
          whileTap={{ scale: 0.97 }}
        >
          Start Game
        </motion.button>
      </motion.div>

      <PlaytestUtilityPanel
        settings={playtestSettings}
        telemetry={telemetrySnapshot}
        onSettingsChange={onPlaytestSettingsChange}
        onClearTelemetry={handleClearTelemetry}
      />
    </main>
  );
};
