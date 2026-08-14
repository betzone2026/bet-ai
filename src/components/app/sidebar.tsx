'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/landing/wordmark';
import { NAV_ITEMS, ADMIN_ITEM } from './nav-items';
import { PlanBadge } from './plan-badge';
import { cn } from '@/lib/utils';
import type { PlanId } from '@/lib/config/plans';

export function Sidebar({ plan, isAdmin }: { plan: PlanId; isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface/50 lg:flex">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Link href="/dashboard" aria-label="SportAlpha AI dashboard">
          <Wordmark />
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink',
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'text-alpha')} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <PlanBadge plan={plan} />
      </div>
    </aside>
  );
}
