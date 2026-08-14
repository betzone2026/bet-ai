import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { AnalystChat } from './chat';

export const metadata: Metadata = { title: 'AI Analyst' };

export default async function AiAnalystPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const [profile, query] = await Promise.all([getProfile(), searchParams]);

  return (
    <>
      <PageHeader
        eyebrow="Explanation layer"
        title="AI Analyst"
        description="Ask about a fixture. The analyst explains the computed figures — it never produces numbers of its own."
      />
      <AnalystChat plan={profile?.plan ?? 'free'} initialMatchId={query.match} />
    </>
  );
}
