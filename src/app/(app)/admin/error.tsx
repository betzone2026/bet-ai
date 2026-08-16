'use client';

import { PageHeader } from '@/components/app/page-header';
import { ErrorState } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';

/**
 * The error boundary for the operator console.
 *
 * Same failure, different reader: an operator needs the cause. Both admin
 * pages redirect a non-admin before they do any work, so anything that
 * reaches this boundary was thrown on a screen only an admin can be
 * looking at — the detail split costs no role check on the client.
 *
 * What can honestly be shown is narrower than it looks. Next.js replaces
 * a server exception's message with a generic string before it crosses to
 * the browser and hands over a `digest` instead, so the digest is the
 * thing worth surfacing: it is the key that ties this screen to the entry
 * in the server log. The message is only ever specific in development,
 * and is included when it is.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const detail = [error.digest && `digest: ${error.digest}`, error.message]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="py-2">
      <PageHeader
        eyebrow="Admin · Error"
        title="This console failed to render"
        description="The page threw while loading. The reference below identifies it in the server log."
      />

      <ErrorState
        title="Unhandled exception"
        description="Retrying re-runs the page. If it fails again, check the provider quota and the most recent sync run before reading anything into the numbers elsewhere."
        detail={detail || null}
        showDetail
        onRetry={reset}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/admin" variant="ghost" size="sm" icon="admin">
          Admin overview
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="ghost" size="sm" icon="dashboard">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
