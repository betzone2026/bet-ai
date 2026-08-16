'use client';

import { Button, ButtonLink } from '@/components/ui/button';

/**
 * The error boundary for the public site.
 *
 * A visitor who has not signed in has no stake in the cause and nowhere
 * useful to report it, so this states the situation once and offers the
 * two routes that are certain to work. It keeps the site header and
 * footer, which the layout renders around it — a stranded visitor should
 * still be able to reach pricing or the legal pages from here.
 */
export default function MarketingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="eyebrow">Error</p>
      <h1 className="font-display text-section font-semibold">This page didn&apos;t load</h1>
      <p className="text-body text-muted">
        Something went wrong while building this page. It is almost always momentary.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" icon="refresh" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="ghost" icon="back">
          Back to home
        </ButtonLink>
      </div>
    </section>
  );
}
