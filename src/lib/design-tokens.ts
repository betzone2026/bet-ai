/**
 * The design tokens, as values.
 *
 * `src/app/globals.css` is authoritative — it is what the browser reads,
 * and Tailwind maps onto it. This module is the typed mirror for the
 * places that cannot use a class name: chart series colours, canvas
 * drawing, inline SVG stops and anything handed to a third-party
 * renderer. Keeping it in one file is what stops a chart from quietly
 * inventing its own blue.
 *
 * Colours are exposed as `rgb()` strings resolved from the same custom
 * properties, so a theme switch is picked up without a rebuild.
 */

/** Reads a token through the cascade; falls back to the dark value on the server. */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? `rgb(${value})` : fallback;
}

export const COLOR_VARS = {
  base: '--c-base',
  surface: '--c-surface',
  raised: '--c-raised',
  hover: '--c-hover',
  line: '--c-line',
  lineActive: '--c-line-active',
  ink: '--c-ink',
  inkSecondary: '--c-ink-2',
  muted: '--c-muted',
  alpha: '--c-alpha',
  onAlpha: '--c-on-alpha',
  positive: '--c-up',
  warning: '--c-warn',
  negative: '--c-down',
  info: '--c-info',
} as const;

export type ColorToken = keyof typeof COLOR_VARS;

const FALLBACKS: Record<ColorToken, string> = {
  base: 'rgb(7 9 13)',
  surface: 'rgb(14 18 25)',
  raised: 'rgb(20 26 35)',
  hover: 'rgb(27 34 45)',
  line: 'rgb(31 39 49)',
  lineActive: 'rgb(58 71 88)',
  ink: 'rgb(233 237 243)',
  inkSecondary: 'rgb(178 189 205)',
  muted: 'rgb(129 143 164)',
  alpha: 'rgb(226 178 88)',
  onAlpha: 'rgb(7 9 13)',
  positive: 'rgb(61 186 133)',
  warning: 'rgb(226 154 66)',
  negative: 'rgb(226 78 84)',
  info: 'rgb(88 148 245)',
};

export function color(name: ColorToken): string {
  return token(COLOR_VARS[name], FALLBACKS[name]);
}

/** Spacing rhythm, in rem. The interface only uses these steps. */
export const SPACING = {
  '0.5': '0.125rem',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
} as const;

export const RADIUS = {
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)',
  '2xl': 'var(--r-2xl)',
} as const;

export const SHADOW = {
  card: 'var(--e-card)',
  pop: 'var(--e-pop)',
  float: 'var(--e-float)',
} as const;

/** Nothing animates for longer than 250ms. */
export const DURATION = { fast: 150, base: 200, slow: 250 } as const;

export const Z_INDEX = {
  base: 0,
  sticky: 20,
  nav: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
} as const;

/** Breakpoints the layouts are designed and checked against, in px. */
export const BREAKPOINTS = {
  xs: 320,
  sm: 375,
  md: 430,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1440,
  ultrawide: 1920,
} as const;

/**
 * Series colours for charts, in the order they should be assigned.
 * Home takes the signal colour, away the analytical blue, and draw a
 * neutral — the same mapping the probability bar uses, so a chart and a
 * bar describing the same fixture never contradict each other.
 */
export const CHART_SERIES: ColorToken[] = ['alpha', 'muted', 'info', 'positive', 'warning', 'negative'];

/** Minimum touch target for the PWA / Capacitor targets, in px. */
export const TOUCH_TARGET = 44;
