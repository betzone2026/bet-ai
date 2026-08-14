/**
 * The standing statement about what the product does and does not claim.
 * Rendered in the footer of every marketing page and once inside the
 * application shell so it is never more than one screen away.
 */
export const DISCLAIMER =
  'SportAlpha AI provides statistical and probabilistic analysis for informational purposes only. Predictions are not guarantees of future results.';

export function DisclaimerNote({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-xs leading-relaxed text-muted'}>{DISCLAIMER}</p>
  );
}
