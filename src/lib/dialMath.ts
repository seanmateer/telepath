export const DIAL_MIN_VALUE = 0;
export const DIAL_MAX_VALUE = 100;

// Rotated -90 degrees from the original scaffold orientation.
export const DIAL_ARC_START_DEGREES = 135;
export const DIAL_ARC_SWEEP_DEGREES = 270;
export const DIAL_ARC_END_DEGREES =
  DIAL_ARC_START_DEGREES + DIAL_ARC_SWEEP_DEGREES;
export const DIAL_ARC_MID_DEGREES =
  DIAL_ARC_START_DEGREES + DIAL_ARC_SWEEP_DEGREES / 2;

export type Point = {
  x: number;
  y: number;
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
  const arcEndModulo = DIAL_ARC_END_DEGREES - 360;

  if (normalized >= DIAL_ARC_START_DEGREES) {
    return normalized;
  }

  if (normalized <= arcEndModulo) {
    return normalized + 360;
  }

  const distanceToStart = Math.abs(normalized - DIAL_ARC_START_DEGREES);
  const distanceToEnd = Math.abs(normalized - arcEndModulo);

  return distanceToStart <= distanceToEnd
    ? DIAL_ARC_START_DEGREES
    : DIAL_ARC_END_DEGREES;
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
