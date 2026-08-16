import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Confidence measures how much evidence sits behind an estimate. It is
 * not a probability of winning, and the whole design of this component
 * is aimed at that one confusion: the figure is shown out of 100 rather
 * than as a percentage, it is banded with a word, and every instance
 * carries the definition.
 */
/* Class names are written out in full rather than composed at runtime:
   Tailwind scans source text, so a class it never sees literally is a
   class it never generates. */
const BANDS = [
  { floor: 0.75, label: 'Strong', ring: 'stroke-up', bar: 'bg-up', text: 'text-up' },
  { floor: 0.6, label: 'Good', ring: 'stroke-alpha', bar: 'bg-alpha', text: 'text-alpha' },
  { floor: 0.4, label: 'Fair', ring: 'stroke-info', bar: 'bg-info', text: 'text-info' },
  { floor: 0, label: 'Weak', ring: 'stroke-muted', bar: 'bg-muted', text: 'text-muted' },
] as const;

function bandFor(score: number) {
  return BANDS.find((band) => score >= band.floor) ?? BANDS[BANDS.length - 1]!;
}

const EXPLANATION =
  'How much data and model agreement sit behind this estimate, out of 100. It is not the chance of the outcome happening.';

/**
 * The full readout: a progress ring with the score inside and the band
 * beside it. Used wherever there is room to show confidence properly.
 */
export function ConfidenceScore({
  score,
  size = 64,
  label = 'Confidence',
  className,
}: {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const band = bandFor(score);
  const value = Math.round(score * 100);

  const stroke = size <= 48 ? 4 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label} ${value} out of 100, ${band.label}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-line"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * score} ${circumference}`}
            className={cn(band.ring, 'transition-[stroke-dasharray] duration-slow ease-ease')}
          />
        </svg>
        <span
          className="tabular absolute inset-0 flex items-center justify-center font-mono font-medium"
          style={{ fontSize: size * 0.3 }}
          aria-hidden
        >
          {value}
        </span>
      </span>

      <span className="min-w-0">
        <Tooltip content={<><strong className="text-ink">{label}.</strong> {EXPLANATION}</>}>
          <span className="eyebrow">{label}</span>
        </Tooltip>
        <span className={cn('mt-0.5 block font-display text-h3 font-semibold', band.text)}>
          {band.label}
        </span>
      </span>
    </div>
  );
}

/**
 * The compact form: a tick scale for cards and table rows. Segmented
 * rather than continuous, again so it is not mistaken for a probability.
 */
export function ConfidenceMeter({
  score,
  segments = 10,
  className,
  label = 'Confidence',
}: {
  score: number;
  segments?: number;
  className?: string;
  label?: string;
}) {
  const filled = Math.round(score * segments);
  const band = bandFor(score);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow truncate">{label}</span>
        <span className={cn('tabular font-mono text-small', band.text)}>
          {Math.round(score * 100)}
        </span>
      </div>
      <div
        className="mt-1.5 flex gap-[3px]"
        role="img"
        aria-label={`${label} ${Math.round(score * 100)} out of 100, ${band.label}`}
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-2.5 flex-1 rounded-[1px] transition-colors duration-base',
              index < filled ? band.bar : 'bg-line',
            )}
          />
        ))}
      </div>
    </div>
  );
}
