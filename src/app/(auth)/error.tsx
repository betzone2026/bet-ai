'use client';

import { Button, ButtonLink } from '@/components/ui/button';
import { AuthCard, FormError } from '@/app/(auth)/form-shell';

/**
 * The error boundary for the sign-in, registration and password screens.
 *
 * It borrows the card the forms themselves use, so a failure here reads
 * as the same surface rather than as a different application. Nothing
 * about the account is asserted: this boundary catches a page that failed
 * to render, which says nothing about whether the credentials were right,
 * and telling someone their sign-in failed when the page merely crashed
 * sends them to reset a password that was never the problem.
 */
export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AuthCard
      title="Something went wrong"
      subtitle="This screen failed to load. Your account is unaffected — nothing was submitted."
    >
      <FormError message="The page could not be displayed." />

      <div className="mt-5 grid gap-2">
        <Button variant="primary" icon="refresh" onClick={reset} className="w-full">
          Try again
        </Button>
        <ButtonLink href="/login" variant="ghost" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    </AuthCard>
  );
}
