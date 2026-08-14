'use client';

import { useState } from 'react';
import { AuthError, hydrateSession, updateUser } from '@netlify/identity';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const toast = useToast();
  const [fullName, setFullName] = useState(initialName);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      await hydrateSession();
      await updateUser({ data: { full_name: fullName } });
      toast.show('Profile saved.', 'success');
    } catch (caught) {
      toast.show(caught instanceof AuthError ? caught.message : 'Changes could not be saved.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="eyebrow">Email</span>
        <input
          value={email}
          readOnly
          className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base/60 px-3 text-sm text-muted"
        />
        <span className="mt-1.5 block text-xs text-muted">
          Contact support to change the address on your account.
        </span>
      </label>

      <label className="block">
        <span className="eyebrow">Display name</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base px-3 text-sm focus:border-alpha focus:outline-none"
        />
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
