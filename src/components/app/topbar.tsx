'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Wordmark } from '@/components/landing/wordmark';
import { getPlan, type PlanId } from '@/lib/config/plans';

export function Topbar({ email, plan }: { email: string; plan: PlanId }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-base/90 px-4 backdrop-blur lg:px-6">
      <Link href="/dashboard" className="lg:hidden" aria-label="SportAlpha AI dashboard">
        <Wordmark />
      </Link>

      <div className="hidden lg:block">
        <span className="eyebrow">Terminal</span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/subscription"
          className="hidden rounded-md border border-line bg-raised px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-alpha sm:block"
        >
          {getPlan(plan).name}
        </Link>
        <span className="hidden max-w-[16ch] truncate text-xs text-muted md:block">{email}</span>
        <form action="/auth/signout" method="get">
          <button
            type="submit"
            className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-muted hover:text-ink"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
