type DialProps = {
  value: number;
  leftLabel: string;
  rightLabel: string;
  size?: number;
};

const DIAL_MIN = 0;
const DIAL_MAX = 100;
const ARC_START_DEGREES = -135;
const ARC_SWEEP_DEGREES = 270;

const clampValue = (value: number): number => {
  if (value < DIAL_MIN) {
    return DIAL_MIN;
  }
  if (value > DIAL_MAX) {
    return DIAL_MAX;
  }
  return value;
};

const valueToAngle = (value: number): number => {
  const normalized = clampValue(value) / DIAL_MAX;
  return ARC_START_DEGREES + normalized * ARC_SWEEP_DEGREES;
};

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
): { x: number; y: number } => {
  const radians = (angleDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
};

const createArcPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = polarToCartesian(centerX, centerY, radius, startAngle);
  const end = polarToCartesian(centerX, centerY, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

export const Dial = ({ value, leftLabel, rightLabel, size = 320 }: DialProps) => {
  const clampedValue = clampValue(value);
  const dialAngle = valueToAngle(clampedValue);

  const center = size / 2;
  const outerRadius = size * 0.38;
  const markerRadius = size * 0.26;
  const dialMarker = polarToCartesian(center, center, markerRadius, dialAngle);
  const arcPath = createArcPath(
    center,
    center,
    outerRadius,
    ARC_START_DEGREES,
    ARC_START_DEGREES + ARC_SWEEP_DEGREES,
  );

  return (
    <section className="mx-auto w-full max-w-[390px] rounded-3xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-[0_20px_60px_-40px_rgba(120,53,15,0.55)]">
      <div className="mb-5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[320px]">
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
