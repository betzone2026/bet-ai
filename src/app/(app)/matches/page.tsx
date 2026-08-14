import type { Metadata } from 'next';
import { PageHeader } from '@/components/app/page-header';
import { MatchCard } from '@/components/app/match-card';
import { DemoBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { DEMO_MATCHES } from '@/lib/demo/matches';

export const metadata: Metadata = { title: 'Matches' };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const query = await searchParams;
  const leagues = [...new Set(DEMO_MATCHES.map((m) => m.league))];
  const active = query.league;
  const matches = active ? DEMO_MATCHES.filter((m) => m.league === active) : DEMO_MATCHES;

  return (
    <>
      <PageHeader
        eyebrow="Fixtures"
        title="Matches"
        description="Every fixture currently carried by the model, newest kickoff first."
        actions={<DemoBadge />}
      />

      <div className="flex flex-wrap gap-2 pb-6">
        <FilterChip href="/matches" label="All" active={!active} />
        {leagues.map((league) => (
          <FilterChip
            key={league}
            href={`/matches?league=${encodeURIComponent(league)}`}
            label={league}
            active={active === league}
          />
        ))}
      </div>

      {matches.length === 0 ? (
        <EmptyState
          title="No fixtures in this league today"
          description="Pick another competition, or clear the filter to see the full slate."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </>
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
