'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { IconName } from '@/lib/icons';

/**
 * The console's own navigation, listed in the order an operator works
 * through it. Sections that exist are links; the rest are shown greyed
 * with a "not built" marker rather than hidden — an operator needs to know
 * what the console does not yet cover, and a tab that 404s is worse than
 * one that says so.
 */
export interface AdminSection {
  label: string;
  icon: IconName;
  href?: string;
  /** Matches child routes too, e.g. /admin/sports/leagues. */
  match?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { label: 'Overview', icon: 'admin', href: '/admin', match: '/admin' },
  { label: 'Sports data', icon: 'sportsData', href: '/admin/sports', match: '/admin/sports' },
  { label: 'Users', icon: 'users' },
  { label: 'Subscriptions', icon: 'subscription' },
  { label: 'Models', icon: 'models' },
  { label: 'API usage', icon: 'apiUsage', href: '/admin/sports#quota' },
  { label: 'Logs', icon: 'logs' },
];

export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className={cn('mb-6', className)}>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {ADMIN_SECTIONS.map((section) => {
          const active =
            section.match !== undefined &&
            (section.match === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(section.match));

          if (!section.href) {
            return (
              <li key={section.label}>
                <span
                  title="Not built yet"
                  className="inline-flex min-h-touch shrink-0 items-center gap-2 rounded-lg border border-dashed border-line px-3 text-small text-muted/70 sm:min-h-0 sm:h-9"
                >
                  <AppIcon name={section.icon} size={16} className="opacity-60" />
                  {section.label}
                  <span className="sr-only">— not built yet</span>
                </span>
              </li>
            );
          }

          return (
            <li key={section.label}>
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-touch shrink-0 items-center gap-2 rounded-lg border px-3 text-small',
                  'transition-colors duration-fast sm:min-h-0 sm:h-9',
                  active
                    ? 'border-alpha/45 bg-alpha/10 text-alpha'
                    : 'border-line bg-raised/50 text-muted hover:border-line-active hover:text-ink',
                )}
              >
                <AppIcon name={section.icon} size={16} />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
