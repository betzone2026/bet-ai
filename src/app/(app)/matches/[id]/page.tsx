import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFixtureDetailFeed } from '@/lib/sports/data-source';
import { DemoMatchDetail } from './demo-detail';
import { RealFixtureDetail } from './real-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Fixture ids are now imported rather than enumerable, so the page is rendered
 * per request instead of pre-built from the demo set.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const feed = await getFixtureDetailFeed(id);
  if (!feed) return { title: 'Match' };

  const title =
    feed.mode === 'REAL'
      ? `${feed.detail.fixture.homeTeam} vs ${feed.detail.fixture.awayTeam}`
      : `${feed.match.homeTeam} vs ${feed.match.awayTeam}`;
  return { title };
}

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;
  const feed = await getFixtureDetailFeed(id);
  if (!feed) notFound();

  return feed.mode === 'REAL' ? (
    <RealFixtureDetail detail={feed.detail} />
  ) : (
    <DemoMatchDetail match={feed.match} />
  );
}
