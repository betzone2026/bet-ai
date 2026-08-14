import type { Metadata } from 'next';
import { AuthCard } from '../form-shell';
import { AcceptInviteForm } from './accept-invite-form';

export const metadata: Metadata = {
  title: 'Accept your invitation',
  robots: { index: false, follow: false },
};

/**
 * Completes an Identity invitation. Reached from `/auth/callback`, which
 * redeems the invite token from the email and hands it on. Administrators are
 * created this way — an invite from the Netlify Identity dashboard, then the
 * `admin` role assigned to the resulting user.
 */
export default function AcceptInvitePage() {
  return (
    <AuthCard
      title="Accept your invitation"
      subtitle="Set a password to finish setting up your account."
    >
      <AcceptInviteForm />
    </AuthCard>
  );
}
