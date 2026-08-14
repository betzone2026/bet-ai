import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '../form-shell';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link href="/login" className="text-alpha hover:underline">
          Back to log in
        </Link>
      }
    >
      <ResetForm />
    </AuthCard>
  );
}
