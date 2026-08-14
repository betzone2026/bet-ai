'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthError, login } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '../form-shell';

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

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
    window.location.href = next.startsWith('/') ? next : '/dashboard';
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

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
