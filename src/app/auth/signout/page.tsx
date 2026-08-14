'use client';

import { useEffect } from 'react';
import { logout } from '@netlify/identity';

export default function SignoutPage() {
  useEffect(() => {
    void logout().finally(() => {
      window.location.href = '/';
    });
  }, []);

  return <p className="p-8 text-sm text-muted">Signing out…</p>;
}
