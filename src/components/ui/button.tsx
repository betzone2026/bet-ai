import Link from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-alpha text-base font-semibold hover:bg-alpha/90 disabled:bg-alpha/40',
  secondary:
    'border border-line bg-raised text-ink hover:border-muted/60 disabled:opacity-50',
  ghost: 'text-muted hover:text-ink hover:bg-raised disabled:opacity-50',
  danger: 'border border-down/40 text-down hover:bg-down/10 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-sm',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg transition-colors ' +
  'disabled:cursor-not-allowed focus-visible:outline-none';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
