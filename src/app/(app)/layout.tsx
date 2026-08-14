import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth/server';
import { Sidebar } from '@/components/app/sidebar';
import { MobileNav } from '@/components/app/mobile-nav';
import { Topbar } from '@/components/app/topbar';
import { DisclaimerNote } from '@/components/ui/compliance';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // Middleware already blocks anonymous requests; this is the second
  // gate, so a misconfigured matcher can never expose private data.
  if (!profile) redirect('/login');

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
