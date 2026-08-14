import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCard } from '../form-shell';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <AuthCard
      title="Log in"
      subtitle="Pick up where you left off."
      footer={
        <>
          No account yet?{' '}
          <Link href="/register" className="text-alpha hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
