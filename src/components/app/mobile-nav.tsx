'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AppIcon } from '@/components/ui/icon';
import { BottomSheet } from '@/components/ui/overlay';
import { PlanCard } from './plan-badge';
import { isActive, overflowItems, PRIMARY_ITEMS, type NavItem } from './nav-items';
import { cn } from '@/lib/utils';
import type { PlanId } from '@/lib/config/plans';

/**
 * The small-screen navigation: four destinations as tabs plus a "More"
 * sheet for everything else. A compressed copy of the desktop sidebar
 * was the alternative and it is the wrong instrument — a rail of eleven
 * 32px rows is neither reachable by thumb nor readable.
 *
 * Fixed to the bottom, padded past the home indicator, and every target
 * is at least 44px tall.
 */
export function MobileNav({
  plan,
  email,
  isAdmin,
}: {
  plan: PlanId;
  email: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  const overflow = overflowItems(isAdmin);

  // Navigating from inside the sheet should leave it behind. Adjusted
  // during render rather than in an effect: the sheet must not paint once
  // over the new route before closing itself.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setMoreOpen(false);
  }

  const moreActive = overflow.some((item) => isActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-nav grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {PRIMARY_ITEMS.map((item) => (
          <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(TAB_CLASS, moreActive || moreOpen ? 'text-alpha' : 'text-muted')}
        >
          {(moreActive || moreOpen) && <ActiveMark />}
          <AppIcon name="more" size={20} />
          More
        </button>
      </nav>

      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        description={email}
      >
        <ul className="space-y-1">
          {overflow.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch items-center gap-3 rounded-lg px-3 text-body',
                  'transition-colors duration-fast',
                  isActive(pathname, item.href)
                    ? 'bg-raised text-ink'
                    : 'text-ink-2 hover:bg-raised/60 hover:text-ink',
                )}
              >
                <AppIcon
                  name={item.icon}
                  size={18}
                  className={isActive(pathname, item.href) ? 'text-alpha' : 'text-muted'}
                />
                {item.label}
                <AppIcon name="chevronRight" size={16} className="ml-auto text-muted" />
              </Link>
            </li>
          ))}
        </ul>

        <PlanCard plan={plan} className="mt-4" />

        <form action="/auth/signout" method="get" className="mt-2">
          <button
            type="submit"
            className="flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border border-line text-small text-muted transition-colors duration-fast hover:border-down/40 hover:text-down"
          >
            <AppIcon name="logout" size={16} />
            Log out
          </button>
        </form>
      </BottomSheet>
    </>
  );
}

const TAB_CLASS =
  'relative flex min-h-touch flex-col items-center justify-center gap-1 px-1 py-2 text-micro font-medium transition-colors duration-fast';

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(TAB_CLASS, active ? 'text-alpha' : 'text-muted')}
    >
      {active && <ActiveMark />}
      <AppIcon name={item.icon} size={20} />
      {item.shortLabel ?? item.label}
    </Link>
  );
}

/** A rule along the top edge of the active tab — legible without relying
    on colour alone, which the accent-on-dark pairing would otherwise. */
function ActiveMark() {
  return <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-b-sm bg-alpha" />;
}
