'use client';

import { useState } from 'react';
import { AuthError, hydrateSession, updateUser } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Field, FormError } from '../form-shell';

const MIN_PASSWORD_LENGTH = 8;

export function UpdatePasswordForm() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

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
      await hydrateSession();
      await updateUser({ password });
    } catch (caught) {
      setPending(false);
      setError(caught instanceof AuthError ? caught.message : 'Password update failed.');
      return;
    }
    setPending(false);

    toast.show('Password updated.', 'success');
    window.location.href = '/dashboard';
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
        {pending ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  );
}
