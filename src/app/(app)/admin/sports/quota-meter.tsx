'use client';

import { useEffect, useState } from 'react';
import { ProgressBar } from '@/components/ui/progress';

/**
 * The daily request allowance, drawn as a ratio rather than left as two
 * numbers to compare in the reader's head, plus the time until it resets.
 *
 * The countdown starts empty and fills in after mount: the remaining time
 * depends on the clock, and rendering it on the server would either
 * mismatch on hydration or be wrong by however long the page sat in a
 * cache.
 */
export function QuotaMeter({
  used,
  limit,
  remaining,
}: {
  used: number;
  limit: number | null;
  remaining: number | null;
}) {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      const now = new Date();
      const reset = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
      );
      const seconds = Math.max(Math.floor((reset - now.getTime()) / 1000), 0);
      const pad = (value: number) => String(value).padStart(2, '0');
      setCountdown(
        `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`,
      );
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Without a reported ceiling there is no ratio to draw, and inventing one
  // would misrepresent an unused key as a spent one.
  if (limit === null) {
    return (
      <div>
        <p className="text-small text-muted">
          The provider has not reported an allowance for this key yet. {used.toLocaleString('en-US')}{' '}
          request{used === 1 ? '' : 's'} counted today.
        </p>
        <Reset countdown={countdown} />
      </div>
    );
  }

  const spent = remaining === null ? used : Math.max(limit - remaining, 0);
  const share = limit > 0 ? spent / limit : 0;

  return (
    <div>
      <ProgressBar
        value={spent}
        max={limit}
        label="Daily requests"
        valueLabel={`${spent.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')}`}
        tone={share >= 0.9 ? 'danger' : share >= 0.7 ? 'warning' : 'accent'}
      />
      <p className="tabular mt-2 font-mono text-fine text-muted">
        {remaining === null ? '—' : remaining.toLocaleString('en-US')} remaining
      </p>
      <Reset countdown={countdown} />
    </div>
  );
}

function Reset({ countdown }: { countdown: string | null }) {
  return (
    <p className="tabular mt-1 font-mono text-fine text-muted">
      Reset in: <span className="text-ink">{countdown ?? '—'}</span> · 00:00 UTC
    </p>
  );
}
