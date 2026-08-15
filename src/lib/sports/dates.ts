/**
 * The one definition of a sync date.
 *
 * Three places need to agree on what "2026-08-15" means — the admin date
 * picker, the API route that validates the body, and the sync service that
 * builds the provider query. When they disagree the failure is silent: a
 * mistyped date becomes a request for the wrong day, the provider answers
 * honestly with zero fixtures, and the admin concludes the league filter is
 * broken. So the rule lives here and nowhere else.
 *
 * `YYYY-MM-DD` in UTC is the only accepted shape, because it is the only shape
 * API-Football's `fixtures?date=` parameter takes. No local-time conversion
 * happens anywhere in the pipeline: a date is a label for a day, not an instant.
 */

/** Shape check. Says nothing about whether the date exists — see `isIsoDate`. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How far either side of today the picker will accept.
 *
 * Not a provider limit — a typo guard. `2062-08-15` is a plausible slip on a
 * keyboard and an implausible thing to sync, and a request for it costs a real
 * slice of a 100-request daily allowance to learn nothing.
 */
export const MAX_SYNC_DATE_OFFSET_DAYS = 400;

/** Today in UTC, formatted the way every date in this pipeline is. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Whether a value is a real calendar date in `YYYY-MM-DD` form.
 *
 * The round-trip through `Date` is what rejects `2026-02-30`: the pattern alone
 * would pass it, `Date` would silently roll it to 2 March, and the sync would
 * quietly fetch a day nobody asked for.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** Days between two ISO dates, positive when `date` is after `reference`. */
export function daysBetween(date: string, reference: string): number {
  const a = new Date(`${date}T00:00:00Z`).getTime();
  const b = new Date(`${reference}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

export type DateValidation =
  | { ok: true; date: string }
  | { ok: false; reason: string };

/**
 * Validates a date the admin chose, with a message worth showing.
 *
 * Returning the reason rather than a bare boolean is deliberate: "date must be
 * formatted YYYY-MM-DD" and "date is more than 400 days from today" are fixed
 * by two different keystrokes, and the person reading it is the person typing.
 */
export function validateSyncDate(value: unknown, now: Date = new Date()): DateValidation {
  if (value === undefined || value === null || value === '') {
    return { ok: true, date: todayIso(now) };
  }
  if (!isIsoDate(value)) {
    return { ok: false, reason: 'Date must be a real calendar date formatted YYYY-MM-DD.' };
  }

  const offset = Math.abs(daysBetween(value, todayIso(now)));
  if (offset > MAX_SYNC_DATE_OFFSET_DAYS) {
    return {
      ok: false,
      reason: `Date must be within ${MAX_SYNC_DATE_OFFSET_DAYS} days of today.`,
    };
  }

  return { ok: true, date: value };
}

/** Bounds for the picker's `min`/`max`, so the browser rejects what we would. */
export function syncDateBounds(now: Date = new Date()): { min: string; max: string } {
  const shift = (days: number): string =>
    todayIso(new Date(now.getTime() + days * 86_400_000));
  return {
    min: shift(-MAX_SYNC_DATE_OFFSET_DAYS),
    max: shift(MAX_SYNC_DATE_OFFSET_DAYS),
  };
}
