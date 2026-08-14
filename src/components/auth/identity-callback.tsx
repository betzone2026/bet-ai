'use client';

import { useEffect } from 'react';
import { handleAuthCallback } from '@netlify/identity';

export function IdentityCallback() {
  useEffect(() => {
    if (!window.location.hash) return;
    void handleAuthCallback()
      .then((result) => {
        if (!result) return;
        window.location.href = result.type === 'recovery' ? '/update-password' : '/dashboard';
      })
      .catch(() => {
        window.location.href = '/login?error=callback';
      });
  }, []);

  return null;
}
