import { redirect } from 'next/navigation';
import { getProfile, hasSessionCookie } from '@/lib/auth/server';
import { hasStoredFixtures } from '@/lib/sports/status';
import { Sidebar } from '@/components/app/sidebar';
import { MobileNav } from '@/components/app/mobile-nav';
import { Topbar } from '@/components/app/topbar';
import { SIDEBAR_KEY } from '@/components/app/nav-items';
import { DisclaimerNote } from '@/components/ui/compliance';

/**
 * Every route under this layout depends on who is asking, so none of them may
 * be prerendered. A build-time render has no request and therefore no session:
 * it would resolve to "anonymous", take the redirect below, and ship that
 * redirect as the static response served to *every* visitor — including one who
 * has just authenticated.
 *
 * `getProfile()` also reads `cookies()`, which forces the same outcome. This
 * declaration is the explicit, reviewable statement of the requirement.
 */
export const dynamic = 'force-dynamic';

/**
 * Applies the stored sidebar preference before the first paint.
 *
 * Reading localStorage from an effect would render the expanded rail and
 * then snap it shut one frame later, which is visible on every single
 * navigation. Eight lines of blocking script buy a correct first paint.
 */
const SIDEBAR_PREFERENCE = `try{if(localStorage.getItem('${SIDEBAR_KEY}')==='collapsed'){document.documentElement.dataset.sidebar='collapsed'}}catch(e){}`;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // Middleware turns anonymous requests away at the edge on the strength of the
  // session cookie alone. This is the authoritative gate: it resolves the real
  // user, so a forged, revoked or expired cookie is rejected here even though
  // it satisfied middleware.
  if (!profile) {
    // Only claim the session expired when there actually was one. A request
    // with no cookie is simply anonymous, and telling that person their session
    // expired sends them looking for a problem that does not exist — which is
    // exactly how a working confirmation used to be reported as a failure.
    const hadSession = await hasSessionCookie();
    redirect(hadSession ? '/login?error=session_expired' : '/login');
  }

  // The same rule the fixture screens use, asked once for the chrome: if the
  // database holds imported fixtures the reader is looking at real data.
  // A single indexed `LIMIT 1`, and it already swallows its own failures.
  const dataStatus = (await hasStoredFixtures()) ? 'LIVE' : 'DEMO';

  return (
    <div className="flex min-h-screen">
      <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PREFERENCE }} />

      <Sidebar plan={profile.plan} email={profile.email} isAdmin={profile.is_admin} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          email={profile.email}
          plan={profile.plan}
          isAdmin={profile.is_admin}
          dataStatus={dataStatus}
        />

        <main className="flex-1 px-4 pt-6 lg:px-8">
          <div className="mx-auto max-w-shell">{children}</div>
        </main>

        {/* The bottom navigation floats above this footer on small screens,
            so the clearance for it lives here, at the end of the document. */}
        <footer className="mt-8 border-t border-line px-4 pt-6 lg:px-8 lg:pb-6">
          <DisclaimerNote className="mx-auto max-w-shell text-fine leading-relaxed text-muted" />
          <div
            aria-hidden
            className="lg:hidden"
            style={{ height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
          />
        </footer>
      </div>

      <MobileNav plan={profile.plan} email={profile.email} isAdmin={profile.is_admin} />
    </div>
  );
}
