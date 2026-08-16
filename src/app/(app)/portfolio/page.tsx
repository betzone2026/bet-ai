import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { AppIcon } from '@/components/ui/icon';
import { EmptyState, UpgradeState, Note } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { getPlan } from '@/lib/config/plans';
import type { IconName } from '@/lib/icons';

export const metadata: Metadata = { title: 'Portfolio' };

/**
 * The measures the portfolio book will carry once positions exist.
 *
 * They are described rather than displayed. A risk dashboard filled with
 * placeholder figures is worse than an empty one: a reader who cannot tell
 * a sample from a position stops trusting every number on the screen. So
 * the shape of the instrument is shown, and the instrument stays blank
 * until it has something real to measure.
 */
const MEASURES: Array<{ icon: IconName; label: string; definition: string }> = [
  {
    icon: 'wallet',
    label: 'Virtual bankroll',
    definition: 'The staking base every other figure is expressed against.',
  },
  {
    icon: 'portfolio',
    label: 'Exposure',
    definition: 'Capital committed to open positions, by fixture and by competition.',
  },
  {
    icon: 'sigma',
    label: 'Expected value',
    definition: 'Model probability against the price paid, summed across the book.',
  },
  {
    icon: 'gauge',
    label: 'Volatility',
    definition: 'How widely simulated bankroll outcomes spread around the mean.',
  },
  {
    icon: 'down',
    label: 'Max drawdown',
    definition: 'The deepest peak-to-trough fall in the simulated equity path.',
  },
];

const VIEWS: Array<{ icon: IconName; label: string; definition: string }> = [
  {
    icon: 'up',
    label: 'Equity curve',
    definition: 'Bankroll over time, marked with the positions that moved it.',
  },
  {
    icon: 'apiUsage',
    label: 'Risk distribution',
    definition: 'Where exposure concentrates — competition, market, correlation cluster.',
  },
  {
    icon: 'simulation',
    label: 'Monte Carlo bankroll',
    definition: 'The same engine run over the book rather than a single fixture.',
  },
];

export default async function PortfolioPage() {
  const profile = await getProfile();
  const plan = getPlan(profile?.plan);

  if (!plan.limits.portfolioTools) {
    return (
      <>
        <PageHeader
          eyebrow="Risk management"
          title="Portfolio"
          description="Exposure, expected value and drawdown across the positions you are tracking."
        />
        <UpgradeState
          title="Portfolio tools are on Advanced and Quant"
          description="Track exposure across positions, decompose risk by fixture and league, and see how correlated your open positions really are."
          action={
            <ButtonLink href="/subscription" icon="subscription">
              Compare plans
            </ButtonLink>
          }
        />
        <Outline />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Risk management"
        title="Portfolio"
        description="Exposure, expected value and drawdown across the positions you are tracking."
      />
      <EmptyState
        icon="portfolio"
        title="No positions tracked yet."
        description="Add a fixture from the match analyser to start building a position book. Exposure, correlation and risk decomposition appear here once there is something to measure."
        action={
          <ButtonLink href="/matches" icon="matches">
            Browse matches
          </ButtonLink>
        }
      />
      <Outline />
    </>
  );
}

/** What the screen becomes once a book exists. Shown in both states, so
    the page explains itself whether it is empty or locked. */
function Outline() {
  return (
    <>
      <section className="mt-10">
        <h2 className="font-display text-h2 font-semibold">What the book measures</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MEASURES.map((measure) => (
            <Definition key={measure.label} {...measure} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-h2 font-semibold">How it is read</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VIEWS.map((view) => (
            <Definition key={view.label} {...view} />
          ))}
        </div>
      </section>

      <Note className="mt-8">
        Nothing on this page is estimated in advance. Every figure named here is computed from
        positions you record and the model output attached to them — until then the panels stay
        empty rather than showing a sample book.
      </Note>
    </>
  );
}

function Definition({
  icon,
  label,
  definition,
}: {
  icon: IconName;
  label: string;
  definition: string;
}) {
  return (
    <Card>
      <CardBody className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised">
          <AppIcon name={icon} size={16} className="text-muted" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-body font-semibold">{label}</p>
          <p className="mt-1 text-small leading-relaxed text-muted">{definition}</p>
          <p className="tabular mt-2 font-mono text-fine text-muted/70">—</p>
        </div>
      </CardBody>
    </Card>
  );
}
