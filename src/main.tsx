import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme, getInitialTheme } from './lib/theme';
import { App } from './App';
import './index.css';

// Apply theme before first paint so correct --ink/--canvas etc. are set (avoids flash and wrong colors in dark mode).
applyTheme(getInitialTheme());

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
