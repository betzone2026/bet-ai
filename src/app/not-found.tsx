import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid-field flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-3xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-muted">
        The link may be out of date, or the match may have been removed from the catalogue.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-line px-4 py-2 text-sm hover:border-alpha hover:text-alpha"
      >
        Back to home
      </Link>
    </main>
  );
}
