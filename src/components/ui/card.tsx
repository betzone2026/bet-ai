import { cn } from '@/lib/utils';

/**
 * The card is the product's only container. Everything that groups
 * information uses it, at one radius and one border weight, so a screen
 * reads as a single instrument rather than a pile of panels.
 */
export type CardVariant =
  | 'default'
  | 'interactive'
  | 'metric'
  | 'success'
  | 'warning'
  | 'danger';

const VARIANTS: Record<CardVariant, string> = {
  default: 'border-line bg-surface',
  interactive:
    'border-line bg-surface transition-colors duration-base ' +
    'hover:border-line-active focus-within:border-line-active',
  metric: 'border-line bg-surface',
  success: 'border-up/30 bg-up/[0.05]',
  warning: 'border-alpha/30 bg-alpha/[0.05]',
  danger: 'border-down/30 bg-down/[0.05]',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export function Card({ variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border shadow-card hairline-top',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-h3 font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-small text-muted', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4', className)} {...props} />;
}

/** Alias kept so the component reads the same as the rest of the system. */
export const CardContent = CardBody;

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}
