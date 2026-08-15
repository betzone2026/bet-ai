/**
 * Fixture preview — "Check fixtures".
 *
 * The same request a sync would make, with the writing left out. It exists
 * because the two questions an operator has before importing a day —
 * *is there anything there?* and *does our league filter find it?* — used to be
 * answerable only by spending the request and then reading the result of a
 * write. That made every diagnostic attempt a mutation.
 *
 * What it does persist is bookkeeping, not data: the quota reading the response
 * carried and the request counter. Those must be recorded precisely *because*
 * the call was real — a check that spent a request without saying so would make
 * the daily allowance on the admin screen quietly wrong.
 *
 * Cost: exactly one request against `fixtures?date=`, the same as a sync.
 */

import { DEFAULT_PROVIDER, SUPPORTED_LEAGUE_KEYS, type LeagueKey } from './config.ts';
import { todayIso } from './dates.ts';
import { describeError } from './errors.ts';
import { describeFixtureOutcome } from './messages.ts';
import type { CompetitionSighting, SportsDataProvider } from './provider.ts';
import {
  canSpendQuota,
  readProviderQuota,
  recordQuotaObservation,
  type ProviderQuota,
} from './quota.ts';
import { getProvider } from './registry.ts';
import { recordApiRequests } from './usage.ts';

export interface PreviewFixturesOptions {
  /** ISO date (`YYYY-MM-DD`, UTC). Defaults to today. */
  date?: string;
  leagues?: LeagueKey[];
  provider?: string;
  /** Injected in tests; production resolves through the registry. */
  providerInstance?: SportsDataProvider;
}

export interface FixturePreview {
  provider: string;
  date: string;
  leagues: LeagueKey[];
  status: 'ok' | 'skipped' | 'failed';
  /** `API_NOT_CONFIGURED` or `RATE_LIMITED` when nothing was attempted. */
  skippedReason?: string;
  /** Fixtures the provider sent for the date, across every competition. */
  providerReturned: number;
  /** Of those, the ones in a configured competition — what a sync would import. */
  matched: number;
  /** Every competition in the response, supported first, then by size. */
  competitions: CompetitionSighting[];
  /** Requests this check actually spent. */
  apiRequests: number;
  /** The allowance as it stands after the check. */
  quota: ProviderQuota;
  message: string;
  errors: string[];
}

/**
 * Fetches a day and reports it without storing a single fixture.
 *
 * Never throws: a preview that failed is a preview with a `failed` status and a
 * message, because the caller is a button on an admin screen.
 */
export async function previewFixtures(
  options: PreviewFixturesOptions = {},
): Promise<FixturePreview> {
  const providerName = options.provider ?? DEFAULT_PROVIDER;
  const date = options.date ?? todayIso();
  const leagues = options.leagues?.length ? options.leagues : SUPPORTED_LEAGUE_KEYS;

  const preview: FixturePreview = {
    provider: providerName,
    date,
    leagues,
    status: 'failed',
    providerReturned: 0,
    matched: 0,
    competitions: [],
    apiRequests: 0,
    quota: await readProviderQuota(providerName),
    message: '',
    errors: [],
  };

  let provider: SportsDataProvider;
  try {
    provider = options.providerInstance ?? getProvider(providerName);
  } catch (error) {
    preview.errors.push(describeError(error));
    preview.message = describeError(error);
    return preview;
  }

  if (!provider.isConfigured()) {
    preview.status = 'skipped';
    preview.skippedReason = 'API_NOT_CONFIGURED';
    preview.message = 'No provider key is configured, so no request was attempted.';
    return preview;
  }

  // A check is a real request, so it obeys the same measured-zero ceiling a
  // sync does. There is no point spending the last of an allowance to learn
  // that the allowance is spent.
  if (!canSpendQuota(preview.quota)) {
    preview.status = 'skipped';
    preview.skippedReason = 'RATE_LIMITED';
    preview.message = `The daily request allowance is spent (0 of ${preview.quota.dailyLimit ?? '?'} left); it resets at 00:00 UTC.`;
    preview.errors.push(`[RATE_LIMITED] ${preview.message}`);
    return preview;
  }

  try {
    const inspection = await provider.inspectFixtures({ date, leagues });
    preview.providerReturned = inspection.providerReturned;
    preview.matched = inspection.matched;
    preview.competitions = inspection.competitions;
    preview.status = 'ok';
    preview.message = describeFixtureOutcome({
      providerReturned: inspection.providerReturned,
      matched: inspection.matched,
      date,
      provider: providerName,
    });

    if (inspection.unmappable > 0) {
      preview.errors.push(
        `${inspection.unmappable} matched fixture(s) are missing identifiers and would not be stored.`,
      );
    }
  } catch (error) {
    preview.status = 'failed';
    preview.errors.push(describeError(error));
    preview.message = describeError(error);
  }

  // Recorded whichever way it went: a failed call still spent a request, and an
  // error response is often the most informative quota reading there is.
  const report = provider.lastResponse?.() ?? null;
  if (report) await recordQuotaObservation(providerName, report);

  const usage = provider.usage();
  preview.apiRequests = usage.reduce((total, entry) => total + entry.requests, 0);
  await recordApiRequests(providerName, usage);
  preview.quota = await readProviderQuota(providerName);

  return preview;
}
