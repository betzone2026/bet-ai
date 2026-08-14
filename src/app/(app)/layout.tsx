import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/server';
import { Sidebar } from '@/components/app/sidebar';
import { MobileNav } from '@/components/app/mobile-nav';
import { Topbar } from '@/components/app/topbar';
import { DisclaimerNote } from '@/components/ui/compliance';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // Middleware turns anonymous requests away at the edge on the strength of the
  // session cookie alone. This is the authoritative gate: it resolves the real
  // user, so a forged, revoked or expired cookie is rejected here even though
  // it satisfied middleware.
  if (!profile) redirect('/login?error=session_expired');

  return (
    <div className="flex min-h-screen">
      <Sidebar plan={profile.plan} isAdmin={profile.is_admin} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={profile.email} plan={profile.plan} />

        <main className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-shell">{children}</div>
        </main>

        <footer className="border-t border-line px-4 py-6 lg:px-8">
          <DisclaimerNote className="mx-auto max-w-shell text-[11px] leading-relaxed text-muted" />
        </footer>
      </div>

      <MobileNav />
    </div>
  );
}
