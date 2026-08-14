import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
