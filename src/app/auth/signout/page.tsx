'use client';

import { useEffect } from 'react';
import { logout } from '@netlify/identity';
import { Spinner } from '@/components/ui/icon';

export default function SignoutPage() {
  useEffect(() => {
    void logout().finally(() => {
      window.location.href = '/';
    });
  }, []);

  return (
    <div className="grid-field flex min-h-screen items-center justify-center px-5">
      <p role="status" className="flex items-center gap-2.5 text-small text-muted">
        <Spinner size={16} label="" className="text-alpha" />
        Signing out…
      </p>
    </div>
  );
}
