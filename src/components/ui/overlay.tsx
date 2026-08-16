'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/button';

/**
 * The overlay family — modal, drawer and bottom sheet — built on one
 * primitive so they behave identically: Escape closes, the backdrop
 * closes, focus moves into the panel on open and returns to the trigger
 * on close, Tab is kept inside, and the page behind cannot scroll.
 *
 * Rendered into `document.body` so a transformed or clipping ancestor can
 * never trap the panel inside its own stacking context.
 */
type Placement = 'center' | 'right' | 'bottom';

/* On a phone a centred dialog is the wrong shape: it fights the keyboard
   and puts its actions out of thumb reach. Every centred modal therefore
   arrives as a bottom sheet below the small breakpoint. */
const PANEL: Record<Placement, string> = {
  center:
    'inset-x-0 bottom-0 w-full rounded-t-2xl animate-sheet-up ' +
    'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg ' +
    'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:animate-fade-up',
  right:
    'inset-x-0 bottom-0 w-full rounded-t-2xl animate-sheet-up ' +
    'sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-auto sm:h-full sm:w-full sm:max-w-md ' +
    'sm:rounded-none sm:rounded-l-2xl sm:animate-fade-in',
  bottom: 'inset-x-0 bottom-0 w-full rounded-t-2xl animate-sheet-up',
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  placement?: Placement;
  className?: string;
}

function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = 'center',
  className,
}: OverlayProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const targets = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null);
      if (targets.length === 0) return;

      const first = targets[0]!;
      const last = targets[targets.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    // Focus the panel itself rather than its first control: opening a
    // sheet should not put a cursor in a field the reader did not ask for.
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      restoreTo.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-modal">
      <div
        className="absolute inset-0 animate-fade-in bg-base/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'absolute flex max-h-[92vh] flex-col border border-line bg-surface shadow-float',
          // The one place the global focus ring is deliberately suppressed:
          // this container is focused programmatically on open so screen
          // readers land inside the dialog, and ringing the whole panel
          // would read as a control the user is expected to act on.
          'focus-visible:outline-none',
          PANEL[placement],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-h3 font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-small text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" icon="close" onClick={onClose} />
        </div>

        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A centred dialog on desktop, a bottom sheet on a phone. */
export function Modal(props: Omit<OverlayProps, 'placement'>) {
  return <Overlay {...props} placement="center" />;
}

/** Slides in from the right on desktop, up from the bottom on a phone. */
export function Drawer(props: Omit<OverlayProps, 'placement'>) {
  return <Overlay {...props} placement="right" />;
}

/** Always a bottom sheet. Used by the mobile "More" navigation. */
export function BottomSheet(props: Omit<OverlayProps, 'placement'>) {
  return <Overlay {...props} placement="bottom" />;
}
