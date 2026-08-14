import { cn } from '@/lib/utils';

/** A single figure with its caption. Used across dashboard and admin. */
export function Stat({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface px-4 py-3.5 hairline-top', className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'tabular mt-2 font-mono text-2xl font-medium leading-none',
          accent ? 'text-alpha' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
