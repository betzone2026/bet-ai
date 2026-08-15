'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Season and coverage diagnostic, rendered from the stored reading.
 *
 * The table answers the question a hardcoded season window would have answered
 * wrongly: for each configured competition, which provider id we send, which
 * seasons that key can actually see, and whether fixtures are served for them.
 * Because it is a reading rather than an assumption, every row carries the time
 * it was taken, and refreshing it is an explicit, priced action.
 */

export interface CoverageRowView {
  leagueKey: string;
  name: string | null;
  country: string | null;
  providerLeagueId: string | null;
  currentSeason: number | null;
  latestSeason: number | null;
  /** Season years the key can see, newest first, for the tooltip. */
  seasonYears: number[];
  fixturesAvailable: boolean;
  error: string | null;
  /** Pre-formatted on the server so the two renders agree. */
  checkedAt: string | null;
  verdict: 'UNCHECKED' | 'ERROR' | 'NO_FIXTURES' | 'OK';
}

interface CoveragePayload {
  verification?: {
    status: string;
    rows: Array<{
      leagueKey: string;
      name: string | null;
      country: string | null;
      providerLeagueId: string | null;
      currentSeason: number | null;
      latestSeason: number | null;
      seasons: Array<{ year: number; fixtures?: boolean }>;
      fixturesAvailable: boolean;
      error: string | null;
      checkedAt: string | null;
      checked: boolean;
    }>;
    apiRequests: number;
    message: string;
    errors: string[];
  };
  error?: string;
  message?: string;
}

const VERDICT_LABEL: Record<CoverageRowView['verdict'], string> = {
  UNCHECKED: 'not checked',
  ERROR: 'error',
  NO_FIXTURES: 'no fixtures',
  OK: 'fixtures available',
};

const VERDICT_CLASS: Record<CoverageRowView['verdict'], string> = {
  UNCHECKED: 'text-muted',
  ERROR: 'text-down',
  NO_FIXTURES: 'text-alpha',
  OK: 'text-up',
};

type CoverageResponseRow = NonNullable<CoveragePayload['verification']>['rows'][number];

function verdictOf(row: CoverageResponseRow): CoverageRowView['verdict'] {
  if (!row.checked) return 'UNCHECKED';
  if (row.error) return 'ERROR';
  if (!row.fixturesAvailable) return 'NO_FIXTURES';
  return 'OK';
}

export function CoveragePanel({
  rows,
  cost,
  disabled,
}: {
  rows: CoverageRowView[];
  /** Requests a refresh would cost right now — zero while the reading is current. */
  cost: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(rows);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  async function refresh() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch('/api/admin/sports/coverage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Forced: the button exists to re-read, and a cached answer from a
        // button labelled "Re-check" would look like a silent failure.
        body: JSON.stringify({ force: true }),
      });
      const payload = (await response.json().catch(() => null)) as CoveragePayload | null;
      const verification = payload?.verification;

      if (!verification) {
        setNote({
          text: payload?.message ?? payload?.error ?? `Check failed (${response.status}).`,
          ok: false,
        });
        return;
      }

      setCurrent(
        verification.rows.map((row) => ({
          leagueKey: row.leagueKey,
          name: row.name,
          country: row.country,
          providerLeagueId: row.providerLeagueId,
          currentSeason: row.currentSeason,
          latestSeason: row.latestSeason,
          seasonYears: row.seasons.map((season) => season.year).sort((a, b) => b - a),
          fixturesAvailable: row.fixturesAvailable,
          error: row.error,
          checkedAt: row.checkedAt ? new Date(row.checkedAt).toLocaleString('en-GB') : null,
          verdict: verdictOf(row),
        })),
      );
      setNote({
        text: `${verification.message} ${verification.apiRequests} API request${verification.apiRequests === 1 ? '' : 's'} spent.`,
        ok: verification.status === 'ok' || verification.status === 'cached',
      });
      startTransition(() => router.refresh());
    } catch {
      setNote({ text: 'The request could not be sent.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs leading-relaxed text-muted">
          Read from the provider, not assumed. A refresh costs {cost === 0 ? 'nothing while the stored reading is current' : `${cost} API request${cost === 1 ? '' : 's'}`}.
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()} disabled={disabled || busy}>
          {busy ? 'Checking…' : 'Re-check seasons'}
        </Button>
      </div>

      {note && (
        <p className={`px-4 pb-3 text-xs ${note.ok ? 'text-muted' : 'text-down'}`}>{note.text}</p>
      )}

      <table className="w-full text-sm">
        <thead className="border-y border-line">
          <tr>
            <th className="eyebrow px-4 py-2.5 text-left font-normal">Competition</th>
            <th className="eyebrow px-4 py-2.5 text-left font-normal">League ID</th>
            <th className="eyebrow px-4 py-2.5 text-right font-normal">Current</th>
            <th className="eyebrow px-4 py-2.5 text-right font-normal">Latest</th>
            <th className="eyebrow px-4 py-2.5 text-right font-normal">Coverage</th>
            <th className="eyebrow px-4 py-2.5 text-right font-normal">Checked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {current.map((row) => (
            <tr key={row.leagueKey}>
              <td className="px-4 py-2.5">
                <span className="block max-w-[22ch] truncate">{row.name ?? row.leagueKey}</span>
                <span className="text-xs text-muted">{row.country ?? '—'}</span>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs">{row.providerLeagueId ?? '—'}</td>
              <td className="tabular px-4 py-2.5 text-right font-mono text-xs">
                {row.currentSeason ?? '—'}
              </td>
              <td
                className="tabular px-4 py-2.5 text-right font-mono text-xs text-muted"
                title={row.seasonYears.length > 0 ? `Seasons: ${row.seasonYears.join(', ')}` : undefined}
              >
                {row.latestSeason ?? '—'}
              </td>
              <td className={`px-4 py-2.5 text-right font-mono text-xs ${VERDICT_CLASS[row.verdict]}`}>
                {VERDICT_LABEL[row.verdict]}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                {row.checkedAt ?? 'never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {current.some((row) => row.error) && (
        <ul className="space-y-1 px-4 py-3 text-xs text-down">
          {current
            .filter((row) => row.error)
            .map((row) => (
              <li key={row.leagueKey}>
                <span className="font-mono">{row.leagueKey}</span> — {row.error}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
