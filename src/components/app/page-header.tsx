import Link from 'next/link';
import { AppIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * The heading block every page opens with. Title, one line of context,
 * and the actions that belong to this screen — kept out of the top bar so
 * global chrome and page controls never compete for the same corner.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Renders a return link above the title, for detail screens. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('pb-6', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-touch items-center gap-1.5 text-small text-muted transition-colors duration-fast hover:text-ink sm:min-h-0"
        >
          <AppIcon name="back" size={16} />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1.5 font-display text-h1 font-semibold">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-body text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
