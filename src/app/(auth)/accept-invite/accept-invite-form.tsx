'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthError, acceptInvite, login } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { INVITE_FRAGMENT_KEY } from '@/lib/auth/callback-tokens';
import { Field, FormError } from '../form-shell';

const MIN_PASSWORD_LENGTH = 8;

export function AcceptInviteForm() {
  // The token lives in a ref rather than state: it never affects what is
  // rendered, and keeping it out of state avoids a render pass on mount.
  const token = useRef<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    token.current = params.get(INVITE_FRAGMENT_KEY);
    // Take the token out of the address bar once it is held in memory, so it is
    // not left behind in session history.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token.current) {
      setError('This page needs a valid invitation link. Open the link from your email again.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setPending(true);
    try {
      const user = await acceptInvite(token.current, password);
      // `acceptInvite` stores the session in the browser but does not write the
      // `nf_jwt` cookie, and without that cookie every server render would see
      // an anonymous request. Logging in with the password just set produces a
      // complete session.
      if (user.email) await login(user.email, password);
    } catch (caught) {
      setPending(false);
      setError(
        caught instanceof AuthError || caught instanceof Error
          ? caught.message
          : 'We could not accept that invitation.',
      );
      return;
    }
    window.location.replace('/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <Field
        label="Choose a password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <Field
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button type="submit" className="w-full" loading={pending} disabled={pending}>
        {pending ? 'Setting up…' : 'Accept invitation'}
      </Button>
    </form>
  );
}
