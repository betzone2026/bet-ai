'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';

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

const VERDICT_VARIANT: Record<CoverageRowView['verdict'], BadgeVariant> = {
  UNCHECKED: 'neutral',
  ERROR: 'danger',
  NO_FIXTURES: 'warning',
  OK: 'success',
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

  const columns: Array<Column<CoverageRowView>> = [
    {
      key: 'competition',
      header: 'Competition',
      primary: true,
      cell: (row) => (
        <span className="block">
          <span className="block truncate font-medium text-ink">{row.name ?? row.leagueKey}</span>
          <span className="block text-fine text-muted">{row.country ?? '—'}</span>
        </span>
      ),
    },
    {
      key: 'providerId',
      header: 'League ID',
      numeric: true,
      cell: (row) => row.providerLeagueId ?? '—',
    },
    {
      key: 'current',
      header: 'Current',
      align: 'right',
      numeric: true,
      cell: (row) => row.currentSeason ?? '—',
    },
    {
      key: 'latest',
      header: 'Latest',
      align: 'right',
      numeric: true,
      hideOnMobile: true,
      cell: (row) => (
        <span
          title={row.seasonYears.length > 0 ? `Seasons: ${row.seasonYears.join(', ')}` : undefined}
        >
          {row.latestSeason ?? '—'}
        </span>
      ),
    },
    {
      key: 'coverage',
      header: 'Coverage',
      align: 'right',
      cell: (row) => <Badge variant={VERDICT_VARIANT[row.verdict]}>{VERDICT_LABEL[row.verdict]}</Badge>,
    },
    {
      key: 'checked',
      header: 'Checked',
      align: 'right',
      numeric: true,
      hideOnMobile: true,
      cell: (row) => row.checkedAt ?? 'never',
    },
  ];

  return (
    <div>
      <Card className="mb-3">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-fine leading-relaxed text-muted">
            Read from the provider, not assumed. A refresh costs {cost === 0 ? 'nothing while the stored reading is current' : `${cost} API request${cost === 1 ? '' : 's'}`}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon="refresh"
            loading={busy}
            onClick={() => void refresh()}
            disabled={disabled || busy}
          >
            {busy ? 'Checking…' : 'Re-check seasons'}
          </Button>
        </CardBody>
        {note && (
          <p
            className={`border-t border-line px-4 py-2.5 text-small ${note.ok ? 'text-muted' : 'text-down'}`}
          >
            {note.text}
          </p>
        )}
      </Card>

      <DataTable
        columns={columns}
        rows={current}
        rowKey={(row) => row.leagueKey}
        caption="Season coverage per configured competition, as last read from the provider"
      />

      {current.some((row) => row.error) && (
        <ul className="mt-3 space-y-1 text-fine text-down">
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
