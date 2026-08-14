/** Shared shell for the four policy pages. */
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 font-mono text-xs text-muted">Last updated {updated}</p>
      <div className="mt-10 space-y-6 text-sm leading-relaxed text-muted [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_strong]:text-ink">
        {children}
      </div>
    </article>
  );
}
