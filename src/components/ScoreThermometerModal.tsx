import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScoreThermometer } from './ScoreThermometer';

type ScoreThermometerModalProps = {
  isOpen: boolean;
  score: number;
  rating: string;
  onClose: () => void;
};

export const ScoreThermometerModal = ({
  isOpen,
  score,
  rating,
  onClose,
}: ScoreThermometerModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="score-thermometer-title"
            className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-warm-200 bg-warm-50 p-4 shadow-card sm:p-5"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                  Score Thermometer
                </p>
                <h2 id="score-thermometer-title" className="mt-1 font-serif text-3xl text-ink">
                  {score} points
                </h2>
                <p className="mt-1 text-sm text-ink-muted">{rating}</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-warm-300 bg-surfacetext-ink transition hover:bg-warm-100"
                aria-label="Close score thermometer"
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

            <div className="mt-4 rounded-xl border border-warm-200/60 bg-surface/75 p-3 sm:p-4">
              <ScoreThermometer score={score} animationDelay={0.15} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
