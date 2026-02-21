import { motion } from 'framer-motion';

export const App = () => {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <motion.section
        className="space-y-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Telepath
        </h1>
        <p className="text-base text-slate-700">
          Humans vs. AI Wavelength adaptation.
        </p>
      </motion.section>
    </main>
  );
};
