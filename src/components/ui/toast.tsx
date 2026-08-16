'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';
import type { IconName } from '@/lib/icons';

type ToastTone = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<ToastTone, { border: string; icon: IconName; iconClass: string }> = {
  info: { border: 'border-line', icon: 'info', iconClass: 'text-info' },
  success: { border: 'border-up/40', icon: 'check', iconClass: 'text-up' },
  error: { border: 'border-down/40', icon: 'alert', iconClass: 'text-down' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Above the bottom navigation and clear of the home indicator, so a
          confirmation never hides the tab the reader is about to press. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone];
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border',
                'animate-fade-up bg-raised px-3.5 py-3 text-small text-ink shadow-float',
                tone.border,
              )}
            >
              <AppIcon name={tone.icon} size={16} className={cn('mt-0.5', tone.iconClass)} />
              <p className="min-w-0 flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-m-1 rounded-md p-1 text-muted transition-colors duration-fast hover:text-ink"
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
