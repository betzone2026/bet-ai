import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `cn()` has to know this project's scale, not Tailwind's.
 *
 * tailwind-merge resolves conflicts by class group, and it can only guess
 * at names it does not recognise: given `text-ink` and `text-small` it
 * files both under text-colour and silently drops the first, so a
 * component's colour disappears the moment a caller passes a size. Naming
 * both scales here makes `cn('text-ink', 'text-small')` keep both and
 * `cn('text-body', 'text-small')` keep the last, which is what every call
 * site already assumes.
 */
const FONT_SIZES = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'small',
  'fine',
  'micro',
  'label',
  'data',
  'data-sm',
  'hero',
  'hero-lg',
  'section',
  'section-lg',
  'lead',
];

const TEXT_COLORS = [
  'base',
  'surface',
  'raised',
  'hover',
  'line',
  'line-active',
  'ink',
  'ink-2',
  'muted',
  'alpha',
  'on-alpha',
  'up',
  'warn',
  'down',
  'info',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      'text-color': [{ text: TEXT_COLORS }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 0.4512 -> "45.1%" */
export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Fair decimal odds implied by a probability. Returns null at p <= 0. */
export function impliedOdds(probability: number): number | null {
  return probability > 0 ? 1 / probability : null;
}

export function formatKickoff(iso: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatMatchDate(iso: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

/** Maps a 0–1 risk score onto the four labels used across the interface. */
export function riskLevel(score: number): RiskLevel {
  if (score < 0.3) return 'low';
  if (score < 0.5) return 'moderate';
  if (score < 0.7) return 'elevated';
  return 'high';
}
