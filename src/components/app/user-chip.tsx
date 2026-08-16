import { cn } from '@/lib/utils';

/** First letter of the local part, or two initials when it splits cleanly. */
export function initialsFor(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return (local.slice(0, 2) || '?').toUpperCase();
}

/**
 * Initials rather than a photograph: there is no avatar upload in the
 * product, and a generated illustration would be decoration in a place
 * that should carry identity.
 */
export function Avatar({
  email,
  size = 'md',
  className,
}: {
  email: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-line',
        'bg-raised font-mono font-medium text-ink-2',
        size === 'sm' ? 'h-7 w-7 text-micro' : 'h-8 w-8 text-fine',
        className,
      )}
    >
      {initialsFor(email)}
    </span>
  );
}
