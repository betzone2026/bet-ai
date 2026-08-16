import { cn, pct } from '@/lib/utils';
import type { Outcome1X2 } from '@/lib/types/domain';

/**
 * The distribution strip: the product's signature element.
 *
 * One horizontal bar carries the whole 1X2 distribution — width is
 * probability, so the shape of a fixture is legible before any number is
 * read. Segments are separated by a hairline of background rather than
 * rounded individually, which keeps it reading as a single measured
 * quantity instead of three decorative bars.
 */
interface ProbabilityBarProps {
  probabilities: Outcome1X2;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  homeLabel?: string;
  awayLabel?: string;
  className?: string;
}

const HEIGHTS = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' } as const;

interface Segment {
  key: 'home' | 'draw' | 'away';
  value: number;
  colour: string;
  label: string;
  tick: string;
}

function segmentsOf(
  { home, draw, away }: Outcome1X2,
  homeLabel: string,
  awayLabel: string,
): Segment[] {
  return [
    { key: 'home', value: home, colour: 'bg-alpha', label: homeLabel, tick: '1' },
    { key: 'draw', value: draw, colour: 'bg-muted/50', label: 'Draw', tick: 'X' },
    { key: 'away', value: away, colour: 'bg-info', label: awayLabel, tick: '2' },
  ];
}

export function ProbabilityBar({
  probabilities,
  size = 'md',
  showLabels = false,
  homeLabel = 'Home',
  awayLabel = 'Away',
  className,
}: ProbabilityBarProps) {
  const segments = segmentsOf(probabilities, homeLabel, awayLabel);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn('flex w-full gap-px overflow-hidden rounded-sm bg-raised', HEIGHTS[size])}
        role="img"
        aria-label={`Home ${pct(probabilities.home)}, draw ${pct(probabilities.draw)}, away ${pct(probabilities.away)}`}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={cn(segment.colour, 'transition-[width] duration-slow ease-ease')}
            style={{ width: `${Math.max(segment.value * 100, 0)}%` }}
          />
        ))}
      </div>

      {showLabels && (
        <div className="mt-2 flex items-baseline justify-between gap-2">
          {segments.map((segment) => (
            <div key={segment.key} className="flex min-w-0 items-baseline gap-1.5">
              <span className="font-mono text-micro text-muted">{segment.tick}</span>
              <span className="tabular font-mono text-small text-ink">{pct(segment.value)}</span>
              <span className="truncate text-fine text-muted">{segment.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The same distribution read as figures rather than widths.
 *
 * Three equal columns, monospace numerals, the outcome names as captions
 * underneath. The leading outcome takes the signal colour so the eye
 * lands on it first without any of the three being enlarged.
 */
export function OutcomeDistribution({
  probabilities,
  homeLabel = 'Home',
  awayLabel = 'Away',
  size = 'md',
  className,
}: {
  probabilities: Outcome1X2;
  homeLabel?: string;
  awayLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const segments = segmentsOf(probabilities, homeLabel, awayLabel);
  const leading = Math.max(probabilities.home, probabilities.draw, probabilities.away);

  return (
    <div className={cn('grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-line', className)}>
      {segments.map((segment) => (
        <div key={segment.key} className="bg-surface px-2 py-2.5 text-center">
          <p
            className={cn(
              'tabular font-mono font-medium',
              size === 'sm' ? 'text-data-sm' : 'text-data',
              segment.value === leading ? 'text-alpha' : 'text-ink',
            )}
          >
            {pct(segment.value)}
          </p>
          <p className="eyebrow mt-1 truncate">
            {segment.key === 'draw' ? 'Draw' : segment.key === 'home' ? 'Home' : 'Away'}
          </p>
        </div>
      ))}
    </div>
  );
}
