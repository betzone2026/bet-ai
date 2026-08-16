'use client';

import './globals.css';

/**
 * The boundary for a failure in the root layout itself.
 *
 * Next.js replaces the entire document when this renders, so it has to
 * supply its own `<html>` and `<body>` — and it cannot inherit the web
 * fonts, which the root layout attaches as CSS variables on the element
 * this file is replacing. Importing the stylesheet still brings the
 * colour tokens and the body treatment, and the font stacks fall back to
 * the system faces, so the screen is on-brand in colour and merely
 * ordinary in type. That is the right trade for the one screen that has
 * to work when nothing else did.
 *
 * Deliberately dependency-light for the same reason: a native anchor and
 * a full document reload, not client-side routing whose runtime is the
 * very thing that has just failed.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="eyebrow">Error</p>
          <h1 className="font-display text-section font-semibold">The application failed to start</h1>
          <p className="max-w-sm text-body text-muted">
            This is not a problem with your account or your data. Reloading the page is the
            first thing to try.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-touch select-none items-center justify-center rounded-lg border border-line bg-raised px-4 text-small font-medium text-ink transition-colors duration-fast ease-ease hover:bg-hover"
            >
              Try again
            </button>
            {/* A real navigation, not a client-side one. The rule assumes the
                router is available to take over this link; on this screen it
                is the component that has just failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex min-h-touch select-none items-center justify-center rounded-lg px-4 text-small font-medium text-muted transition-colors duration-fast ease-ease hover:bg-hover hover:text-ink"
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
