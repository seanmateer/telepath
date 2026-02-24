import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';

type SlideToConfirmProps = {
  prompt: string;
  completeLabel: string;
  onComplete: () => boolean | Promise<boolean>;
  disabled?: boolean;
  resetKey?: string | number;
};

const HANDLE_SIZE_PX = 44;
const TRACK_PADDING_PX = 4;
const COMPLETE_THRESHOLD = 0.9;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const SlideToConfirm = ({
  prompt,
  completeLabel,
  onComplete,
  disabled = false,
  resetKey,
}: SlideToConfirmProps) => {
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const [maxDrag, setMaxDrag] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) {
      return;
    }

    const measure = (): void => {
      const nextMaxDrag = Math.max(
        0,
        element.clientWidth - HANDLE_SIZE_PX - TRACK_PADDING_PX * 2,
      );

      setMaxDrag(nextMaxDrag);
      x.set(clamp(x.get(), 0, nextMaxDrag));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [x]);

  useEffect(() => {
    setIsSubmitting(false);
    void animate(x, 0, {
      type: 'spring',
      stiffness: 560,
      damping: 34,
      mass: 0.45,
    }).finished;
  }, [resetKey, x]);

  const handleDragEnd = (): void => {
    if (disabled || isSubmitting || maxDrag <= 0) {
      return;
    }

    const completionRatio = x.get() / maxDrag;

    if (completionRatio >= COMPLETE_THRESHOLD) {
      setIsSubmitting(true);

      void animate(x, maxDrag, {
        duration: prefersReducedMotion ? 0.06 : 0.14,
        ease: 'easeOut',
      }).finished.then(() => {
        Promise.resolve(onComplete()).then((didComplete) => {
          if (didComplete) {
            return;
          }

          setIsSubmitting(false);
          void animate(x, 0, {
            type: 'spring',
            stiffness: 560,
            damping: 34,
            mass: 0.45,
          }).finished;
        });
      });

      return;
    }

    void animate(x, 0, {
      type: 'spring',
      stiffness: 560,
      damping: 34,
      mass: 0.45,
    }).finished;
  };

  const displayText = isSubmitting ? completeLabel : prompt;
  const isDragDisabled = disabled || isSubmitting;

  return (
    <div className="w-full max-w-xs sm:max-w-sm">
      <div
        ref={trackRef}
        className={`relative overflow-hidden rounded-full border border-warm-200 bg-white/80 p-1 shadow-inner ${
          isDragDisabled ? 'opacity-70' : ''
        }`}
      >
        <div className="pointer-events-none absolute inset-y-1 left-1 right-1 rounded-full bg-gradient-to-r from-warm-100/80 via-white/80 to-warm-50/70" />
        <p className="pointer-events-none relative z-10 px-14 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-light">
          {displayText}
        </p>

        <motion.button
          type="button"
          drag={isDragDisabled ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x }}
          disabled={isDragDisabled}
          aria-label={`${displayText}. Slide right to confirm.`}
          className="absolute left-1 top-1 z-20 flex h-11 w-11 touch-pan-x items-center justify-center rounded-full bg-ink text-xl text-warm-50 shadow-md ring-1 ring-ink/25 transition hover:bg-ink-light disabled:cursor-default disabled:hover:bg-ink"
          whileTap={isDragDisabled ? undefined : { scale: 0.96 }}
        >
          <span aria-hidden="true" className="translate-x-[1px]">
            &rarr;
          </span>
        </motion.button>
      </div>
    </div>
  );
};
