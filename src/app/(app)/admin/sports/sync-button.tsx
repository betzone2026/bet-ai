'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';

type Result = { ok: boolean; message: string } | null;

/**
 * Triggers an import from the admin screen.
 *
 * This is the only control in the product that spends provider quota, so it
 * reports what the run actually did — records received, written, failed —
 * rather than a bare success tick.
 */
export function SyncNowButton({
  disabled,
  disabledReason,
}: {
  disabled: boolean;
  /** Shown under the button so a disabled control explains itself. */
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/sports/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ syncType: 'fixtures', force: true }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        code?: string | null;
        summary?: {
          status: string;
          recordsReceived: number;
          recordsInserted: number;
          recordsUpdated: number;
          recordsFailed: number;
          apiRequests: number;
          skippedReason?: string;
          errors?: string[];
        };
      } | null;

      if (!payload?.summary) {
        setResult({
          ok: false,
          message: payload?.message ?? payload?.error ?? `Sync failed (${response.status}).`,
        });
        return;
      }

      const s = payload.summary;
      if (s.status === 'failed') {
        // The code is the actionable part — a spent quota, a rejected key and a
        // plan restriction need three different responses from the operator.
        setResult({
          ok: false,
          message: `${payload.code ?? 'FAILED'}: ${s.errors?.[0] ?? 'the sync did not complete.'}`,
        });
        return;
      }

      setResult({
        ok: true,
        message:
          s.status === 'skipped'
            ? `Skipped: ${s.skippedReason ?? 'nothing to do'}.`
            : `${s.status}: ${s.recordsReceived} received, ${s.recordsInserted} new, ${s.recordsUpdated} updated, ${s.recordsFailed} failed, ${s.apiRequests} API request${s.apiRequests === 1 ? '' : 's'}.`,
      });
      startTransition(() => router.refresh());
    } catch {
      setResult({ ok: false, message: 'The sync request could not be sent.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" size="sm" onClick={run} disabled={disabled || busy || pending}>
        {busy ? 'Syncing…' : 'Sync now'}
      </Button>
      {disabled && disabledReason && (
        <p className="max-w-sm text-right text-xs text-muted">{disabledReason}</p>
      )}
      {result && (
        <p className={`max-w-sm text-right text-xs ${result.ok ? 'text-muted' : 'text-down'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
