import { useCallback, useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  animate,
} from 'framer-motion';
import { triggerHapticPulse } from '../lib/haptics';

type SlideToRevealProps = {
  onComplete: () => void;
  disabled?: boolean;
};

const THUMB_SIZE = 44;
const TRACK_PADDING = 4;
const COMPLETION_THRESHOLD = 0.85;

export function SlideToReveal({ onComplete, disabled = false }: SlideToRevealProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const passedHalfRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);

  const x = useMotionValue(0);
  const maxTravel = Math.max(trackWidth - THUMB_SIZE - TRACK_PADDING * 2, 0);

  // Derived values
  const fillWidth = useTransform(x, [0, maxTravel], [THUMB_SIZE, trackWidth]);
  const fillOpacity = useTransform(x, [0, maxTravel], [0.1, 0.45]);
  const labelOpacity = useTransform(x, [0, maxTravel * 0.4], [1, 0]);

  // Measure track width
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(([entry]) => {
      setTrackWidth(entry.contentRect.width);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // Reset on re-mount or when disabled changes
  useEffect(() => {
    completedRef.current = false;
    passedHalfRef.current = false;
    x.set(0);
  }, [disabled, x]);

  const handleDragEnd = useCallback(() => {
    if (completedRef.current || disabled || maxTravel <= 0) return;

    const progress = x.get() / maxTravel;

    if (progress >= COMPLETION_THRESHOLD) {
      // Snap to end, then trigger after animation completes
      completedRef.current = true;
      triggerHapticPulse(15);
      animate(x, maxTravel, {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        onComplete: onComplete,
      });
    } else {
      // Spring back
      passedHalfRef.current = false;
      animate(x, 0, {
        type: 'spring',
        stiffness: 400,
        damping: 30,
      });
    }
  }, [disabled, maxTravel, onComplete, x]);

  // Haptic at 50% threshold
  useEffect(() => {
    const unsubscribe = x.on('change', (latest) => {
      if (maxTravel <= 0 || completedRef.current) return;
      const progress = latest / maxTravel;
      if (progress >= 0.5 && !passedHalfRef.current) {
        passedHalfRef.current = true;
        triggerHapticPulse(8);
      } else if (progress < 0.4) {
        passedHalfRef.current = false;
      }
    });
    return unsubscribe;
  }, [maxTravel, x]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || completedRef.current) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        completedRef.current = true;
        if (!reducedMotion) {
          animate(x, maxTravel, {
            type: 'spring',
            stiffness: 300,
            damping: 25,
          });
        }
        triggerHapticPulse(15);
        onComplete();
      }
    },
    [disabled, maxTravel, onComplete, reducedMotion, x],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="w-full max-w-xs"
    >
      <div
        ref={trackRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Slide to reveal the target position"
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        className="relative flex h-[52px] items-center overflow-hidden rounded-full border border-warm-200/60 bg-warm-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        style={{ touchAction: 'none' }}
      >
        {/* Fill gradient */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
          style={{
            width: fillWidth,
            opacity: fillOpacity,
            background: 'linear-gradient(90deg, rgb(var(--spectrum-left)), rgb(var(--spectrum-mid)))',
          }}
        />

        {/* Label */}
        <motion.span
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-sm font-medium text-warm-400"
          style={{ opacity: labelOpacity }}
        >
          Slide to reveal
        </motion.span>

        {/* Thumb */}
        <motion.div
          drag={disabled || completedRef.current ? false : 'x'}
          dragConstraints={{ left: 0, right: maxTravel }}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          className="relative z-10 flex cursor-grab items-center justify-center rounded-full bg-ink text-warm-50 shadow-card active:cursor-grabbing"
          style={{ x, width: THUMB_SIZE, height: THUMB_SIZE, marginLeft: TRACK_PADDING }}
          whileTap={{ scale: 1.05 }}
        >
          {/* Ambient pulse */}
          {!reducedMotion && !disabled && (
            <motion.div
              className="absolute inset-0 rounded-full bg-ink"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
          {/* Chevron icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            className="relative z-10"
          >
            <path
              d="M7 4.5L11.5 9L7 13.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}
