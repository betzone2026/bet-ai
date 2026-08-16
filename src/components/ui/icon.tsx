import { createElement } from 'react';
import { cn } from '@/lib/utils';
import { getIcon, type IconName, type LucideIcon } from '@/lib/icons';

/** The four sizes the product uses. Nothing renders an icon at any other. */
export type IconSize = 16 | 18 | 20 | 24;

const SIZE_CLASS: Record<IconSize, string> = {
  16: 'h-4 w-4',
  18: 'h-[1.125rem] w-[1.125rem]',
  20: 'h-5 w-5',
  24: 'h-6 w-6',
};

interface AppIconProps {
  /** A name from the central registry, or a registry icon already resolved. */
  name: IconName | LucideIcon;
  size?: IconSize;
  className?: string;
  /**
   * Given when the icon is the only thing carrying the meaning. Left off,
   * the icon is marked decorative and hidden from assistive technology —
   * which is correct beside a visible text label.
   */
  label?: string;
  strokeWidth?: number;
}

/**
 * The single way an icon reaches the screen.
 *
 * Centralising it fixes three things at once: the stroke weight stays
 * consistent across the product, sizes are restricted to the scale, and
 * the accessible-name decision is made explicitly at every call site
 * rather than forgotten.
 */
export function AppIcon({
  name,
  size = 16,
  className,
  label,
  strokeWidth = 1.75,
}: AppIconProps) {
  // Resolved from the registry and rendered with `createElement`: the glyph
  // is a value looked up at call time, not a component defined here, and
  // writing it as `<Glyph />` would read as the latter.
  const glyph = typeof name === 'string' ? getIcon(name) : name;

  return createElement(glyph, {
    className: cn('shrink-0', SIZE_CLASS[size], className),
    strokeWidth,
    'aria-hidden': label ? undefined : true,
    ...(label ? { role: 'img', 'aria-label': label } : {}),
  });
}

/** A spinner built from the registry, so loading states match everything else. */
export function Spinner({ size = 16, className, label = 'Loading' }: {
  size?: IconSize;
  className?: string;
  label?: string;
}) {
  return <AppIcon name="spinner" size={size} label={label} className={cn('animate-spin', className)} />;
}
