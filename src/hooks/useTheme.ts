import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  applyTheme,
  getInitialTheme,
  persistTheme,
  type ThemeMode,
} from '../lib/theme';

// ---------------------------------------------------------------------------
// Tiny external store so every consumer shares the same value without context.
// ---------------------------------------------------------------------------

let currentTheme: ThemeMode = getInitialTheme();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemeMode {
  return currentTheme;
}

function setTheme(next: ThemeMode): void {
  if (next === currentTheme) return;
  currentTheme = next;
  persistTheme(next);
  applyTheme(next);
  for (const l of listeners) l();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Apply on first mount so CSS variables are set before first paint.
  useEffect(() => {
    applyTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = useCallback(() => {
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
  }, []);

  return { theme, toggleTheme, setTheme };
}
