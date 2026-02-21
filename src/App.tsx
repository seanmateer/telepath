import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/SplashScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { EndScreen } from './components/EndScreen';
import type { GameState, Personality } from './types/game';

type AppScreen = 'splash' | 'setup' | 'game' | 'end';

export const App = () => {
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [personality, setPersonality] = useState<Personality>('lumen');
  const [endGameState, setEndGameState] = useState<GameState | null>(null);
  const gameKeyRef = useRef(0);

  const handlePlay = useCallback(() => {
    setScreen('setup');
  }, []);

  const handleStart = useCallback((selectedPersonality: Personality) => {
    setPersonality(selectedPersonality);
    setEndGameState(null);
    gameKeyRef.current += 1;
    setScreen('game');
  }, []);

  const handleGameOver = useCallback((state: GameState) => {
    setEndGameState(state);
    setScreen('end');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setEndGameState(null);
    gameKeyRef.current += 1;
    setScreen('game');
  }, []);

  const handleChangePersonality = useCallback(() => {
    setEndGameState(null);
    setScreen('setup');
  }, []);

  return (
    <AnimatePresence mode="wait">
      {screen === 'splash' && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <SplashScreen onPlay={handlePlay} />
        </motion.div>
      )}
      {screen === 'setup' && (
        <motion.div
          key="setup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <SetupScreen onStart={handleStart} />
        </motion.div>
      )}
      {screen === 'game' && (
        <motion.div
          key={`game-${gameKeyRef.current}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GameScreen
            personality={personality}
            onGameOver={handleGameOver}
          />
        </motion.div>
      )}
      {screen === 'end' && endGameState && (
        <motion.div
          key="end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <EndScreen
            gameState={endGameState}
            onPlayAgain={handlePlayAgain}
            onChangePersonality={handleChangePersonality}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
