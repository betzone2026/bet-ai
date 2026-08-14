import Link from 'next/link';
import { Wordmark } from '@/components/landing/wordmark';
import { DisclaimerNote } from '@/components/ui/compliance';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/#product', label: 'Overview' },
      { href: '/#analytics', label: 'Analytics' },
      { href: '/#monte-carlo', label: 'Monte Carlo' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/register', label: 'Create account' },
      { href: '/reset-password', label: 'Reset password' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/responsible-gambling', label: 'Responsible gambling' },
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/risk-disclosure', label: 'Risk disclosure' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="mx-auto max-w-shell px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Turn sports data into probabilities.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="eyebrow">{column.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-line pt-8">
          <DisclaimerNote className="max-w-3xl text-xs leading-relaxed text-muted" />
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            Nothing on this platform is betting advice. If gambling is affecting your life,
            support is available in most countries through national helplines and services
            such as GamCare, BeGambleAware and Gambling Therapy.
          </p>
          <p className="pt-2 text-xs text-muted">
            © {new Date().getFullYear()} SportAlpha AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
