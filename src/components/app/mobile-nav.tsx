'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';
import { cn } from '@/lib/utils';

/** Four primary destinations, fixed to the bottom on small screens. */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.primary);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[10px]',
              active ? 'text-alpha' : 'text-muted',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
