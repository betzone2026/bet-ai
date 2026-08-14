import { cn } from '@/lib/utils';

/**
 * The mark is typographic: "SPORT" in body weight, "ALPHA" carrying the
 * signal colour, and a monospace "AI" set apart like a ticker suffix.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-baseline gap-1.5', className)}>
      <span className="font-display text-[15px] font-bold tracking-[0.02em]">
        SPORT<span className="text-alpha">ALPHA</span>
      </span>
      <span className="rounded-[3px] border border-line bg-raised px-1 font-mono text-[9px] font-medium tracking-[0.18em] text-muted">
        AI
      </span>
    </span>
  );
}
