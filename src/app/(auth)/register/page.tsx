import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '../form-shell';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Free tier, no card required."
      footer={
        <>
          Already registered?{' '}
          <Link href="/login" className="text-alpha hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
