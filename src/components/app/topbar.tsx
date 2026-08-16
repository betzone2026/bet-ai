'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { WordmarkCompact } from '@/components/landing/wordmark';
import { AppIcon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/button';
import { StatusBadge, type DataStatus } from '@/components/ui/badge';
import { Modal, BottomSheet } from '@/components/ui/overlay';
import { EmptyState } from '@/components/ui/states';
import { Avatar } from './user-chip';
import { PlanBadge } from './plan-badge';
import { routeTitle, sectionsFor, type NavItem } from './nav-items';
import { cn } from '@/lib/utils';
import type { PlanId } from '@/lib/config/plans';

/**
 * The top bar answers, left to right: where am I, is the data real, and
 * whose account is this. Everything in it is either orientation or
 * account state — no page actions live here, because they belong beside
 * the content they act on.
 */
export function Topbar({
  email,
  plan,
  isAdmin,
  dataStatus,
}: {
  email: string;
  plan: PlanId;
  isAdmin: boolean;
  dataStatus: DataStatus;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const title = routeTitle(pathname);

  return (
    <header className="sticky top-0 z-sticky flex h-16 shrink-0 items-center gap-3 border-b border-line bg-base/85 px-4 backdrop-blur lg:px-6">
      <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="SportAlpha AI dashboard">
        <WordmarkCompact />
      </Link>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        <Link href="/dashboard" className="eyebrow shrink-0 transition-colors duration-fast hover:text-ink">
          SportAlpha AI
        </Link>
        <span aria-hidden className="text-line-active">
          /
        </span>
        <span className="eyebrow truncate text-ink">{title}</span>
      </nav>

      <span className="min-w-0 flex-1 truncate font-display text-h3 font-semibold md:hidden">
        {title}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={dataStatus} className="hidden sm:inline-flex" />

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden h-9 w-44 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-small text-muted transition-colors duration-fast hover:border-line-active hover:text-ink lg:flex"
        >
          <AppIcon name="search" size={16} />
          Go to…
        </button>

        <IconButton
          label="Search"
          icon="search"
          variant="ghost"
          onClick={() => setSearchOpen(true)}
          className="lg:hidden"
        />

        <IconButton
          label="Notifications"
          icon="notifications"
          variant="ghost"
          onClick={() => setAlertsOpen(true)}
        />

        <PlanBadge plan={plan} className="hidden sm:inline-flex" />

        <Link
          href="/settings"
          aria-label={`Account — ${email}`}
          className="hidden rounded-full md:block"
        >
          <Avatar email={email} />
        </Link>
      </div>

      <NavPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        isAdmin={isAdmin}
      />

      <BottomSheet
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        title="Notifications"
      >
        <EmptyState
          icon="notifications"
          title="Nothing to report."
          description="Model alerts and sync notices will appear here."
        />
      </BottomSheet>
    </header>
  );
}

/**
 * Search over the product's destinations. It deliberately does not query
 * fixtures or models: this is orientation, and a control that sometimes
 * returns data and sometimes returns pages is a control nobody trusts.
 */
function NavPalette({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const items = useMemo<NavItem[]>(
    () => sectionsFor(isAdmin).flatMap((section) => section.items),
    [isAdmin],
  );

  const term = query.trim().toLowerCase();
  const results = term ? items.filter((item) => item.label.toLowerCase().includes(term)) : items;

  function go(href: string) {
    onClose();
    setQuery('');
    router.push(href);
  }

  return (
    <Modal open={open} onClose={onClose} title="Go to" description="Jump to any section.">
      {/* The row is the control, so it carries the focus ring and the
          input inside it suppresses its own. */}
      <label className="flex items-center gap-2 rounded-lg border border-line bg-base px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-alpha">
        <AppIcon name="search" size={16} className="shrink-0 text-muted" />
        <span className="sr-only">Search sections</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0]) {
              event.preventDefault();
              go(results[0].href);
            }
          }}
          placeholder="Dashboard, Monte Carlo, Settings…"
          className="min-h-touch w-full bg-transparent text-body text-ink outline-none placeholder:text-muted sm:min-h-0 sm:h-10"
        />
      </label>

      {results.length === 0 ? (
        <p className="py-6 text-center text-small text-muted">No section matches “{query}”.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {results.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                onClick={() => go(item.href)}
                className={cn(
                  'flex min-h-touch w-full items-center gap-3 rounded-lg px-3 text-left text-body',
                  'text-ink-2 transition-colors duration-fast hover:bg-raised hover:text-ink sm:min-h-0 sm:h-10',
                )}
              >
                <AppIcon name={item.icon} size={18} className="text-muted" />
                {item.label}
                <AppIcon name="enter" size={16} className="ml-auto text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
