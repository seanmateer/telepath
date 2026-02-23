import {
  ADJACENT_MAX_DISTANCE,
  BULLSEYE_MAX_DISTANCE,
  OUTER_MAX_DISTANCE,
} from './gameState.js';

export const DIAL_MIN_VALUE = 0;
export const DIAL_MAX_VALUE = 100;

// Top-oriented "banana" arc for clearer touch interaction.
export const DIAL_ARC_START_DEGREES = 210;
export const DIAL_ARC_SWEEP_DEGREES = 120;
export const DIAL_ARC_END_DEGREES =
  DIAL_ARC_START_DEGREES + DIAL_ARC_SWEEP_DEGREES;
export const DIAL_ARC_MID_DEGREES =
  DIAL_ARC_START_DEGREES + DIAL_ARC_SWEEP_DEGREES / 2;

export type Point = {
  x: number;
  y: number;
};

export type DialScoreZoneSegmentName =
  | 'outer-left'
  | 'adjacent-left'
  | 'bullseye'
  | 'adjacent-right'
  | 'outer-right';

export type DialScoreZoneSegment = {
  name: DialScoreZoneSegmentName;
  startValue: number;
  endValue: number;
  midpointValue: number;
};

type RawDialScoreZoneSegment = {
  name: DialScoreZoneSegmentName;
  startValue: number;
  endValue: number;
};

export const clampDialValue = (value: number): number => {
  if (value < DIAL_MIN_VALUE) {
    return DIAL_MIN_VALUE;
  }
  if (value > DIAL_MAX_VALUE) {
    return DIAL_MAX_VALUE;
  }
  return value;
};

export const valueToDialAngle = (value: number): number => {
  const normalized = clampDialValue(value) / DIAL_MAX_VALUE;
  return DIAL_ARC_START_DEGREES + normalized * DIAL_ARC_SWEEP_DEGREES;
};

export const clampDialAngle = (angleDegrees: number): number => {
  const normalized = ((angleDegrees % 360) + 360) % 360;
  const start = ((DIAL_ARC_START_DEGREES % 360) + 360) % 360;
  const end = ((DIAL_ARC_END_DEGREES % 360) + 360) % 360;
  const isWrappingArc = start > end;

  const inArc = isWrappingArc
    ? normalized >= start || normalized <= end
    : normalized >= start && normalized <= end;

  if (inArc) {
    return normalized;
  }

  const angularDistance = (from: number, to: number): number => {
    const clockwise = ((to - from) + 360) % 360;
    const counterClockwise = ((from - to) + 360) % 360;
    return Math.min(clockwise, counterClockwise);
  };

  const distanceToStart = angularDistance(normalized, start);
  const distanceToEnd = angularDistance(normalized, end);

  return distanceToStart <= distanceToEnd ? start : end;
};

export const dialAngleToValue = (angleDegrees: number): number => {
  const normalized =
    (clampDialAngle(angleDegrees) - DIAL_ARC_START_DEGREES) /
    DIAL_ARC_SWEEP_DEGREES;
  return clampDialValue(normalized * DIAL_MAX_VALUE);
};

export const pointerAngleFromCenter = (
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
): number => {
  return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
};

export const pointerValueFromCenter = (
  clientX: number,
  clientY: number,
  centerX: number,
  centerY: number,
): number => {
  const angle = pointerAngleFromCenter(clientX, clientY, centerX, centerY);
  return dialAngleToValue(angle);
};

export const pointOnCircle = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
): Point => {
  const radians = (angleDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
};

const clampScoreSegment = (
  segment: RawDialScoreZoneSegment,
): DialScoreZoneSegment | null => {
  const startValue = clampDialValue(segment.startValue);
  const endValue = clampDialValue(segment.endValue);
  if (startValue >= endValue) {
    return null;
  }

  return {
    name: segment.name,
    startValue,
    endValue,
    midpointValue: (startValue + endValue) / 2,
  };
};

export const getDialScoreZoneSegments = (
  targetValue: number,
): DialScoreZoneSegment[] => {
  const target = clampDialValue(targetValue);
  const rawSegments: RawDialScoreZoneSegment[] = [
    {
      name: 'outer-left',
      startValue: target - OUTER_MAX_DISTANCE,
      endValue: target - ADJACENT_MAX_DISTANCE,
    },
    {
      name: 'adjacent-left',
      startValue: target - ADJACENT_MAX_DISTANCE,
      endValue: target - BULLSEYE_MAX_DISTANCE,
    },
    {
      name: 'bullseye',
      startValue: target - BULLSEYE_MAX_DISTANCE,
      endValue: target + BULLSEYE_MAX_DISTANCE,
    },
    {
      name: 'adjacent-right',
      startValue: target + BULLSEYE_MAX_DISTANCE,
      endValue: target + ADJACENT_MAX_DISTANCE,
    },
    {
      name: 'outer-right',
      startValue: target + ADJACENT_MAX_DISTANCE,
      endValue: target + OUTER_MAX_DISTANCE,
    },
  ];

  return rawSegments
    .map(clampScoreSegment)
    .filter((segment): segment is DialScoreZoneSegment => segment !== null);
};
