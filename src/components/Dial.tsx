import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import {
  DIAL_ARC_END_DEGREES,
  DIAL_ARC_START_DEGREES,
  clampDialValue,
  pointOnCircle,
  pointerValueFromCenter,
  valueToDialAngle,
} from '../lib/dialMath.js';

type DialProps = {
  value: number;
  leftLabel: string;
  rightLabel: string;
  size?: number;
  onChange?: (value: number) => void;
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
}: DialProps) => {
  const dialRef = useRef<HTMLDivElement | null>(null);
  const lastHapticBucketRef = useRef<number | null>(null);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const clampedValue = clampDialValue(value);
  const dialAngle = valueToDialAngle(clampedValue);

  const center = size / 2;
  const outerRadius = size * 0.38;
  const markerRadius = size * 0.26;
  const dialMarker = pointOnCircle(center, center, markerRadius, dialAngle);
  const arcPath = createArcPath(
    center,
    center,
    outerRadius,
    DIAL_ARC_START_DEGREES,
    DIAL_ARC_END_DEGREES,
  );

  const triggerHaptic = useCallback(
    (value: number, force = false): void => {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return;
      }

      const bucket = Math.round(value / 10);
      if (!force && lastHapticBucketRef.current === bucket) {
        return;
      }

      lastHapticBucketRef.current = bucket;
      navigator.vibrate(8);
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
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMouseDragging, updateFromMousePosition]);

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
      setIsTouchDragging(false);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isTouchDragging, updateFromMousePosition]);

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

    setIsTouchDragging(true);
    updateFromMousePosition(touch.clientX, touch.clientY, 'touch');
    triggerHaptic(clampedValue, true);
  };

  return (
    <section className="mx-auto w-full max-w-[390px] rounded-3xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-[0_20px_60px_-40px_rgba(120,53,15,0.55)]">
      <div className="mb-5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div
        ref={dialRef}
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
            fill="#fff7ed"
            stroke="#f59e0b"
            strokeWidth={2}
          />
          <circle cx={dialMarker.x} cy={dialMarker.y} r={9} fill="#9a3412" />
        </svg>
      </div>

      <p className="mt-2 text-center text-sm font-medium text-amber-900">
        Position: {Math.round(clampedValue)}%
      </p>
    </section>
  );
};
