import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DIAL_ARC_END_DEGREES,
  DIAL_ARC_START_DEGREES,
  clampDialValue,
  pointOnCircle,
  pointerValueFromCenter,
  valueToDialAngle,
} from '../lib/dialMath.js';
import { triggerHapticPulse } from '../lib/haptics.js';

type DialProps = {
  value: number;
  leftLabel: string;
  rightLabel: string;
  size?: number;
  onChange?: (value: number) => void;
  onRelease?: (value: number) => void;
  revealValue?: number | null;
};

const createArcPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = pointOnCircle(centerX, centerY, radius, startAngle);
  const end = pointOnCircle(centerX, centerY, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

export const Dial = ({
  value,
  leftLabel,
  rightLabel,
  size = 320,
  onChange,
  onRelease,
  revealValue = null,
}: DialProps) => {
  const dialRef = useRef<HTMLDivElement | null>(null);
  const latestValueRef = useRef<number>(clampDialValue(value));
  const lastHapticBucketRef = useRef<number | null>(null);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const clampedValue = clampDialValue(value);
  const dialAngle = valueToDialAngle(clampedValue);

  const center = size / 2;
  const outerRadius = size * 0.38;
  const markerRadius = size * 0.26;
  const dialMarker = pointOnCircle(center, center, markerRadius, dialAngle);
  const revealMarker =
    revealValue === null
      ? null
      : pointOnCircle(
          center,
          center,
          markerRadius,
          valueToDialAngle(clampDialValue(revealValue)),
        );
  const arcPath = createArcPath(
    center,
    center,
    outerRadius,
    DIAL_ARC_START_DEGREES,
    DIAL_ARC_END_DEGREES,
  );

  useEffect(() => {
    latestValueRef.current = clampedValue;
  }, [clampedValue]);

  const triggerHaptic = useCallback(
    (value: number, force = false): void => {
      const bucket = Math.round(value / 10);
      if (!force && lastHapticBucketRef.current === bucket) {
        return;
      }

      lastHapticBucketRef.current = bucket;
      triggerHapticPulse(8);
    },
    [],
  );

  const updateFromMousePosition = useCallback(
    (clientX: number, clientY: number, inputType: 'mouse' | 'touch'): void => {
      const dialElement = dialRef.current;
      if (!dialElement) {
        return;
      }

      const rect = dialElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const nextValue = Math.round(
        pointerValueFromCenter(clientX, clientY, centerX, centerY),
      );

      if (onChange) {
        onChange(nextValue);
      }
      latestValueRef.current = nextValue;

      if (inputType === 'touch') {
        triggerHaptic(nextValue);
      }
    },
    [onChange, triggerHaptic],
  );

  useEffect(() => {
    if (!isMouseDragging) {
      return;
    }

    const handleMouseMove = (event: MouseEvent): void => {
      updateFromMousePosition(event.clientX, event.clientY, 'mouse');
    };

    const handleMouseUp = (): void => {
      setIsMouseDragging(false);
      if (onRelease) {
        onRelease(latestValueRef.current);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMouseDragging, onRelease, updateFromMousePosition]);

  useEffect(() => {
    if (!isTouchDragging) {
      return;
    }

    const handleTouchMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      event.preventDefault();
      updateFromMousePosition(touch.clientX, touch.clientY, 'touch');
    };

    const handleTouchEnd = (): void => {
      triggerHaptic(latestValueRef.current, true);
      setIsTouchDragging(false);
      if (onRelease) {
        onRelease(latestValueRef.current);
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isTouchDragging, onRelease, triggerHaptic, updateFromMousePosition]);

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsMouseDragging(true);
    updateFromMousePosition(event.clientX, event.clientY, 'mouse');
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>): void => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    lastHapticBucketRef.current = null;
    setIsTouchDragging(true);
    updateFromMousePosition(touch.clientX, touch.clientY, 'touch');
  };

  return (
    <section className="mx-auto w-full max-w-[390px] rounded-2xl border border-warm-200/60 bg-white/50 p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-ink-muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div
        ref={dialRef}
        role="slider"
        aria-label={`Dial between ${leftLabel} and ${rightLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedValue)}
        tabIndex={0}
        className={`relative mx-auto aspect-square w-full max-w-[320px] touch-none ${
          isMouseDragging || isTouchDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full"
          aria-label="Telepath dial scaffold"
          role="img"
        >
          <defs>
            <linearGradient id="dial-spectrum" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="52%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          <path
            d={arcPath}
            fill="none"
            stroke="#fcd9be"
            strokeWidth={22}
            strokeLinecap="round"
          />
          <path
            d={arcPath}
            fill="none"
            stroke="url(#dial-spectrum)"
            strokeWidth={16}
            strokeLinecap="round"
          />

          <circle
            cx={center}
            cy={center}
            r={size * 0.16}
            fill="#FDF8F0"
            stroke="#E5C9A0"
            strokeWidth={1.5}
          />
          <circle cx={dialMarker.x} cy={dialMarker.y} r={9} fill="#2C2418" />
          <AnimatePresence>
            {revealMarker ? (
              <motion.circle
                key="reveal-target"
                cx={revealMarker.x}
                cy={revealMarker.y}
                r={8}
                fill="#22C55E"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.2 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{ transformOrigin: `${revealMarker.x}px ${revealMarker.y}px` }}
              />
            ) : null}
          </AnimatePresence>
        </svg>
      </div>

      <p className="mt-2 text-center text-sm tabular-nums text-ink-muted">
        {Math.round(clampedValue)}%
      </p>
    </section>
  );
};
