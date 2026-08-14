'use client';

import { useState } from 'react';
import { AuthError, signup } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { Field, FormError, FormNotice } from '../form-shell';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }

    setPending(true);
    try {
      const user = await signup(email, password, { full_name: fullName });
      if (user.confirmedAt) {
        window.location.href = '/dashboard';
        return;
      }
    } catch (caught) {
      setPending(false);
      setError(caught instanceof AuthError ? caught.message : 'Account creation failed.');
      return;
    }
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <FormNotice message={`Verification email sent to ${email}.`} />
        <p className="text-sm leading-relaxed text-muted">
          Open the link in that message to confirm your address and finish setting up your
          account. The link expires in 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <Field
        label="Full name"
        autoComplete="name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Alex Rossi"
      />
      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-[11px] leading-relaxed text-muted">
        You must be 18 or older. By continuing you accept the Terms and confirm you have read the
        Risk disclosure.
      </p>
    </form>
  );
}
