/**
 * Theme system for Telepath.
 *
 * Light and dark palettes are defined here as plain objects so colours
 * are easy to tweak in one place.  `applyTheme` writes them as CSS
 * custom properties on `<html>`, and every Tailwind token references
 * those variables via `tailwind.config.ts`.
 *
 * Tailwind color tokens are stored as space-separated RGB channels
 * (e.g. `250 247 242`) so that Tailwind's `/opacity` modifier works
 * (bg-canvas/90, border-warm-200/60, etc.).
 *
 * Non-colour tokens (shadows, dial SVG hex) are stored as plain strings.
 */

export type ThemeMode = 'light' | 'dark';

// ---------------------------------------------------------------------------
// Palette type
// ---------------------------------------------------------------------------

export type ThemePalette = {
  /* Colour tokens — stored as "R G B" for Tailwind <alpha-value> compat */
  canvas: string;
  surface: string;
  ink: string;
  'ink-light': string;
  'ink-muted': string;
  'ink-faint': string;
  'warm-50': string;
  'warm-100': string;
  'warm-200': string;
  'warm-300': string;
  'warm-400': string;
  'warm-500': string;
  'spectrum-left': string;
  'spectrum-mid': string;
  'spectrum-right': string;
  lumen: string;
  'lumen-light': string;
  sage: string;
  'sage-light': string;
  flux: string;
  'flux-light': string;
  'score-bullseye': string;
  'score-adjacent': string;
  'score-outer': string;
  'score-miss': string;

  /* Utility tokens — raw CSS values */
  'shadow-glow': string;
  'shadow-card': string;
  'shadow-card-hover': string;

  /* Dial SVG hex colours */
  'dial-track': string;
  'dial-hand': string;
  'dial-hub-fill': string;
  'dial-hub-stroke': string;
  'dial-hub-center': string;

  /* Dial score zone colours (hex) */
  'dial-zone-outer': string;
  'dial-zone-adjacent': string;
  'dial-zone-bullseye': string;
  'dial-zone-label-outer': string;
  'dial-zone-label-adjacent': string;
  'dial-zone-label-bullseye': string;

  /* Focus / selection */
  'focus-ring': string;
  'selection-bg': string;

  /* Canvas as hex for html2canvas, <meta>, etc. */
  'canvas-hex': string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert #RRGGBB → "R G B" (space-separated channels for Tailwind). */
function c(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
}

// ---------------------------------------------------------------------------
// Light theme
// ---------------------------------------------------------------------------

export const lightTheme: ThemePalette = {
  canvas: c('#FAF7F2'),
  surface: c('#FFFFFF'),
  ink: c('#2C2418'),
  'ink-light': c('#6B5E4F'),
  'ink-muted': c('#9C8E7D'),
  'ink-faint': c('#A89888'),
  'warm-50': c('#FDF8F0'),
  'warm-100': c('#F8EFE2'),
  'warm-200': c('#F0DEC6'),
  'warm-300': c('#E5C9A0'),
  'warm-400': c('#D4A96F'),
  'warm-500': c('#C08B4A'),
  'spectrum-left': c('#F59E0B'),
  'spectrum-mid': c('#F97316'),
  'spectrum-right': c('#EF4444'),
  lumen: c('#5B8DEF'),
  'lumen-light': c('#E8F0FE'),
  sage: c('#E09C3F'),
  'sage-light': c('#FFF3E0'),
  flux: c('#E05B5B'),
  'flux-light': c('#FDE8E8'),
  'score-bullseye': c('#22C55E'),
  'score-adjacent': c('#84CC16'),
  'score-outer': c('#CA8A04'),
  'score-miss': c('#708296'),

  'shadow-glow': '0 0 40px -10px rgba(192, 139, 74, 0.3)',
  'shadow-card': '0 2px 20px -4px rgba(44, 36, 24, 0.08)',
  'shadow-card-hover': '0 4px 30px -4px rgba(44, 36, 24, 0.12)',

  'dial-track': '#E8D1BA',
  'dial-hand': '#2C2418',
  'dial-hub-fill': '#F8F5EF',
  'dial-hub-stroke': '#1D1710',
  'dial-hub-center': '#1D1710',

  'dial-zone-outer': '#CFBDA7',
  'dial-zone-adjacent': '#E8A062',
  'dial-zone-bullseye': '#D96D49',
  'dial-zone-label-outer': '#CFBDA7',
  'dial-zone-label-adjacent': '#E08A55',
  'dial-zone-label-bullseye': '#D96D49',

  'focus-ring': '#C08B4A',
  'selection-bg': 'rgba(240, 222, 198, 0.6)',
  'canvas-hex': '#FAF7F2',
};

// ---------------------------------------------------------------------------
// Dark theme  (inspired by the provided screenshot — deep warm darks)
// ---------------------------------------------------------------------------

export const darkTheme: ThemePalette = {
  canvas: c('#181614'),
  surface: c('#1B1917'),
  ink: c('#EAE6E0'),
  'ink-light': c('#C0B8AE'),
  'ink-muted': c('#A49B92'),
  'ink-faint': c('#887F77'),
  'warm-50': c('#1A1820'),
  'warm-100': c('#262330'),
  'warm-200': c('#3D3744'),
  'warm-300': c('#584F62'),
  'warm-400': c('#8A7F72'),
  'warm-500': c('#C4A464'),
  'spectrum-left': c('#F5A623'),
  'spectrum-mid': c('#F97316'),
  'spectrum-right': c('#EF4444'),
  lumen: c('#6B9DF7'),
  'lumen-light': c('#1E2640'),
  sage: c('#E8A94D'),
  'sage-light': c('#2A2218'),
  flux: c('#E86B6B'),
  'flux-light': c('#2E1A1A'),
  'score-bullseye': c('#34D975'),
  'score-adjacent': c('#9ADB2E'),
  'score-outer': c('#DBA21A'),
  'score-miss': c('#8A98AA'),

  'shadow-glow': '0 0 40px -10px rgba(184, 153, 92, 0.25)',
  'shadow-card': '0 2px 20px -4px rgba(0, 0, 0, 0.3)',
  'shadow-card-hover': '0 4px 30px -4px rgba(0, 0, 0, 0.4)',

  'dial-track': '#3E3648',
  'dial-hand': '#EAE6E0',
  'dial-hub-fill': '#1C1A22',
  'dial-hub-stroke': '#EAE6E0',
  'dial-hub-center': '#EAE6E0',

  'dial-zone-outer': '#5A5060',
  'dial-zone-adjacent': '#C08040',
  'dial-zone-bullseye': '#D96D49',
  'dial-zone-label-outer': '#6A6070',
  'dial-zone-label-adjacent': '#D09050',
  'dial-zone-label-bullseye': '#E07858',

  'focus-ring': '#B8995C',
  'selection-bg': 'rgba(53, 47, 58, 0.7)',
  'canvas-hex': '#131118',
};

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'telepath-theme';

/** Read the persisted theme preference, falling back to system preference. */
export function getInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable
  }

  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

/** Persist the theme preference. */
export function persistTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable
  }
}

const themes: Record<ThemeMode, ThemePalette> = {
  light: lightTheme,
  dark: darkTheme,
};

/**
 * Apply a theme by writing CSS custom properties to `<html>` and toggling
 * the `.dark` class.
 */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const palette = themes[mode];

  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(`--${key}`, value);
  }

  root.classList.toggle('dark', mode === 'dark');

  // Update <meta name="theme-color">
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', palette['canvas-hex']);
  }
}
