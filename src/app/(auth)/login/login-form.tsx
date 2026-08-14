'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthError, login } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { safeNextPath } from '@/lib/auth/callback-tokens';
import { Field, FormError } from '../form-shell';

/**
 * Reasons the app may have sent the user here, phrased for the person reading
 * them. Anything unrecognised is ignored rather than echoed back, so the query
 * string cannot be used to render arbitrary text on the login page.
 */
const REDIRECT_REASONS: Record<string, string> = {
  authentication_failed: 'We could not complete that sign-in link. Please log in to continue.',
  session_expired: 'Your session expired. Please log in again.',
};

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const reason = REDIRECT_REASONS[params.get('error') ?? ''] ?? null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await login(email, password);
    } catch (caught) {
      setError(
        caught instanceof AuthError && caught.status === 401
          ? 'That email and password combination does not match an account.'
          : caught instanceof Error ? caught.message : 'Login failed.',
      );
      setPending(false);
      return;
    }
    // Full navigation, not a router push: the server render of the destination
    // has to see the `nf_jwt` cookie that `login()` just wrote.
    window.location.href = next;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error ?? reason} />

      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <div>
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <Link href="/reset-password" className="mt-2 inline-block text-xs text-muted hover:text-ink">
          Forgot your password?
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  );
}
