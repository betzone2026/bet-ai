import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * A team's crest, or its initials when the provider gave no logo.
 *
 * Left unoptimised on purpose: these are already small PNGs served from
 * the provider's CDN, and routing a few hundred 24px crests through an
 * image transform would spend function invocations to make them no
 * smaller. The crest is decorative — the team's name is always beside it
 * — so the alt text is empty rather than duplicating it.
 */
export function TeamCrest({
  name,
  logo,
  size = 24,
  className,
}: {
  name: string;
  logo?: string | null;
  size?: 20 | 24 | 32 | 40;
  className?: string;
}) {
  const box = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md',
    className,
  );

  if (!logo) {
    return (
      <span
        aria-hidden
        className={cn(box, 'border border-line bg-raised font-mono font-medium text-muted')}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className={box} style={{ width: size, height: size }}>
      <Image
        src={logo}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="h-full w-full object-contain"
      />
    </span>
  );
}
