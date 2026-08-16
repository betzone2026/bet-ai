'use client';

import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A tooltip that does not depend on hover.
 *
 * The product is built to survive being wrapped as a PWA or a Capacitor
 * app, where hover does not exist. So the trigger is a real button: it
 * opens on hover *and* on focus *and* on tap, closes on Escape and on
 * blur, and is wired to the bubble with `aria-describedby` so the text
 * reaches a screen reader whether or not it is ever seen.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'right';
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function hide() {
    // A short grace period stops the bubble flickering when the pointer
    // crosses the gap between the trigger and the bubble.
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  }

  const POSITION = {
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  } as const;

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="inline-flex cursor-help items-center rounded-sm"
      >
        {children}
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-tooltip w-max max-w-[15rem] animate-fade-in',
            'rounded-lg border border-line bg-raised px-2.5 py-1.5 text-left',
            'text-fine leading-relaxed text-ink-2 shadow-pop',
            POSITION[side],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
