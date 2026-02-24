import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameState, Personality } from '../types/game';
import { getCoopRating } from '../lib/gameState';
import { ScoreThermometer } from './ScoreThermometer';

type EndScreenProps = {
  gameState: GameState;
  onPlayAgain: () => void;
  onChangePersonality: () => void;
};

const personalityNames: Record<Personality, string> = {
  lumen: 'Lumen',
  sage: 'Sage',
  flux: 'Flux',
};

const personalityTaglines: Record<Personality, string> = {
  lumen: 'The Literal',
  sage: 'The Abstract',
  flux: 'The Chaotic',
};

export const EndScreen = ({
  gameState,
  onPlayAgain,
  onChangePersonality,
}: EndScreenProps) => {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const isCoop = gameState.mode === 'coop';
  const humanWon = gameState.winner === 'human';
  const personality = gameState.settings.personality;
  const roundCount = gameState.round?.roundNumber ?? 0;
  const coopRating = isCoop ? getCoopRating(gameState.coopScore) : null;

  const handleShare = useCallback(async () => {
    const cardEl = shareCardRef.current;
    if (!cardEl) return;

    // Try to use html2canvas dynamically
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardEl, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--canvas-hex').trim() || '#FAF7F2',
        scale: 2,
      });

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          setShareStatus('error');
          return;
        }

        // Try Web Share API first (mobile)
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], 'telepath-score.png', { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Telepath Score',
              });
              setShareStatus('copied');
              return;
            }
          } catch {
            // Fall through to clipboard
          }
        }

        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setShareStatus('copied');
          setTimeout(() => setShareStatus('idle'), 2000);
        } catch {
          setShareStatus('error');
          setTimeout(() => setShareStatus('idle'), 2000);
        }
      }, 'image/png');
    } catch {
      // html2canvas not available — copy text summary instead
      const text = isCoop
        ? `Telepath Co-op: ${gameState.coopScore} pts\n"${coopRating}"\nw/ ${personalityNames[personality]} \u2022 ${roundCount} rounds`
        : `Telepath: ${humanWon ? 'Victory' : 'Defeat'}\n${gameState.scores.human} - ${gameState.scores.ai} vs ${personalityNames[personality]}\n${roundCount} rounds`;
      try {
        await navigator.clipboard.writeText(text);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
      } catch {
        setShareStatus('error');
        setTimeout(() => setShareStatus('idle'), 2000);
      }
    }
  }, [gameState.scores, gameState.coopScore, isCoop, coopRating, humanWon, personality, roundCount]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Result */}
        <div className="text-center">
          <motion.p
            className="font-serif text-4xl text-ink"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.175, 0.885, 0.32, 1.275] }}
          >
            {isCoop ? coopRating : humanWon ? 'You won' : 'AI wins'}
          </motion.p>
        </div>

        {/* Share card */}
        <motion.div
          ref={shareCardRef}
          className="mt-8 overflow-hidden rounded-2xl border border-warm-200/60 bg-surface/70 shadow-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <div className="px-6 pb-6 pt-5">
            {/* Title */}
            <p className="text-center font-serif text-xl text-ink">Telepath</p>

            {isCoop ? (
              <>
                {/* Co-op: score + thermometer */}
                <div className="mt-4 flex items-end gap-4">
                  {/* Score + rating — left */}
                  <div className="flex flex-col items-center" style={{ minWidth: '4.5rem' }}>
                    <motion.p
                      className="text-5xl font-semibold tabular-nums text-ink"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.5, ease: [0.175, 0.885, 0.32, 1.275] }}
                    >
                      {gameState.coopScore}
                    </motion.p>
                    <motion.p
                      className="mt-0.5 text-sm font-medium text-ink-muted"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.7 }}
                    >
                      points
                    </motion.p>
                  </div>

                  {/* Thermometer — right */}
                  <div className="flex-1">
                    <ScoreThermometer score={gameState.coopScore} animationDelay={0.6} />
                  </div>
                </div>

                {/* Rating */}
                <motion.p
                  className="mt-4 text-center font-serif text-lg text-ink-light"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 1.8 }}
                >
                  &ldquo;{coopRating}&rdquo;
                </motion.p>

                {/* Details */}
                <motion.div
                  className="mt-3 flex justify-center gap-4 text-xs text-ink-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 2.0 }}
                >
                  <span>{roundCount} rounds</span>
                  <span>&middot;</span>
                  <span>w/ {personalityNames[personality]}</span>
                </motion.div>
              </>
            ) : (
              <>
                {/* Competitive: head-to-head scores */}
                <div className="mt-5 flex items-center justify-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-semibold tabular-nums text-ink">
                      {gameState.scores.human}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-ink-muted">You</p>
                  </div>
                  <div className="text-ink-faint" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-semibold tabular-nums text-ink">
                      {gameState.scores.ai}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-ink-muted">
                      {personalityNames[personality]}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-5 flex justify-center gap-4 text-xs text-ink-muted">
                  <span>{roundCount} rounds</span>
                  <span>&middot;</span>
                  <span>vs {personalityTaglines[personality]}</span>
                </div>
              </>
            )}
          </div>

          {/* Bottom band */}
          <div className="h-1.5 w-full bg-gradient-to-r from-spectrum-left via-spectrum-mid to-spectrum-right" />
        </motion.div>

        {/* Share button */}
        <motion.button
          type="button"
          onClick={() => void handleShare()}
          className="mt-6 w-full rounded-full border border-warm-200 bg-surface/80 py-3 text-sm font-medium text-ink transition hover:bg-warm-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: isCoop ? 2.2 : 0.55 }}
          whileTap={{ scale: 0.97 }}
        >
          {shareStatus === 'copied'
            ? 'Copied!'
            : shareStatus === 'error'
              ? 'Couldn\u2019t share'
              : 'Share Score'}
        </motion.button>

        {/* Actions */}
        <motion.div
          className="mt-4 flex gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: isCoop ? 2.2 : 0.65 }}
        >
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 rounded-full bg-ink py-3 text-sm font-medium text-warm-50 transition hover:bg-ink-light"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onChangePersonality}
            className="flex-1 rounded-full border border-warm-200 bg-surface/80 py-3 text-sm font-medium text-ink transition hover:bg-warm-100"
          >
            Change AI
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
};
