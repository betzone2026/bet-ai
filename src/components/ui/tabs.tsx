'use client';

import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';
import type { IconName } from '@/lib/icons';

export interface TabDefinition {
  id: string;
  label: string;
  icon?: IconName;
  /** Rendered only while the tab is selected. */
  panel: React.ReactNode;
  /** Marks a tab whose content is not available for this record. */
  disabled?: boolean;
}

/**
 * Tabs with the keyboard behaviour the ARIA pattern requires: arrow keys
 * move between tabs, Home and End jump to the ends, and only the selected
 * tab is in the tab order. The strip scrolls horizontally on narrow
 * screens rather than wrapping, so the underline stays a single line.
 */
export function Tabs({
  tabs,
  initial,
  className,
  label = 'Sections',
}: {
  tabs: TabDefinition[];
  initial?: string;
  className?: string;
  label?: string;
}) {
  const base = useId();
  const available = tabs.filter((tab) => !tab.disabled);
  const [active, setActive] = useState(initial ?? available[0]?.id ?? tabs[0]!.id);
  const stripRef = useRef<HTMLDivElement>(null);

  function move(direction: 1 | -1 | 'first' | 'last') {
    const index = available.findIndex((tab) => tab.id === active);
    const next =
      direction === 'first'
        ? 0
        : direction === 'last'
          ? available.length - 1
          : (index + direction + available.length) % available.length;

    const target = available[next];
    if (!target) return;
    setActive(target.id);
    stripRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${base}-tab-${target.id}`)}`)
      ?.focus();
  }

  const current = tabs.find((tab) => tab.id === active);

  return (
    <div className={className}>
      <div
        ref={stripRef}
        role="tablist"
        aria-label={label}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-px [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
          if (event.key === 'Home') { event.preventDefault(); move('first'); }
          if (event.key === 'End') { event.preventDefault(); move('last'); }
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`${base}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => setActive(tab.id)}
              className={cn(
                'inline-flex min-h-touch shrink-0 items-center gap-2 whitespace-nowrap',
                'border-b-2 px-3 text-small transition-colors duration-fast sm:min-h-0 sm:h-10',
                'focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-alpha text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {tab.icon && <AppIcon name={tab.icon} size={16} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {current && (
        <div
          id={`${base}-panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${current.id}`}
          tabIndex={0}
          className="pt-5 focus-visible:outline-offset-[-2px]"
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}

/**
 * A row of filters that are links rather than state, so a filtered view
 * is addressable and survives a reload. Used by the match list and the
 * admin section navigation.
 */
export function ChipNav({
  items,
  className,
  label,
}: {
  items: Array<{ href: string; label: string; active: boolean; icon?: IconName }>;
  className?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-touch items-center gap-1.5 rounded-lg border px-3 text-small',
            'transition-colors duration-fast sm:min-h-0 sm:h-8',
            item.active
              ? 'border-alpha/45 bg-alpha/10 text-alpha'
              : 'border-line bg-surface text-muted hover:border-line-active hover:text-ink',
          )}
        >
          {item.icon && <AppIcon name={item.icon} size={16} />}
          {item.label}
        </a>
      ))}
    </nav>
  );
}
