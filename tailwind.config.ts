import type { Config } from 'tailwindcss';

/**
 * Colours are declared once as CSS custom properties in globals.css and
 * referenced here, so a future light theme only needs new variables.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--c-base) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        alpha: 'rgb(var(--c-alpha) / <alpha-value>)',
        data: 'rgb(var(--c-data) / <alpha-value>)',
        up: 'rgb(var(--c-up) / <alpha-value>)',
        down: 'rgb(var(--c-down) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '0.625rem', '2xl': '0.875rem' },
      maxWidth: { shell: '84rem' },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.2,.7,.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
export default config;
