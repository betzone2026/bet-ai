import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';

/**
 * The shell every authentication screen is built from.
 *
 * These screens sit outside the application shell, so they cannot borrow
 * `Card` and `PageHeader` from it — but they use the same tokens, the same
 * type scale and the same 44px input height, so crossing from the marketing
 * site into the product never changes typeface, rhythm or contrast.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-card hairline-top sm:p-7">
      <h1 className="font-display text-h1 font-semibold">{title}</h1>
      <p className="mt-2 text-small leading-relaxed text-muted">{subtitle}</p>
      <div className="mt-7">{children}</div>
      {footer && (
        <div className="mt-6 border-t border-line pt-5 text-small text-muted">{footer}</div>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        className={cn(
          // Full touch height on phones, where these forms are most used;
          // the compact desktop height only applies from `sm` upwards.
          'mt-1.5 min-h-touch w-full rounded-lg border border-line bg-base px-3 text-small text-ink',
          'placeholder:text-muted/60 focus:border-alpha sm:min-h-0 sm:h-10',
          className,
        )}
        {...props}
      />
      {hint && <span className="mt-1.5 block text-fine leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-down/35 bg-down/[0.07] px-3 py-2.5 text-small leading-relaxed text-down"
    >
      <AppIcon name="alert" size={16} className="mt-0.5 h-3.5 w-3.5" />
      <span>{message}</span>
    </p>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg border border-up/35 bg-up/[0.07] px-3 py-2.5 text-small leading-relaxed text-up">
      <AppIcon name="check" size={16} className="mt-0.5 h-3.5 w-3.5" />
      <span>{message}</span>
    </p>
  );
}
