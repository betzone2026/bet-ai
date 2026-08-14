import { cn } from '@/lib/utils';

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
    <div className="rounded-2xl border border-line bg-surface p-7 hairline-top">
      <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-6 border-t border-line pt-5 text-sm text-muted">{footer}</div>}
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
          'mt-1.5 h-10 w-full rounded-lg border border-line bg-base px-3 text-sm text-ink',
          'placeholder:text-muted/60 focus:border-alpha focus:outline-none',
          className,
        )}
        {...props}
      />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-down/35 bg-down/[0.07] px-3 py-2 text-xs text-down">
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-up/35 bg-up/[0.07] px-3 py-2 text-xs text-up">{message}</p>
  );
}
