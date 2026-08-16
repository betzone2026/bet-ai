import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { FixtureCard } from '@/components/app/fixture-card';
import { MatchCard } from '@/components/app/match-card';
import { ChipNav } from '@/components/ui/tabs';
import { DemoBadge, LiveDataBadge } from '@/components/ui/badge';
import { EmptyState, Note } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
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

  const count = feed.mode === 'REAL' ? feed.fixtures.length : feed.matches.length;

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
        <Note tone="warning" className="mb-6">
          {DEMO_REASON_COPY[feed.reason]}
        </Note>
      )}

      {/* Filters are links, so a filtered view can be shared and survives a
          reload — the same reason the admin section navigation is links. */}
      <ChipNav
        label="Competition"
        className="pb-6"
        items={[
          { href: '/matches', label: 'All', active: !active, icon: 'leagues' },
          ...leagues.map((league) => ({
            href: `/matches?league=${encodeURIComponent(league.value)}`,
            label: league.label,
            active: active === league.value,
          })),
        ]}
      />

      {feed.mode === 'REAL' ? (
        feed.fixtures.length === 0 ? (
          <EmptyState
            icon="matches"
            title="No fixtures found."
            description="No supported fixtures were returned for this competition in the next fortnight. Clear the filter, or run a sync from the admin area."
            action={
              <ButtonLink href="/matches" variant="secondary" size="sm">
                Clear filter
              </ButtonLink>
            }
          />
        ) : (
          <>
            <p className="eyebrow pb-3">
              {count} fixture{count === 1 ? '' : 's'}
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {feed.fixtures.map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          </>
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
        icon="matches"
        title="No fixtures found."
        description="This competition has nothing in the sample set. Pick another, or clear the filter to see the full slate."
        action={
          <ButtonLink href="/matches" variant="secondary" size="sm">
            Clear filter
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      <p className="eyebrow pb-3">
        {visible.length} fixture{visible.length === 1 ? '' : 's'}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </>
  );
}
