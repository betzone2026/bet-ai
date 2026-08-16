'use client';

import { PageHeader } from '@/components/app/page-header';
import { ErrorState } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';

/**
 * The error boundary for the signed-in product.
 *
 * A subscriber gets the consequence, not the cause: `detail` is withheld
 * here and shown only by the admin boundary one segment down. That split
 * is drawn by where this file sits rather than by a role check, so no
 * authorisation logic is duplicated into the client bundle.
 *
 * `reset` re-renders the segment, which is the right first move for the
 * failure this most often catches — a provider timeout or a dropped
 * connection that succeeds on the second attempt. The dashboard link is
 * the way out when it does not.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-2">
      <PageHeader
        eyebrow="Error"
        title="This screen didn't load"
        description="The data behind this page could not be read just now."
      />

      <ErrorState
        title="Request failed"
        description="This is usually momentary. Try again, and if it persists the status of the upstream data feed is shown on the dashboard."
        onRetry={reset}
      />

      <div className="mt-4">
        <ButtonLink href="/dashboard" variant="ghost" size="sm" icon="dashboard">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
