import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      colors: {
        canvas: '#FAF7F2',
        ink: {
          DEFAULT: '#2C2418',
          light: '#6B5E4F',
          muted: '#9C8E7D',
          faint: '#A89888',
        },
        warm: {
          50: '#FDF8F0',
          100: '#F8EFE2',
          200: '#F0DEC6',
          300: '#E5C9A0',
          400: '#D4A96F',
          500: '#C08B4A',
        },
        spectrum: {
          left: '#F59E0B',
          mid: '#F97316',
          right: '#EF4444',
        },
        lumen: {
          DEFAULT: '#5B8DEF',
          light: '#E8F0FE',
        },
        sage: {
          DEFAULT: '#E09C3F',
          light: '#FFF3E0',
        },
        flux: {
          DEFAULT: '#E05B5B',
          light: '#FDE8E8',
        },
        score: {
          bullseye: '#22C55E',
          adjacent: '#84CC16',
          outer: '#CA8A04',
          miss: '#708296',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(192, 139, 74, 0.3)',
        card: '0 2px 20px -4px rgba(44, 36, 24, 0.08)',
        'card-hover': '0 4px 30px -4px rgba(44, 36, 24, 0.12)',
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
