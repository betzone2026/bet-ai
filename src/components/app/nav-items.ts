import type { IconName } from '@/lib/icons';

/** localStorage key for the sidebar's collapsed preference. Declared here,
    in a module both the server layout and the client rail can import. */
export const SIDEBAR_KEY = 'sa.sidebar';

/**
 * The application's information architecture, declared once.
 *
 * The sidebar, the mobile bottom bar, its "More" sheet and the top bar's
 * breadcrumb all read from this file, which is why they can never disagree
 * about what a route is called or which icon it carries.
 *
 * Only routes that exist appear here. The admin sections that have not
 * been built yet are listed on the admin overview instead, marked as such
 * — a navigation item that leads to a 404 is worse than one that is
 * honest about not existing.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown as a tab in the mobile bottom bar; the rest live behind "More". */
  primary?: boolean;
  /** Short form for the bottom bar, where horizontal room is scarce. */
  shortLabel?: string;
}

export interface NavSection {
  id: string;
  /** Rendered as a small uppercase divider label. Omitted for the first group. */
  label?: string;
  items: NavItem[];
  /** Only rendered for administrators. */
  adminOnly?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'intelligence',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', primary: true },
      { href: '/matches', label: 'Matches', icon: 'matches', primary: true },
      { href: '/ai-analyst', label: 'AI Analyst', icon: 'analyst', primary: true, shortLabel: 'AI' },
      { href: '/monte-carlo', label: 'Monte Carlo', icon: 'simulation', primary: true, shortLabel: 'Simulate' },
      { href: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
      { href: '/history', label: 'History', icon: 'history' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { href: '/subscription', label: 'Subscription', icon: 'subscription' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    adminOnly: true,
    items: [
      { href: '/admin', label: 'Admin', icon: 'admin' },
      { href: '/admin/sports', label: 'Sports Data', icon: 'sportsData' },
    ],
  },
];

/** Flattened, in sidebar order. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** The four tabs of the mobile bottom bar, before "More" is appended. */
export const PRIMARY_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.primary);

/** Everything the "More" sheet offers, in the order it lists them. */
export function overflowItems(isAdmin: boolean): NavItem[] {
  return NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin)
    .flatMap((section) => section.items)
    .filter((item) => !item.primary);
}

export function sectionsFor(isAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.filter((section) => !section.adminOnly || isAdmin);
}

/** True when `pathname` is this item's route or one nested under it. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The current route's name, for the top bar. Falls back to the last path
 * segment so a route added without a nav entry still shows something
 * meaningful rather than an empty crumb.
 */
export function routeTitle(pathname: string): string {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActive(pathname, item.href) || pathname.startsWith(`${item.href}/`));
  if (match) return match.label;

  const segment = pathname.split('/').filter(Boolean).pop() ?? 'Dashboard';
  return segment.replace(/-/g, ' ').replace(/^./, (character) => character.toUpperCase());
}
