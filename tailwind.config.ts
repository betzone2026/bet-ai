import type { Config } from 'tailwindcss';

/**
 * The Tailwind surface of the design system.
 *
 * Every value here resolves to a CSS custom property declared in
 * `src/app/globals.css`, which is the single place a colour, radius,
 * shadow or duration is ever written down. Components use these keys and
 * nothing else, so re-theming — including a future light mode — never
 * requires touching a component.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Surfaces */
        base: 'rgb(var(--c-base) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        hover: 'rgb(var(--c-hover) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        'line-active': 'rgb(var(--c-line-active) / <alpha-value>)',

        /* Text */
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--c-ink-2) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',

        /* Signal. Colour is only used where it carries meaning:
           gold = attention/confidence, green = positive, red = risk,
           amber = warning, blue = analytics and neutral intelligence.

           No colour here shares a name with an entry in `fontSize`
           below: `text-*` would otherwise mean two different things,
           and `cn()` could not tell which one a caller intended. */
        alpha: 'rgb(var(--c-alpha) / <alpha-value>)',
        'on-alpha': 'rgb(var(--c-on-alpha) / <alpha-value>)',
        up: 'rgb(var(--c-up) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        down: 'rgb(var(--c-down) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      /* One typographic scale for the whole product. `data` is the
         monospace figure size used for probabilities, odds and metrics,
         and `fine` is the fine-print size used for footnotes, quota
         captions and legal lines.

         `hero`, `section` and `lead` are the marketing tier: the landing
         and pricing pages need a larger top end than a dashboard does,
         and naming those sizes keeps them out of the components as
         arbitrary values. Nothing inside the application uses them. */
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        h1: ['1.625rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        h2: ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        h3: ['1rem', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
        body: ['0.875rem', { lineHeight: '1.55' }],
        small: ['0.8125rem', { lineHeight: '1.5' }],
        fine: ['0.6875rem', { lineHeight: '1.45' }],
        micro: ['0.625rem', { lineHeight: '0.875rem' }],
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
        data: ['1.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'data-sm': ['1.125rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],

        /* Marketing tier */
        hero: ['2.75rem', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        'hero-lg': ['3.75rem', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        section: ['1.875rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'section-lg': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        lead: ['1.0625rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
      },
      boxShadow: {
        card: 'var(--e-card)',
        pop: 'var(--e-pop)',
        float: 'var(--e-float)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '250ms',
      },
      transitionTimingFunction: {
        ease: 'var(--t-ease)',
      },
      zIndex: {
        sticky: '20',
        nav: '30',
        overlay: '40',
        modal: '50',
        toast: '60',
        tooltip: '70',
      },
      /* Touch targets are never below 44px, and fixed bottom chrome has
         to clear the iOS home indicator for the PWA/Capacitor target. */
      minHeight: { touch: '2.75rem' },
      minWidth: { touch: '2.75rem' },
      spacing: {
        safe: 'env(safe-area-inset-bottom, 0px)',
        sidebar: '16rem',
        'sidebar-collapsed': '4.25rem',
      },
      maxWidth: { shell: '84rem' },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        'fade-up': 'fade-up 250ms var(--t-ease) both',
        'fade-in': 'fade-in 150ms var(--t-ease) both',
        'sheet-up': 'sheet-up 250ms var(--t-ease) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
