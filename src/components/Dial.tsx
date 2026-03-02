import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  DIAL_ARC_END_DEGREES,
  DIAL_ARC_START_DEGREES,
  clampDialValue,
  getDialScoreZoneSegments,
  pointOnCircle,
  pointerValueFromCenter,
  valueToDialAngle,
} from '../lib/dialMath.js';
import { triggerHapticPulse } from '../lib/haptics.js';
import { RoundScorePill } from './RoundScorePill.js';
import type { ScoreZone } from '../types/game';

type DialProps = {
  value: number;
  leftLabel: string;
  rightLabel: string;
  clueLabel?: string;
  clueText?: string;
  valueLabelText?: string;
  size?: number;
  onChange?: (value: number) => void;
  onRelease?: (value: number) => void;
  targetValue?: number | null;
  showScoringZones?: boolean;
  scoringMode?: 'coop' | 'competitive';
  interactive?: boolean;
  showDialHand?: boolean;
  showValueLabel?: boolean;
  roundScorePill?: {
    zone: ScoreZone;
    points: number;
    bonusCardDrawn: boolean;
  } | null;
};

type ScoreZoneGeometry = {
  name: keyof typeof zoneLabelByName;
  startAngle: number;
  endAngle: number;
  midpointAngle: number;
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
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

const createSectorPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = pointOnCircle(centerX, centerY, radius, startAngle);
  const end = pointOnCircle(centerX, centerY, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
};

const createRingSectorPath = (
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const outerStart = pointOnCircle(centerX, centerY, outerRadius, startAngle);
  const outerEnd = pointOnCircle(centerX, centerY, outerRadius, endAngle);
  const innerStart = pointOnCircle(centerX, centerY, innerRadius, startAngle);
  const innerEnd = pointOnCircle(centerX, centerY, innerRadius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
};

const createNeedleHandGeometry = (
  centerX: number,
  centerY: number,
  angleDegrees: number,
  startDistance: number,
  tipDistance: number,
): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} => {
  const radians = (angleDegrees * Math.PI) / 180;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };

  const start = {
    x: centerX + direction.x * startDistance,
    y: centerY + direction.y * startDistance,
  };
  const end = {
    x: centerX + direction.x * tipDistance,
    y: centerY + direction.y * tipDistance,
  };

  return {
    start,
    end,
  };
};

/** Zone cap fill colours — resolved at render time from CSS variables. */
const getZoneCapColor = (name: string): string => {
  const style = getComputedStyle(document.documentElement);
  if (name === 'bullseye') return style.getPropertyValue('--dial-zone-bullseye').trim();
  if (name.startsWith('adjacent')) return style.getPropertyValue('--dial-zone-adjacent').trim();
  return style.getPropertyValue('--dial-zone-outer').trim();
};

/** Zone label colours — resolved at render time from CSS variables. */
const getZoneLabelColor = (name: string): string => {
  const style = getComputedStyle(document.documentElement);
  if (name === 'bullseye') return style.getPropertyValue('--dial-zone-label-bullseye').trim();
  if (name.startsWith('adjacent')) return style.getPropertyValue('--dial-zone-label-adjacent').trim();
  return style.getPropertyValue('--dial-zone-label-outer').trim();
};

const zoneLabelByName = {
  'outer-left': '2',
  'adjacent-left': '3',
  bullseye: '4',
  'adjacent-right': '3',
  'outer-right': '2',
} as const;

export const Dial = ({
  value,
  leftLabel,
  rightLabel,
  clueLabel,
  clueText,
  valueLabelText,
  size = 350,
  onChange,
  onRelease,
  targetValue = null,
  showScoringZones = false,
  scoringMode = 'competitive',
  interactive = true,
  showDialHand = true,
  showValueLabel = true,
  roundScorePill = null,
}: DialProps) => {
  const dialRef = useRef<HTMLDivElement | null>(null);
  const latestValueRef = useRef<number>(clampDialValue(value));
  const lastHapticBucketRef = useRef<number | null>(null);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const clampedValue = clampDialValue(value);
  const clampedTargetValue =
    targetValue === null ? null : clampDialValue(targetValue);
  const shouldShowZones = showScoringZones && clampedTargetValue !== null;
  const dialAngle = valueToDialAngle(clampedValue);

  const center = size / 2;
  const trackStrokeWidth = size * 0.094;
  const outerRadius = size * 0.435;
  const arcInnerRadius = outerRadius - trackStrokeWidth * 0.5;
  const arcOuterRadius = outerRadius + trackStrokeWidth * 0.5;
  const innerZoneRadius = arcInnerRadius;
  const zoneCapInnerRadius = arcInnerRadius;
  const zoneCapOuterRadius = arcOuterRadius;
  const handStartDistance = size * 0.03;
  const handTipDistance = arcOuterRadius - trackStrokeWidth * 0.08;
  const handStrokeWidth = Math.max(1.35, size * 0.0052);
  const zoneLabelRadius = arcOuterRadius + trackStrokeWidth * 0.34;
  const interactionBandStrokeWidth = size * 0.34;
  const hubOuterRadius = size * 0.028;
  const hubInnerRadius = size * 0.0095;
  const viewBoxMinX = 0;
  const viewBoxMinY = -size * 0.1;
  const viewBoxWidth = size;
  const viewBoxHeight = size * 0.69;
  const normalizedCenterX = (center - viewBoxMinX) / viewBoxWidth;
  const normalizedCenterY = (center - viewBoxMinY) / viewBoxHeight;
  const handGeometry = createNeedleHandGeometry(
    center,
    center,
    dialAngle,
    handStartDistance,
    handTipDistance,
  );
  const fullArcPath = createArcPath(
    center,
    center,
    outerRadius,
    DIAL_ARC_START_DEGREES,
    DIAL_ARC_END_DEGREES,
  );
  const scoreZoneSegments = shouldShowZones
    ? getDialScoreZoneSegments(clampedTargetValue)
    : [];
  const scoreZoneGeometry: ScoreZoneGeometry[] = scoreZoneSegments.map(
    (segment) => ({
      name: segment.name,
      startAngle: valueToDialAngle(segment.startValue),
      endAngle: valueToDialAngle(segment.endValue),
      midpointAngle: valueToDialAngle(segment.midpointValue),
    }),
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

  const isWithinInteractionBand = useCallback(
    (clientX: number, clientY: number): boolean => {
      const dialElement = dialRef.current;
      if (!dialElement) {
        return false;
      }

      const rect = dialElement.getBoundingClientRect();
      const centerX = rect.left + rect.width * normalizedCenterX;
      const centerY = rect.top + rect.height * normalizedCenterY;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      const scale = rect.width / viewBoxWidth;
      const radiusPx = handTipDistance * scale;
      const bandHalfPx = (interactionBandStrokeWidth / 2) * scale;

      return Math.abs(distance - radiusPx) <= bandHalfPx;
    },
    [
      handTipDistance,
      interactionBandStrokeWidth,
      normalizedCenterX,
      normalizedCenterY,
      viewBoxWidth,
    ],
  );

  const updateFromMousePosition = useCallback(
    (clientX: number, clientY: number, inputType: 'mouse' | 'touch'): void => {
      const dialElement = dialRef.current;
      if (!dialElement) {
        return;
      }

      const rect = dialElement.getBoundingClientRect();
      const centerX = rect.left + rect.width * normalizedCenterX;
      const centerY = rect.top + rect.height * normalizedCenterY;

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
    [normalizedCenterX, normalizedCenterY, onChange, triggerHaptic],
  );

  useEffect(() => {
    if (!interactive || !isMouseDragging) {
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
  }, [interactive, isMouseDragging, onRelease, updateFromMousePosition]);

  useEffect(() => {
    if (!interactive || !isTouchDragging) {
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
  }, [interactive, isTouchDragging, onRelease, triggerHaptic, updateFromMousePosition]);

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!interactive || !isWithinInteractionBand(event.clientX, event.clientY)) {
      return;
    }

    event.preventDefault();
    setIsMouseDragging(true);
    updateFromMousePosition(event.clientX, event.clientY, 'mouse');
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>): void => {
    if (!interactive) {
      return;
    }

    const touch = event.touches[0];
    if (!touch || !isWithinInteractionBand(touch.clientX, touch.clientY)) {
      return;
    }

    lastHapticBucketRef.current = null;
    setIsTouchDragging(true);
    updateFromMousePosition(touch.clientX, touch.clientY, 'touch');
  };

  const cursorClass = interactive
    ? isMouseDragging || isTouchDragging
      ? 'cursor-grabbing'
      : 'cursor-grab'
    : 'cursor-default';

  return (
    <section className="mx-auto w-full max-w-[400px] rounded-2xl border border-warm-200/60 bg-surface/50 p-4 shadow-card sm:max-w-[520px] lg:max-w-[720px]">
      <AnimatePresence mode="wait">
        {clueText && (
          <motion.div
            key={`dial-clue-${clueLabel ?? 'clue'}-${clueText}`}
            className="mb-4 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35 }}
          >
            {clueLabel && (
              <p className="text-xs font-medium uppercase tracking-widest text-ink-faint">
                {clueLabel}
              </p>
            )}
            <p className="mt-1 font-serif text-3xl text-ink">{clueText}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-4 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-ink-muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div
        ref={dialRef}
        role={interactive ? 'slider' : 'img'}
        aria-label={`Dial between ${leftLabel} and ${rightLabel}`}
        aria-disabled={!interactive}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? 100 : undefined}
        aria-valuenow={interactive ? Math.round(clampedValue) : undefined}
        tabIndex={interactive ? 0 : -1}
        className={`relative mt-10 mx-auto w-full max-w-[360px] touch-none sm:max-w-[500px] lg:max-w-[640px] ${cursorClass}`}
        style={{ aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <svg
          viewBox={`${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`}
          className="h-full w-full overflow-visible"
          style={{ overflow: 'visible' }}
          aria-label="Telepath dial scaffold"
          role="img"
        >
          <path
            d={fullArcPath}
            fill="none"
            stroke="var(--dial-track)"
            strokeWidth={trackStrokeWidth}
            strokeLinecap="round"
          />
          {shouldShowZones &&
            scoreZoneGeometry.map((segment, zoneIndex) => {
              const translucentInnerSectorPath = createSectorPath(
                center,
                center,
                innerZoneRadius,
                segment.startAngle,
                segment.endAngle,
              );
              const opaqueCapSectorPath = createRingSectorPath(
                center,
                center,
                zoneCapOuterRadius,
                zoneCapInnerRadius,
                segment.startAngle,
                segment.endAngle,
              );

              const zoneCapColor = getZoneCapColor(segment.name);
              const zoneDelay = zoneIndex * 0.07;

              return (
                <motion.g
                  key={segment.name}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0 }
                  }
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, scale: 1 }
                  }
                  transition={{
                    duration: 0.3,
                    delay: zoneDelay,
                    ease: prefersReducedMotion
                      ? 'easeOut'
                      : [0.34, 1.56, 0.64, 1],
                  }}
                  style={{ transformOrigin: `${center}px ${center}px` }}
                >
                  <path
                    d={translucentInnerSectorPath}
                    fill={zoneCapColor}
                    stroke="none"
                    opacity={0.34}
                  />
                  <path
                    d={opaqueCapSectorPath}
                    fill={zoneCapColor}
                    stroke="none"
                    opacity={0.92}
                  />
                </motion.g>
              );
            })}

          {showDialHand && (
            <g>
              <line
                x1={handGeometry.start.x}
                y1={handGeometry.start.y}
                x2={handGeometry.end.x}
                y2={handGeometry.end.y}
                stroke="var(--dial-hand)"
                strokeWidth={handStrokeWidth}
                strokeLinecap="round"
              />
            </g>
          )}

          {shouldShowZones &&
            scoreZoneGeometry.map((segment, zoneIndex) => {
              const isCoopBullseye =
                segment.name === 'bullseye' && scoringMode === 'coop';
              const zoneLabelPoint = pointOnCircle(
                center,
                center,
                zoneLabelRadius,
                segment.midpointAngle,
              );
              const zoneLabel = zoneLabelByName[segment.name];

              const labelColor = getZoneLabelColor(segment.name);

              return (
                <motion.g
                  key={`${segment.name}-label`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: 0.2,
                    delay: zoneIndex * 0.07 + 0.05,
                    ease: 'easeOut',
                  }}
                >
                  <text
                    x={zoneLabelPoint.x}
                    y={zoneLabelPoint.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={labelColor}
                    fontSize={size * 0.047}
                    fontWeight={700}
                  >
                    {isCoopBullseye ? '3' : zoneLabel}
                  </text>
                  {isCoopBullseye && (
                    <text
                      x={zoneLabelPoint.x + size * 0.018}
                      y={zoneLabelPoint.y - size * 0.02}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={labelColor}
                      fontSize={size * 0.026}
                      fontWeight={700}
                    >
                      +
                    </text>
                  )}
                </motion.g>
              );
            })}

          <path
            d={fullArcPath}
            fill="none"
            stroke="rgba(0, 0, 0, 0)"
            strokeWidth={interactionBandStrokeWidth}
            strokeLinecap="round"
          />

          <>
            <circle
              cx={center}
              cy={center}
              r={hubOuterRadius}
              fill="var(--dial-hub-fill)"
              stroke="var(--dial-hub-stroke)"
              strokeWidth={Math.max(1.2, size * 0.0036)}
            />
            <circle cx={center} cy={center} r={hubInnerRadius} fill="var(--dial-hub-center)" />
          </>
        </svg>
        <AnimatePresence>
          {roundScorePill && (
            <div className="absolute inset-x-0 top-[-5%] z-20 flex justify-center">
              <RoundScorePill
                zone={roundScorePill.zone}
                points={roundScorePill.points}
                bonusCardDrawn={roundScorePill.bonusCardDrawn}
                delay={0.55}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {showValueLabel && (
        <p className="mt-2 text-center text-sm tabular-nums text-ink-muted">
          {valueLabelText ?? `${Math.round(clampedValue)}%`}
        </p>
      )}
    </section>
  );
};
