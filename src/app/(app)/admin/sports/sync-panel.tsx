'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { AppIcon } from '@/components/ui/icon';
import type { LeagueKey } from '@/lib/sports/config';
import { isIsoDate, syncDateBounds, validateSyncDate } from '@/lib/sports/dates';

/**
 * The two controls that reach the provider, and the date they both act on.
 *
 * Check and Sync are deliberately the same request against the same date: the
 * only difference is that one writes. Pairing them under one date field is what
 * makes the check meaningful — checking one day and syncing another would be a
 * diagnostic that proves nothing.
 *
 * Every result reports the provider's total beside SportAlpha's match, and the
 * competitions behind those numbers, because "0 fixtures" on its own cannot
 * distinguish an empty day from a broken league filter.
 */

interface CompetitionSighting {
  providerLeagueId: string;
  name: string;
  country: string | null;
  fixtures: number;
  leagueKey: string | null;
  supported: boolean;
}

interface Outcome {
  kind: 'check' | 'sync';
  ok: boolean;
  headline: string;
  /** `Provider returned: 47 · SportAlpha matched: 8`, when counts are known. */
  counts: string | null;
  detail: string | null;
  cost: string | null;
  competitions: CompetitionSighting[];
}

interface PreviewPayload {
  preview?: {
    status: string;
    date: string;
    providerReturned: number;
    matched: number;
    competitions: CompetitionSighting[];
    apiRequests: number;
    message: string;
    errors?: string[];
    quota: { dailyLimit: number | null; dailyRemaining: number | null };
  };
  requestCost?: number;
  error?: string;
  message?: string;
  code?: string | null;
}

interface SyncPayload {
  summary?: {
    status: string;
    date: string;
    providerReturned: number;
    recordsMatched: number;
    recordsReceived: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsUnchanged: number;
    recordsFailed: number;
    apiRequests: number;
    competitions?: CompetitionSighting[];
    message?: string;
    skippedReason?: string;
    errors?: string[];
  };
  error?: string;
  message?: string;
  code?: string | null;
}

function counter(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-US');
}

export function SyncPanel({
  disabled,
  disabledReason,
  today,
  leagues,
}: {
  disabled: boolean;
  /** Shown under the controls so a disabled panel explains itself. */
  disabledReason?: string;
  /** Server-rendered default, so the field is filled before hydration. */
  today: string;
  /** Competitions the sync will filter to, for the cost note. */
  leagues: LeagueKey[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState<'check' | 'sync' | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const bounds = useMemo(() => syncDateBounds(), []);
  const validation = validateSyncDate(date === '' ? undefined : date);
  const dateError = validation.ok ? null : validation.reason;
  const blocked = disabled || busy !== null || pending || !validation.ok;

  async function post(kind: 'check' | 'sync') {
    // Belt and braces: the field is constrained and validated on change, and
    // the route validates again. Neither is redundant — a keyboard can put
    // anything in a date input, and the route is reachable without the field.
    if (!isIsoDate(date)) {
      setOutcome({
        kind,
        ok: false,
        headline: 'Choose a valid date before running this.',
        counts: null,
        detail: null,
        cost: null,
        competitions: [],
      });
      return;
    }

    setBusy(kind);
    setOutcome(null);

    try {
      const response = await fetch(
        kind === 'check' ? '/api/admin/sports/preview' : '/api/admin/sports/sync',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            kind === 'check' ? { date } : { syncType: 'fixtures', date, force: true },
          ),
        },
      );

      setOutcome(
        kind === 'check'
          ? readPreview(await response.json().catch(() => null), response.status)
          : readSync(await response.json().catch(() => null), response.status),
      );

      // Both paths move the quota, so both refresh the server-rendered panels.
      startTransition(() => router.refresh());
    } catch {
      setOutcome({
        kind,
        ok: false,
        headline: 'The request could not be sent.',
        counts: null,
        detail: null,
        cost: null,
        competitions: [],
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Date</span>
          <input
            type="date"
            value={date}
            min={bounds.min}
            max={bounds.max}
            required
            onChange={(event) => setDate(event.target.value)}
            className="min-h-touch rounded-lg border border-line bg-raised px-2.5 font-mono text-small text-ink focus-visible:border-alpha sm:min-h-0 sm:h-9"
            aria-label="Fixture date to check or sync (YYYY-MM-DD, UTC)"
            aria-invalid={dateError !== null}
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon="search"
          loading={busy === 'check'}
          onClick={() => void post('check')}
          disabled={blocked}
        >
          {busy === 'check' ? 'Checking…' : 'Check fixtures'}
        </Button>
        <Button
          type="button"
          size="sm"
          icon="refresh"
          loading={busy === 'sync'}
          onClick={() => void post('sync')}
          disabled={blocked}
        >
          {busy === 'sync' ? 'Syncing…' : 'Sync fixtures'}
        </Button>
      </div>

      <p className="text-fine leading-relaxed text-muted">
        Check and Sync each cost 1 API request against {leagues.length} configured competition
        {leagues.length === 1 ? '' : 's'}. Check writes nothing.
      </p>

      {dateError && <p className="text-fine text-down">{dateError}</p>}
      {disabled && disabledReason && (
        <p className="text-fine text-muted">{disabledReason}</p>
      )}

      {outcome && (
        <div
          className={`rounded-xl border px-4 py-3 text-left ${
            outcome.ok ? 'border-line bg-surface/60' : 'border-down/30 bg-down/[0.05]'
          }`}
        >
          <p className="eyebrow">
            {outcome.kind === 'check' ? 'Check fixtures' : 'Sync'}
            {outcome.cost ? ` · ${outcome.cost}` : ''}
          </p>
          <p className={`mt-1 text-small leading-relaxed ${outcome.ok ? 'text-ink' : 'text-down'}`}>
            {outcome.headline}
          </p>
          {outcome.counts && (
            <p className="tabular mt-1.5 font-mono text-fine text-muted">{outcome.counts}</p>
          )}
          {outcome.detail && (
            <p className="tabular mt-1 font-mono text-fine text-muted">{outcome.detail}</p>
          )}

          {outcome.competitions.length > 0 && (
            <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-line">
              <table className="w-full text-fine">
                <caption className="sr-only">
                  Competitions the provider returned for this date
                </caption>
                <thead className="sticky top-0 border-b border-line bg-surface">
                  <tr>
                    <th scope="col" className="eyebrow px-2.5 py-2 text-left font-normal">
                      Competition
                    </th>
                    <th scope="col" className="eyebrow px-2.5 py-2 text-left font-normal">
                      League ID
                    </th>
                    <th scope="col" className="eyebrow px-2.5 py-2 text-left font-normal">
                      Country
                    </th>
                    <th scope="col" className="eyebrow px-2.5 py-2 text-right font-normal">
                      Fixtures
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {outcome.competitions.map((competition) => (
                    <tr
                      key={competition.providerLeagueId}
                      className={competition.supported ? 'text-ink' : 'text-muted'}
                    >
                      <td className="max-w-[18ch] truncate px-2.5 py-1.5">
                        {competition.supported && (
                          <AppIcon
                            name="check"
                            size={16}
                            className="mr-1.5 inline h-3 w-3 text-up"
                            label="Supported competition"
                          />
                        )}
                        {competition.name}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono">{competition.providerLeagueId}</td>
                      <td className="max-w-[14ch] truncate px-2.5 py-1.5">
                        {competition.country ?? '—'}
                      </td>
                      <td className="tabular px-2.5 py-1.5 text-right font-mono">
                        {counter(competition.fixtures)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Turns the preview response into something a person can act on. */
function readPreview(payload: PreviewPayload | null, status: number): Outcome {
  const preview = payload?.preview;
  if (!preview) {
    return {
      kind: 'check',
      ok: false,
      headline: payload?.message ?? payload?.error ?? `Check failed (${status}).`,
      counts: null,
      detail: null,
      cost: null,
      competitions: [],
    };
  }

  const ok = preview.status === 'ok';
  return {
    kind: 'check',
    ok,
    headline: preview.message,
    counts: ok
      ? `Provider returned: ${preview.providerReturned} · SportAlpha matched: ${preview.matched}`
      : null,
    detail: ok
      ? `Daily remaining: ${counter(preview.quota.dailyRemaining)} of ${counter(preview.quota.dailyLimit)} · nothing was saved`
      : (preview.errors?.[0] ?? null),
    cost: `${preview.apiRequests} API request${preview.apiRequests === 1 ? '' : 's'}`,
    competitions: preview.competitions ?? [],
  };
}

/** Same, for the sync response, which also reports what was written. */
function readSync(payload: SyncPayload | null, status: number): Outcome {
  const summary = payload?.summary;
  if (!summary) {
    return {
      kind: 'sync',
      ok: false,
      headline: payload?.message ?? payload?.error ?? `Sync failed (${status}).`,
      counts: null,
      detail: null,
      cost: null,
      competitions: [],
    };
  }

  if (summary.status === 'failed') {
    // The code is the actionable part — a spent quota, a rejected key and a
    // plan restriction need three different responses from the operator.
    return {
      kind: 'sync',
      ok: false,
      headline: `${payload?.code ?? 'FAILED'}: ${summary.errors?.[0] ?? 'the sync did not complete.'}`,
      counts: null,
      detail: null,
      cost: `${summary.apiRequests} API request${summary.apiRequests === 1 ? '' : 's'}`,
      competitions: summary.competitions ?? [],
    };
  }

  if (summary.status === 'skipped') {
    return {
      kind: 'sync',
      ok: true,
      headline: summary.message ?? `Skipped: ${summary.skippedReason ?? 'nothing to do'}.`,
      counts: null,
      detail: null,
      cost: '0 API requests',
      competitions: [],
    };
  }

  return {
    kind: 'sync',
    ok: true,
    headline: summary.message ?? `${summary.status}: ${summary.date}`,
    counts: `Provider returned: ${summary.providerReturned} · SportAlpha matched: ${summary.recordsMatched}`,
    detail: `${summary.recordsReceived} received · ${summary.recordsInserted} new · ${summary.recordsUpdated} updated · ${summary.recordsUnchanged} unchanged · ${summary.recordsFailed} failed`,
    cost: `${summary.apiRequests} API request${summary.apiRequests === 1 ? '' : 's'}`,
    competitions: summary.competitions ?? [],
  };
}
