import type { Metadata, Viewport } from 'next';
import { Archivo, Inter, JetBrains_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { IdentityCallback } from '@/components/auth/identity-callback';
import './globals.css';

const display = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'SportAlpha AI — Sports probability intelligence',
    template: '%s — SportAlpha AI',
  },
  description:
    'Statistical models, Monte Carlo simulation and AI explanation applied to sports data. Probabilities and uncertainty, not predictions of certain outcomes.',
  openGraph: {
    title: 'SportAlpha AI',
    description: 'Turn sports data into probabilities.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  // The one colour that cannot come from a CSS variable: browser and PWA
  // chrome is painted before any stylesheet loads. Mirrors `--c-base`.
  themeColor: '#07090D',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>
          <IdentityCallback />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
