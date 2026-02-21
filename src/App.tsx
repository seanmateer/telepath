import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dial } from './components/Dial';

export const App = () => {
  const [dialValue, setDialValue] = useState(50);

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
          onChange={setDialValue}
        />
      </motion.section>
    </main>
  );
};
