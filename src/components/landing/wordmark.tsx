import { cn } from '@/lib/utils';

/**
 * The mark is typographic: "SPORT" in body weight, "ALPHA" carrying the
 * signal colour so the word the product is named for is the one the eye
 * lands on, and a monospace "AI" set apart like a ticker suffix.
 *
 * The two sizes here are the only literal ones left in the interface, and
 * deliberately so: a logo is drawn artwork whose proportions are fixed
 * against each other, not text that should resize with the type scale.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-baseline gap-1.5', className)}>
      <span className="font-display text-[15px] font-bold leading-none tracking-[0.03em]">
        SPORT<span className="text-alpha">ALPHA</span>
      </span>
      <span className="rounded-[3px] border border-line bg-raised px-1 py-px font-mono text-[9px] font-medium leading-none tracking-[0.18em] text-muted">
        AI
      </span>
    </span>
  );
}

/**
 * The compact mark, for a collapsed sidebar and small-screen chrome.
 * A square monogram rather than a shrunken wordmark, so it stays legible
 * at the size an app icon would be.
 */
export function WordmarkCompact({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-alpha/30',
        'bg-alpha/10 font-display text-fine font-bold leading-none tracking-[0.06em] text-alpha',
        className,
      )}
    >
      SA
    </span>
  );
}
