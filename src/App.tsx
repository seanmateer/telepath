import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Dial } from './components/Dial';

const SNAP_INCREMENT = 5;
const SNAP_ANIMATION_MS = 180;

const easeOutCubic = (value: number): number => {
  return 1 - (1 - value) ** 3;
};

export const App = () => {
  const [dialValue, setDialValue] = useState(50);
  const [showReveal, setShowReveal] = useState(false);
  const [targetValue] = useState(72);
  const dialValueRef = useRef(dialValue);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    dialValueRef.current = dialValue;
  }, [dialValue]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const stopDialAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const handleDialChange = useCallback(
    (value: number) => {
      stopDialAnimation();
      setDialValue(value);
    },
    [stopDialAnimation],
  );

  const handleDialRelease = useCallback(
    (value: number) => {
      const snappedTarget = Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
      const startValue = dialValueRef.current;
      const endValue = Math.max(0, Math.min(100, snappedTarget));
      const startTime = performance.now();

      stopDialAnimation();

      const animate = (timestamp: number): void => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / SNAP_ANIMATION_MS);
        const easedProgress = easeOutCubic(progress);
        const nextValue = Math.round(
          startValue + (endValue - startValue) * easedProgress,
        );

        setDialValue(nextValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [stopDialAnimation],
  );

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-center">
      <motion.section
        className="w-full max-w-[430px] space-y-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Telepath
        </h1>
        <p className="text-sm text-slate-700">
          Phase 3 standalone dial sandbox
        </p>
        <Dial
          value={dialValue}
          leftLabel="Cold"
          rightLabel="Hot"
          onChange={handleDialChange}
          onRelease={handleDialRelease}
          revealValue={showReveal ? targetValue : null}
        />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowReveal((current) => !current)}
            className="rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
          >
            {showReveal ? 'Hide Target Reveal' : 'Reveal Target'}
          </button>
        </div>
      </motion.section>
    </main>
  );
};
