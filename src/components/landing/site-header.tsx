'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppIcon } from '@/components/ui/icon';
import { Wordmark } from '@/components/landing/wordmark';
import { ButtonLink } from '@/components/ui/button';

const NAV = [
  { href: '/#product', label: 'Product' },
  { href: '/#analytics', label: 'Analytics' },
  { href: '/#monte-carlo', label: 'Monte Carlo' },
  { href: '/pricing', label: 'Pricing' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-5 lg:px-8">
        <Link href="/" aria-label="SportAlpha AI home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-body text-muted transition-colors hover:text-ink">
            Log in
          </Link>
          <ButtonLink href="/register" size="sm">
            Start free
          </ButtonLink>
        </div>

        <button
          type="button"
          className="rounded-lg border border-line p-2 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <AppIcon name={open ? 'close' : 'menu'} size={18} />
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-surface px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-body text-muted hover:bg-raised hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-body text-muted hover:bg-raised hover:text-ink"
            >
              Log in
            </Link>
          </nav>
          <ButtonLink href="/register" className="mt-3 w-full" onClick={() => setOpen(false)}>
            Start free
          </ButtonLink>
        </div>
      )}
    </header>
  );
}
