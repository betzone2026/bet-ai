/**
 * The icon registry — the only place `lucide-react` is imported.
 *
 * One library, one import site. Anything that needs an icon takes it from
 * here by name, which is what guarantees the product never mixes icon
 * sets (or falls back to emoji) and makes an icon swap a one-line change.
 * Names are semantic (`Matches`, `Simulation`) rather than pictorial, so
 * changing the glyph never means renaming a call site.
 */
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  CircleUserRound,
  CreditCard,
  DatabaseZap,
  Dice5,
  Ellipsis,
  ExternalLink,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  ListFilter,
  Loader2,
  LogOut,
  type LucideIcon,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Square,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';

export type { LucideIcon };

/**
 * Every icon the product may render. Adding a glyph means adding it here
 * first, which keeps the set reviewable at a glance.
 */
export const ICONS = {
  /* Navigation */
  dashboard: LayoutDashboard,
  matches: CalendarDays,
  analyst: BrainCircuit,
  simulation: Dice5,
  portfolio: BriefcaseBusiness,
  history: History,
  subscription: CreditCard,
  settings: Settings,
  admin: ShieldCheck,
  sportsData: DatabaseZap,
  apiUsage: Activity,
  models: Network,
  leagues: Trophy,
  users: Users,
  logs: ScrollText,
  wallet: WalletCards,
  more: Ellipsis,

  /* Account and chrome */
  profile: CircleUserRound,
  logout: LogOut,
  search: Search,
  notifications: Bell,
  shield: Shield,
  collapse: PanelLeftClose,
  expand: PanelLeftOpen,

  /* Actions */
  run: Play,
  send: Send,
  stop: Square,
  refresh: RefreshCw,
  filter: ListFilter,
  tune: SlidersHorizontal,
  close: X,
  menu: Menu,
  check: Check,
  back: ArrowLeft,
  forward: ArrowRight,
  openExternal: ExternalLink,
  enter: ArrowUpRight,

  /* Meaning */
  info: Info,
  help: CircleHelp,
  alert: CircleAlert,
  up: TrendingUp,
  down: TrendingDown,
  gauge: Gauge,
  sigma: Sigma,
  live: Zap,
  spinner: Loader2,

  /* Disclosure */
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
} as const;

export type IconName = keyof typeof ICONS;

export function getIcon(name: IconName): LucideIcon {
  return ICONS[name];
}
