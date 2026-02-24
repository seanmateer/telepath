import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/SplashScreen';
import { ModeScreen } from './components/ModeScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { EndScreen } from './components/EndScreen';
import { ThemeDebug } from './components/ThemeDebug';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import {
  loadPlaytestSettings,
  savePlaytestSettings,
} from './lib/playtestSettings';
import {
  loadAppShellSnapshot,
  saveAppShellSnapshot,
  clearGameSessionSnapshot,
  type AppShellScreen,
  type AppShellSnapshot,
} from './lib/sessionState';
import type { GameMode, GameState, Personality } from './types/game';
import type { PlaytestSettings } from './types/playtest';

type AppScreen = 'splash' | AppShellScreen;

const GAME_ROUTE_PATH = '/game';

const getRouteForScreen = (screen: AppScreen): string => {
  return screen === 'splash' ? '/' : GAME_ROUTE_PATH;
};

const resolveScreenFromPath = (
  pathname: string,
  snapshot: AppShellSnapshot | null,
): AppScreen => {
  if (pathname === GAME_ROUTE_PATH) {
    return snapshot?.screen ?? 'mode';
  }

  return 'splash';
};

export const App = () => {
  // Initialize the theme system — applies CSS variables on mount.
  useTheme();
  const isThemeRoute = window.location.pathname === '/theme';

  const initialShellSnapshotRef = useRef<AppShellSnapshot | null>(
    loadAppShellSnapshot(),
  );
  const initialScreenRef = useRef<AppScreen>(
    resolveScreenFromPath(
      window.location.pathname,
      initialShellSnapshotRef.current,
    ),
  );

  const [screen, setScreen] = useState<AppScreen>(initialScreenRef.current);
  const [gameMode, setGameMode] = useState<GameMode>(
    initialShellSnapshotRef.current?.gameMode ?? 'coop',
  );
  const [personality, setPersonality] = useState<Personality>(
    initialShellSnapshotRef.current?.personality ?? 'lumen',
  );
  const [playtestSettings, setPlaytestSettings] = useState<PlaytestSettings>(
    () => loadPlaytestSettings(),
  );
  const [endGameState, setEndGameState] = useState<GameState | null>(() => {
    if (initialScreenRef.current !== 'end') {
      return null;
    }

    return initialShellSnapshotRef.current?.endGameState ?? null;
  });
  const gameKeyRef = useRef(0);

  const navigateToScreen = useCallback(
    (nextScreen: AppScreen, options?: { replace?: boolean }) => {
      setScreen(nextScreen);

      const nextPath = getRouteForScreen(nextScreen);
      if (window.location.pathname === nextPath) {
        return;
      }

      if (options?.replace) {
        window.history.replaceState(null, '', nextPath);
      } else {
        window.history.pushState(null, '', nextPath);
      }
    },
    [],
  );

  useEffect(() => {
    if (isThemeRoute) {
      return;
    }

    const handlePopState = () => {
      if (window.location.pathname !== GAME_ROUTE_PATH) {
        setScreen('splash');
        return;
      }

      const snapshot = loadAppShellSnapshot();
      if (!snapshot) {
        setEndGameState(null);
        setScreen('mode');
        return;
      }

      setGameMode(snapshot.gameMode);
      setPersonality(snapshot.personality);
      setEndGameState(snapshot.endGameState);
      setScreen(snapshot.screen);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isThemeRoute]);

  useEffect(() => {
    if (isThemeRoute) {
      return;
    }

    const expectedPath = getRouteForScreen(screen);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, '', expectedPath);
    }
  }, [isThemeRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isThemeRoute) {
      return;
    }

    if (screen === 'splash') {
      return;
    }

    if (screen === 'end' && !endGameState) {
      return;
    }

    saveAppShellSnapshot({
      screen,
      gameMode,
      personality,
      endGameState: screen === 'end' ? endGameState : null,
    });
  }, [endGameState, gameMode, isThemeRoute, personality, screen]);

  const handlePlay = useCallback(() => {
    navigateToScreen('mode');
  }, [navigateToScreen]);

  const handleSelectMode = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setEndGameState(null);
    clearGameSessionSnapshot();
    navigateToScreen('setup');
  }, [navigateToScreen]);

  const handleStart = useCallback((selectedPersonality: Personality) => {
    setPersonality(selectedPersonality);
    setEndGameState(null);
    clearGameSessionSnapshot();
    gameKeyRef.current += 1;
    navigateToScreen('game');
  }, [navigateToScreen]);

  const handleGameOver = useCallback((state: GameState) => {
    setEndGameState(state);
    clearGameSessionSnapshot();
    navigateToScreen('end');
  }, [navigateToScreen]);

  const handlePlayAgain = useCallback(() => {
    setEndGameState(null);
    clearGameSessionSnapshot();
    gameKeyRef.current += 1;
    navigateToScreen('game');
  }, [navigateToScreen]);

  const handleChangePersonality = useCallback(() => {
    setEndGameState(null);
    clearGameSessionSnapshot();
    navigateToScreen('setup');
  }, [navigateToScreen]);

  const handlePlaytestSettingsChange = useCallback(
    (nextSettings: PlaytestSettings) => {
      const savedSettings = savePlaytestSettings(nextSettings);
      setPlaytestSettings(savedSettings);
    },
    [],
  );

  if (isThemeRoute) {
    return <ThemeDebug />;
  }

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
