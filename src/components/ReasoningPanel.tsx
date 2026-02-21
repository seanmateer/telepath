import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Personality } from '../types/game';

type ReasoningPanelProps = {
  reasoning: string;
  personality: Personality;
};

const personalityNames: Record<Personality, string> = {
  lumen: 'Lumen',
  sage: 'Sage',
  flux: 'Flux',
};

export const ReasoningPanel = ({ reasoning, personality }: ReasoningPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-warm-200/60 bg-white/50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-warm-50"
      >
        <span className="text-xs font-medium text-ink-muted">
          {personalityNames[personality]}&apos;s reasoning
        </span>
        <motion.span
          className="text-ink-faint"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 5.25L7 8.75L10.5 5.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="border-t border-warm-200/40 px-4 pb-4 pt-3">
              <p className="text-[13px] leading-relaxed text-ink-light">
                {reasoning}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
