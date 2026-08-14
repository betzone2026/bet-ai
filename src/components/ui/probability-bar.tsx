'use client';

import { cn, pct } from '@/lib/utils';
import type { Outcome1X2 } from '@/lib/types/domain';

/**
 * The distribution strip: the product's signature element.
 *
 * One horizontal bar carries the whole 1X2 distribution — width is
 * probability, so the shape of a fixture is legible before any number is
 * read. It recurs at three sizes across the landing page, the match
 * list, the analyser and the simulation results, which is what makes the
 * interface feel like one instrument rather than a set of screens.
 */
interface ProbabilityBarProps {
  probabilities: Outcome1X2;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  homeLabel?: string;
  awayLabel?: string;
  className?: string;
}

const HEIGHTS = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' } as const;

export function ProbabilityBar({
  probabilities,
  size = 'md',
  showLabels = false,
  homeLabel = 'Home',
  awayLabel = 'Away',
  className,
}: ProbabilityBarProps) {
  const { home, draw, away } = probabilities;
  const segments = [
    { key: 'home', value: home, colour: 'bg-alpha', label: homeLabel, tick: '1' },
    { key: 'draw', value: draw, colour: 'bg-muted/45', label: 'Draw', tick: 'X' },
    { key: 'away', value: away, colour: 'bg-data', label: awayLabel, tick: '2' },
  ];

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn('flex w-full overflow-hidden rounded-sm bg-raised', HEIGHTS[size])}
        role="img"
        aria-label={`Home ${pct(home)}, draw ${pct(draw)}, away ${pct(away)}`}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className={cn(s.colour, 'transition-[width] duration-500 ease-out')}
            style={{ width: `${Math.max(s.value * 100, 0)}%` }}
          />
        ))}
      </div>

      {showLabels && (
        <div className="mt-2 flex items-baseline justify-between gap-2">
          {segments.map((s) => (
            <div key={s.key} className="flex min-w-0 items-baseline gap-1.5">
              <span className="font-mono text-[10px] text-muted">{s.tick}</span>
              <span className="tabular font-mono text-xs text-ink">{pct(s.value)}</span>
              <span className="truncate text-[11px] text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
