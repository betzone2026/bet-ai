import type { Metadata } from 'next';
import { AuthCard } from '@/app/(auth)/form-shell';
import { CallbackClient } from './callback-client';

export const metadata: Metadata = {
  title: 'Confirming your account',
  robots: { index: false, follow: false },
};

/**
 * Single landing point for every Identity callback: email confirmation,
 * password recovery, invites, email changes and OAuth returns.
 *
 * The token arrives in the URL fragment, which browsers never send to the
 * server, so the redemption itself has to happen in the browser. This page
 * exists so that redemption has a real, addressable destination instead of
 * depending on whichever page the email happened to point at.
 */
export default function AuthCallbackPage() {
  return (
    <div className="grid-field flex min-h-screen items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <AuthCard title="Confirming your account" subtitle="This only takes a moment.">
          <CallbackClient />
        </AuthCard>
      </div>
    </div>
  );
}
