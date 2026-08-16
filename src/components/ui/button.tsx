import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AppIcon, Spinner, type IconSize } from '@/components/ui/icon';
import type { IconName } from '@/lib/icons';

/**
 * One button component for the whole product.
 *
 * Every action — a primary CTA, a destructive confirm, an icon-only
 * toolbar control — is this component with a variant. No screen defines
 * its own, which is what keeps hit areas, focus rings and disabled
 * treatment identical everywhere.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-alpha text-on-alpha font-semibold hover:bg-alpha/90 active:bg-alpha/80 ' +
    'disabled:bg-alpha/30 disabled:text-on-alpha/70',
  secondary:
    'border border-line bg-raised text-ink hover:border-line-active hover:bg-hover ' +
    'active:bg-raised disabled:opacity-45',
  ghost:
    'text-muted hover:bg-raised hover:text-ink active:bg-hover disabled:opacity-45',
  danger:
    'border border-down/40 bg-down/10 text-down hover:bg-down/[0.18] ' +
    'active:bg-down/[0.24] disabled:opacity-45',
  success:
    'border border-up/40 bg-up/10 text-up hover:bg-up/[0.18] ' +
    'active:bg-up/[0.24] disabled:opacity-45',
};

/* Every size clears the 44px touch minimum on coarse pointers; the
   compact heights below apply from the small breakpoint upwards, where a
   mouse is doing the pointing. */
const SIZES: Record<Size, string> = {
  sm: 'min-h-touch px-3 text-small sm:min-h-0 sm:h-8',
  md: 'min-h-touch px-4 text-small sm:min-h-0 sm:h-10',
  lg: 'min-h-touch px-6 text-body sm:min-h-0 sm:h-12',
  icon: 'min-h-touch min-w-touch sm:min-h-0 sm:min-w-0 sm:h-9 sm:w-9',
};

const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-lg ' +
  'transition-colors duration-fast ease-ease disabled:cursor-not-allowed';

interface Shared {
  variant?: Variant;
  size?: Size;
  /** Rendered before the label, from the central icon registry. */
  icon?: IconName;
  iconSize?: IconSize;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, Shared {
  /** Swaps the icon for a spinner and blocks interaction. */
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconSize = 16,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner size={iconSize} label="" />
      ) : (
        icon && <AppIcon name={icon} size={iconSize} />
      )}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link>, Shared {}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  iconSize = 16,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {icon && <AppIcon name={icon} size={iconSize} />}
      {children}
    </Link>
  );
}

/**
 * An icon-only button. `label` is required rather than optional: an
 * unlabelled icon button is invisible to a screen reader, so the type
 * system is where that gets caught.
 */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className,
  ...props
}: Omit<ButtonProps, 'size' | 'children' | 'icon'> & { label: string; icon: IconName }) {
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    >
      <AppIcon name={icon} size={18} />
    </Button>
  );
}
