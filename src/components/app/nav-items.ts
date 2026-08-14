import {
  LayoutDashboard, ListOrdered, Bot, Dices, Briefcase,
  History, CreditCard, Settings, Shield,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown in the mobile bar; the rest live behind "More". */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, primary: true },
  { href: '/matches',     label: 'Matches',     icon: ListOrdered,     primary: true },
  { href: '/ai-analyst',  label: 'AI Analyst',  icon: Bot,             primary: true },
  { href: '/monte-carlo', label: 'Monte Carlo', icon: Dices,           primary: true },
  { href: '/portfolio',   label: 'Portfolio',   icon: Briefcase },
  { href: '/history',     label: 'History',     icon: History },
  { href: '/subscription',label: 'Subscription',icon: CreditCard },
  { href: '/settings',    label: 'Settings',    icon: Settings },
];

export const ADMIN_ITEM: NavItem = { href: '/admin', label: 'Admin', icon: Shield };
