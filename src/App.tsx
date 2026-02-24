import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/SplashScreen';
import { ModeScreen } from './components/ModeScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { EndScreen } from './components/EndScreen';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import {
  loadPlaytestSettings,
  savePlaytestSettings,
} from './lib/playtestSettings';
import type { GameMode, GameState, Personality } from './types/game';
import type { PlaytestSettings } from './types/playtest';

type AppScreen = 'splash' | 'mode' | 'setup' | 'game' | 'end';

export const App = () => {
  // Initialize the theme system — applies CSS variables on mount.
  useTheme();

  const [screen, setScreen] = useState<AppScreen>('splash');
  const [gameMode, setGameMode] = useState<GameMode>('coop');
  const [personality, setPersonality] = useState<Personality>('lumen');
  const [playtestSettings, setPlaytestSettings] = useState<PlaytestSettings>(
    () => loadPlaytestSettings(),
  );
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

  const handlePlaytestSettingsChange = useCallback(
    (nextSettings: PlaytestSettings) => {
      const savedSettings = savePlaytestSettings(nextSettings);
      setPlaytestSettings(savedSettings);
    },
    [],
  );

  return (
    <>
    <ThemeToggle />
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
          <SetupScreen
            onStart={handleStart}
            gameMode={gameMode}
            playtestSettings={playtestSettings}
            onPlaytestSettingsChange={handlePlaytestSettingsChange}
          />
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
            playtestSettings={playtestSettings}
            onPlaytestSettingsChange={handlePlaytestSettingsChange}
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
    </>
  );
};
