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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="eyebrow block" htmlFor="settings-email">
          Email
        </label>
        <input
          id="settings-email"
          value={email}
          readOnly
          aria-describedby="settings-email-hint"
          className="mt-1.5 min-h-touch w-full rounded-lg border border-line bg-base/60 px-3 text-small text-muted sm:min-h-0 sm:h-10"
        />
        <p id="settings-email-hint" className="mt-1.5 text-fine text-muted">
          Contact support to change the address on your account.
        </p>
      </div>

      <div>
        <label className="eyebrow block" htmlFor="settings-name">
          Display name
        </label>
        <input
          id="settings-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          className="mt-1.5 min-h-touch w-full rounded-lg border border-line bg-base px-3 text-small focus:border-alpha sm:min-h-0 sm:h-10"
        />
        <p className="mt-1.5 text-fine text-muted">
          Used for the greeting on your dashboard and nowhere else.
        </p>
      </div>

      <Button type="submit" icon="check" loading={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
