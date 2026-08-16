'use client';

import { useState } from 'react';
import { AuthError, requestPasswordRecovery } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { Field, FormError, FormNotice } from '../form-shell';

export function ResetForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await requestPasswordRecovery(email);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof AuthError ? caught.message : 'Password recovery failed.');
      return;
    }
    setPending(false);
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <FormNotice message={sent ? 'If that address has an account, a reset link is on its way.' : null} />

      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <Button type="submit" className="w-full" loading={pending} disabled={pending || sent}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
