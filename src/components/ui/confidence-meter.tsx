import { cn } from '@/lib/utils';

/**
 * Confidence is a tick scale, not a percentage bar: it measures how much
 * evidence sits behind an estimate, and a segmented readout keeps it from
 * being mistaken for a probability of winning.
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

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="tabular font-mono text-sm text-ink">{(score * 100).toFixed(0)}</span>
      </div>
      <div className="mt-1.5 flex gap-[3px]" role="img" aria-label={`${label} ${(score * 100).toFixed(0)} out of 100`}>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 flex-1 rounded-[1px]',
              i < filled ? 'bg-alpha' : 'bg-line',
            )}
          />
        ))}
      </div>
    </div>
  );
}
