import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';

type SlideToConfirmProps = {
  prompt: string;
  completeLabel: string;
  onComplete: () => boolean | Promise<boolean>;
  disabled?: boolean;
  resetKey?: string | number;
  forceComplete?: boolean;
};

const HANDLE_SIZE_PX = 48;
const TRACK_PADDING_PX = 4;
const COMPLETE_THRESHOLD = 0.82;
const FAST_SWIPE_MIN_RATIO = 0.58;
const FAST_SWIPE_PX_PER_SECOND = 880;
const SNAP_BACK_SPRING = {
  type: 'spring' as const,
  stiffness: 430,
  damping: 36,
  mass: 0.62,
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const SlideToConfirm = ({
  prompt,
  completeLabel,
  onComplete,
  disabled = false,
  resetKey,
  forceComplete = false,
}: SlideToConfirmProps) => {
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const [maxDrag, setMaxDrag] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const progress = useTransform(() => clamp(x.get() / Math.max(maxDrag, 1), 0, 1));

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
    void animate(x, 0, SNAP_BACK_SPRING).finished;
  }, [resetKey, x]);

  useEffect(() => {
    if (!forceComplete) {
      return;
    }

    setIsSubmitting(true);
    void animate(x, maxDrag, {
      duration: prefersReducedMotion ? 0.06 : 0.18,
      ease: 'easeOut',
    }).finished;
  }, [forceComplete, maxDrag, prefersReducedMotion, x]);

  const triggerCompletion = (): void => {
    if (disabled || isSubmitting || maxDrag <= 0) {
      return;
    }

    setIsSubmitting(true);
    void animate(x, maxDrag, {
      duration: prefersReducedMotion ? 0.06 : 0.18,
      ease: 'easeOut',
    }).finished;

    Promise.resolve(onComplete()).then((didComplete) => {
      if (didComplete) {
        return;
      }

      setIsSubmitting(false);
      void animate(x, 0, SNAP_BACK_SPRING).finished;
    }).catch(() => {
      setIsSubmitting(false);
      void animate(x, 0, SNAP_BACK_SPRING).finished;
    });
  };

  const handleDragEnd = (velocityX: number): void => {
    if (disabled || isSubmitting || maxDrag <= 0) {
      return;
    }

    const completionRatio = x.get() / maxDrag;
    const shouldFastComplete =
      velocityX >= FAST_SWIPE_PX_PER_SECOND && completionRatio >= FAST_SWIPE_MIN_RATIO;

    if (completionRatio >= COMPLETE_THRESHOLD || shouldFastComplete) {
      triggerCompletion();
      return;
    }

    void animate(x, 0, SNAP_BACK_SPRING).finished;
  };

  const displayText = isSubmitting || forceComplete ? completeLabel : prompt;
  const isDragDisabled = disabled || isSubmitting || forceComplete;

  return (
    <div className="w-full max-w-xs sm:max-w-sm">
      <div
        ref={trackRef}
        className={`relative select-none overflow-hidden rounded-full border border-warm-200 bg-white/80 p-1 shadow-inner ${
          isDragDisabled ? 'opacity-70' : ''
        }`}
      >
        <div className="pointer-events-none absolute inset-y-1 left-1 right-1 rounded-full bg-gradient-to-r from-warm-100/80 via-white/80 to-warm-50/70" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-1 right-1 origin-left rounded-full bg-gradient-to-r from-sage-light/70 via-sage/65 to-flux-light/70"
          style={{ scaleX: progress }}
        />
        <p className="pointer-events-none relative z-10 px-14 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-light">
          {displayText}
        </p>

        <motion.button
          type="button"
          drag={isDragDisabled ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={(_, info: PanInfo) => handleDragEnd(info.velocity.x)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
              return;
            }

            event.preventDefault();
            triggerCompletion();
          }}
          style={{ x }}
          disabled={isDragDisabled}
          aria-label={`${displayText}. Slide right to confirm.`}
          className="absolute left-1 top-1 z-20 flex h-12 w-12 touch-none items-center justify-center rounded-full bg-ink text-xl text-warm-50 shadow-md ring-1 ring-ink/25 transition hover:bg-ink-light disabled:cursor-default disabled:hover:bg-ink"
          whileTap={isDragDisabled ? undefined : { scale: 0.96 }}
          whileDrag={
            isDragDisabled
              ? undefined
              : {
                scale: 1.04,
                boxShadow: '0 10px 24px rgba(31, 29, 27, 0.18)',
              }
          }
        >
          <span aria-hidden="true" className="translate-x-[1px]">
            &rarr;
          </span>
        </motion.button>
      </div>
    </div>
  );
};
