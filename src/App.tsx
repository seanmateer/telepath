import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/SplashScreen';
import { ModeScreen } from './components/ModeScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { EndScreen } from './components/EndScreen';
import type { GameMode, GameState, Personality } from './types/game';

type AppScreen = 'splash' | 'mode' | 'setup' | 'game' | 'end';

export const App = () => {
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [gameMode, setGameMode] = useState<GameMode>('coop');
  const [personality, setPersonality] = useState<Personality>('lumen');
  const [endGameState, setEndGameState] = useState<GameState | null>(null);
  const gameKeyRef = useRef(0);

  const handlePlay = useCallback(() => {
    setScreen('mode');
  }, []);

  const handleSelectMode = useCallback((mode: GameMode) => {
    setGameMode(mode);
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
      {screen === 'mode' && (
        <motion.div
          key="mode"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ModeScreen onSelectMode={handleSelectMode} />
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
          <SetupScreen onStart={handleStart} gameMode={gameMode} />
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
            gameMode={gameMode}
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
