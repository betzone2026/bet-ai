'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { Wordmark, WordmarkCompact } from '@/components/landing/wordmark';
import { AppIcon } from '@/components/ui/icon';
import { Avatar } from './user-chip';
import { PlanCard } from './plan-badge';
import { isActive, sectionsFor, SIDEBAR_KEY, type NavItem } from './nav-items';
import { cn } from '@/lib/utils';
import type { PlanId } from '@/lib/config/plans';

/**
 * The desktop rail: 256px expanded, 68px collapsed, hidden below `lg`
 * where the bottom navigation takes over. Its width is driven by
 * `<html data-sidebar>` in CSS so the stored preference is honoured on
 * the first paint; the state held here only keeps the toggle's icon and
 * `aria-expanded` in step with what the reader sees.
 */
/**
 * The collapsed preference lives on `<html data-sidebar>`, written by an
 * inline script before first paint so the rail never flashes at the wrong
 * width. React subscribes to it rather than owning it: the server has no
 * way to know the stored value, so it is read through
 * `useSyncExternalStore`, which renders the server snapshot during
 * hydration and swaps to the real one immediately after.
 */
const listeners = new Set<() => void>();

function subscribeToSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readSidebar(): boolean {
  return document.documentElement.dataset.sidebar === 'collapsed';
}

/** Expanded is the default the server markup is written for. */
function serverSidebar(): boolean {
  return false;
}

export function Sidebar({
  plan,
  email,
  isAdmin,
}: {
  plan: PlanId;
  email: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToSidebar, readSidebar, serverSidebar);

  function toggle() {
    const next = !collapsed;
    document.documentElement.dataset.sidebar = next ? 'collapsed' : 'expanded';
    try {
      window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      // A blocked storage API costs the preference, not the interface.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <aside className="sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface/60 lg:flex">
      <div className="sidebar-center flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Link
          href="/dashboard"
          aria-label="SportAlpha AI dashboard"
          className="flex items-center gap-2.5 rounded-md"
        >
          <WordmarkCompact />
          <Wordmark className="sidebar-expanded-only" />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
        {sectionsFor(isAdmin).map((section, index) => (
          <div key={section.id} className={index > 0 ? 'mt-3 border-t border-line pt-3' : undefined}>
            {section.label && (
              <p className="eyebrow sidebar-expanded-only px-3 pb-1.5">{section.label}</p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-line p-3">
        <PlanCard plan={plan} className="sidebar-expanded-only" />

        <div className="sidebar-center flex items-center gap-2 px-1">
          <Link
            href="/settings"
            className="sidebar-link relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left"
            aria-label={`Profile — ${email}`}
          >
            <Avatar email={email} />
            <span className="sidebar-expanded-only min-w-0 flex-1">
              <span className="block truncate text-small text-ink">{email}</span>
              <span className="block text-fine text-muted">View profile</span>
            </span>
            <span className="sidebar-tip" aria-hidden>
              {email}
            </span>
          </Link>

          <form action="/auth/signout" method="get" className="sidebar-expanded-only shrink-0">
            <button
              type="submit"
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-fast hover:border-line-active hover:text-ink"
            >
              <AppIcon name="logout" size={16} />
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="sidebar-center flex w-full items-center gap-3 rounded-lg px-3 py-2 text-small text-muted transition-colors duration-fast hover:bg-raised hover:text-ink"
        >
          <AppIcon name={collapsed ? 'expand' : 'collapse'} size={18} className="shrink-0" />
          <span className="sidebar-expanded-only">Collapse</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'sidebar-link sidebar-center relative flex items-center gap-3 rounded-lg px-3 py-2',
        'text-small transition-colors duration-fast',
        active
          ? 'bg-raised text-ink shadow-card'
          : 'text-muted hover:bg-raised/60 hover:text-ink',
      )}
    >
      <AppIcon
        name={item.icon}
        size={18}
        className={cn('shrink-0', active ? 'text-alpha' : 'text-current')}
      />
      <span className="sidebar-expanded-only truncate">{item.label}</span>
      <span className="sidebar-tip" aria-hidden>
        {item.label}
      </span>
    </Link>
  );
}
