import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { FixtureCard } from '@/components/app/fixture-card';
import { MatchCard } from '@/components/app/match-card';
import { DemoBadge, LiveDataBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { SUPPORTED_LEAGUES, SUPPORTED_LEAGUE_KEYS } from '@/lib/sports/config';
import { DEMO_REASON_COPY, getFixtureFeed } from '@/lib/sports/data-source';
import type { MatchView } from '@/lib/types/domain';

export const metadata: Metadata = { title: 'Matches' };
export const dynamic = 'force-dynamic';

/** The window the list covers: yesterday's results through the next fortnight. */
const WINDOW_BACK_DAYS = 1;
const WINDOW_FORWARD_DAYS = 14;

function fixtureWindow(): { from: Date; to: Date } {
  const now = new Date().getTime();
  return {
    from: new Date(now - WINDOW_BACK_DAYS * 86_400_000),
    to: new Date(now + WINDOW_FORWARD_DAYS * 86_400_000),
  };
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const query = await searchParams;
  const active = query.league;

  const { from, to } = fixtureWindow();
  const feed = await getFixtureFeed({
    from,
    to,
    ...(active ? { league: active } : {}),
    limit: 200,
  });

  // In real mode the chips come from the central league configuration, so the
  // bar is stable regardless of which filter is active. In demo mode they come
  // from the sample set, which has no configured slugs.
  const leagues =
    feed.mode === 'REAL'
      ? SUPPORTED_LEAGUE_KEYS.map((key) => ({ value: key, label: SUPPORTED_LEAGUES[key].name }))
      : [...new Set(feed.matches.map((match) => match.league))].map((league) => ({
          value: league,
          label: league,
        }));

  return (
    <>
      <PageHeader
        eyebrow="Fixtures"
        title="Matches"
        description={
          feed.mode === 'REAL'
            ? 'Fixtures imported from the configured data provider, earliest kickoff first.'
            : 'Sample fixtures. Live competitions appear here once the data provider is configured and synced.'
        }
        actions={feed.mode === 'REAL' ? <LiveDataBadge /> : <DemoBadge />}
      />

      {feed.mode === 'DEMO' && (
        <p className="mb-6 rounded-lg border border-alpha/25 bg-alpha/[0.06] px-4 py-3 text-sm text-muted">
          {DEMO_REASON_COPY[feed.reason]}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pb-6">
        <FilterChip href="/matches" label="All" active={!active} />
        {leagues.map((league) => (
          <FilterChip
            key={league.value}
            href={`/matches?league=${encodeURIComponent(league.value)}`}
            label={league.label}
            active={active === league.value}
          />
        ))}
      </div>

      {feed.mode === 'REAL' ? (
        feed.fixtures.length === 0 ? (
          <EmptyState
            title="No fixtures in this window"
            description="Nothing has been imported for this competition in the next fortnight. Clear the filter, or run a sync from the admin area."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {feed.fixtures.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        )
      ) : (
        <DemoGrid matches={feed.matches} active={active} />
      )}
    </>
  );
}

function DemoGrid({ matches, active }: { matches: MatchView[]; active?: string }) {
  const visible = active ? matches.filter((match) => match.league === active) : matches;

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No fixtures in this league today"
        description="Pick another competition, or clear the filter to see the full slate."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={
        active
          ? 'rounded-lg border border-alpha/45 bg-alpha/10 px-3 py-1.5 text-xs text-alpha'
          : 'rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink'
      }
    >
      {label}
    </a>
  );
}
