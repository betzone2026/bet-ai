import Link from 'next/link';
import { Wordmark } from '@/components/landing/wordmark';
import { DisclaimerNote } from '@/components/ui/compliance';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-field flex min-h-screen flex-col">
      <header className="px-5 py-6 lg:px-8">
        <Link href="/" aria-label="SportAlpha AI home">
          <Wordmark />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="px-5 py-8 lg:px-8">
        <DisclaimerNote className="mx-auto max-w-2xl text-center text-[11px] leading-relaxed text-muted" />
      </footer>
    </div>
  );
}
