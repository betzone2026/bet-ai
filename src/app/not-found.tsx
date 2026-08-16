import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grid-field flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-section font-semibold">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-body text-muted">
        The link may be out of date, or the match may have been removed from the catalogue.
      </p>
      <ButtonLink href="/" variant="secondary" icon="back" className="mt-2">
        Back to home
      </ButtonLink>
    </main>
  );
}
