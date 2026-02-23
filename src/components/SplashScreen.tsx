import { motion } from 'framer-motion';

type SplashScreenProps = {
  onPlay: () => void;
};

const ARC_COLORS = [
  'rgba(245, 158, 11, 0.15)',
  'rgba(249, 115, 22, 0.12)',
  'rgba(239, 68, 68, 0.10)',
  'rgba(224, 156, 63, 0.08)',
  'rgba(91, 141, 239, 0.06)',
];

const Arc = ({
  index,
}: {
  index: number;
}) => {
  const baseRadius = 80 + index * 52;
  const startAngle = 200 + index * 8;
  const endAngle = 340 - index * 8;
  const strokeWidth = 3 - index * 0.3;

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const cx = 200;
  const cy = 260;

  const x1 = cx + baseRadius * Math.cos(startRad);
  const y1 = cy + baseRadius * Math.sin(startRad);
  const x2 = cx + baseRadius * Math.cos(endRad);
  const y2 = cy + baseRadius * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  const d = `M ${x1} ${y1} A ${baseRadius} ${baseRadius} 0 ${largeArc} 1 ${x2} ${y2}`;

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={ARC_COLORS[index % ARC_COLORS.length]}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{
        pathLength: {
          duration: 1.8 + index * 0.3,
          ease: [0.25, 0.1, 0.25, 1],
          delay: 0.15 + index * 0.12,
        },
        opacity: {
          duration: 0.6,
          delay: 0.1 + index * 0.12,
        },
      }}
    />
  );
};

export const SplashScreen = ({ onPlay }: SplashScreenProps) => {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6">
      {/* Background arcs */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 400 400"
          className="h-[min(100vw,500px)] w-[min(100vw,500px)] opacity-80"
          aria-hidden="true"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Arc key={i} index={i} />
          ))}
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.h1
          className="font-serif text-5xl tracking-tight text-ink sm:text-6xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
        >
          Telepath
        </motion.h1>

        <motion.p
          className="mt-3 text-center text-base font-light tracking-wide text-ink-muted sm:text-lg"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: 'easeOut' }}
        >
          A spectrum guessing game
        </motion.p>

        <motion.button
          type="button"
          onClick={onPlay}
          className="mt-10 rounded-full bg-ink px-8 py-3.5 text-sm font-medium tracking-wide text-warm-50 transition-all hover:bg-ink-light hover:shadow-glow active:scale-[0.97]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.85, ease: 'easeOut' }}
          whileTap={{ scale: 0.97 }}
        >
          Play
        </motion.button>

        {/* <motion.p
          className="mt-6 text-xs text-ink-faint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          A spectrum guessing game
        </motion.p> */}
      </div>
    </main>
  );
};
