'use client';

import { Button, ButtonLink } from '@/components/ui/button';

/**
 * The boundary of last resort below the root layout.
 *
 * The nested boundaries cover a page that threw inside its own section.
 * This one covers what they structurally cannot: a `layout.tsx` is not
 * wrapped by the `error.tsx` beside it, so when the signed-in shell fails
 * while resolving the session or reading the fixture count, the failure
 * passes every group boundary and arrives here. That is why this screen
 * assumes no chrome and links out rather than back — the shell that would
 * have drawn a way out is the thing that failed.
 */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid-field flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow">Error</p>
      <h1 className="font-display text-section font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-body text-muted">
        The application failed to load this screen. Reloading resolves most of these; if it
        does not, the session may need to be started again.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" icon="refresh" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/login" variant="ghost">
          Sign in again
        </ButtonLink>
      </div>
    </main>
  );
}
