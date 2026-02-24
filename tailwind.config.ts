import type { Config } from 'tailwindcss';

/**
 * Wrap a CSS custom property (containing space-separated R G B channels)
 * with rgb() so Tailwind's <alpha-value> placeholder works for opacity
 * modifiers like `bg-canvas/90` or `border-warm-200/60`.
 */
const rgb = (varName: string) =>
  `rgb(var(--${varName}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      colors: {
        canvas: rgb('canvas'),
        surface: rgb('surface'),
        ink: {
          DEFAULT: rgb('ink'),
          light: rgb('ink-light'),
          muted: rgb('ink-muted'),
          faint: rgb('ink-faint'),
        },
        warm: {
          50: rgb('warm-50'),
          100: rgb('warm-100'),
          200: rgb('warm-200'),
          300: rgb('warm-300'),
          400: rgb('warm-400'),
          500: rgb('warm-500'),
        },
        spectrum: {
          left: rgb('spectrum-left'),
          mid: rgb('spectrum-mid'),
          right: rgb('spectrum-right'),
        },
        lumen: {
          DEFAULT: rgb('lumen'),
          light: rgb('lumen-light'),
        },
        sage: {
          DEFAULT: rgb('sage'),
          light: rgb('sage-light'),
        },
        flux: {
          DEFAULT: rgb('flux'),
          light: rgb('flux-light'),
        },
        score: {
          bullseye: rgb('score-bullseye'),
          adjacent: rgb('score-adjacent'),
          outer: rgb('score-outer'),
          miss: rgb('score-miss'),
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
