import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardBody, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { AppIcon } from '@/components/ui/icon';
import { Note } from '@/components/ui/states';
import { getPlan, formatLimit } from '@/lib/config/plans';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await getProfile();
  const plan = getPlan(profile?.plan);

  const allowances = [
    { label: 'Analyses per day', value: formatLimit(plan.limits.maxDailyAnalysis) },
    { label: 'AI questions per day', value: formatLimit(plan.limits.aiQueriesDaily) },
    { label: 'Simulation runs per day', value: formatLimit(plan.limits.monteCarloRunsDaily) },
    { label: 'Paths per run', value: formatLimit(plan.limits.monteCarloLimit) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, your entitlement and what the product stores about you."
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you are addressed in the product</CardDescription>
          </CardHeader>
          <CardBody>
            <ProfileForm initialName={profile?.full_name ?? ''} email={profile?.email ?? ''} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <Badge variant={plan.id === 'free' ? 'neutral' : 'premium'}>{plan.name}</Badge>
          </CardHeader>
          <CardBody>
            <p className="text-small leading-relaxed text-muted">{plan.tagline}</p>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {allowances.map((allowance) => (
                <div key={allowance.label} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-small text-muted">{allowance.label}</dt>
                  <dd className="tabular font-mono text-small text-ink">{allowance.value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
          <CardFooter>
            <span className="text-fine text-muted">Counters reset at 00:00 UTC.</span>
            <ButtonLink href="/subscription" variant="secondary" size="sm" icon="subscription">
              Manage plan
            </ButtonLink>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>How the interface is drawn</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-alpha/40 bg-alpha/[0.06] px-3 py-2.5">
              <span className="flex items-center gap-2 text-small font-medium">
                <AppIcon name="settings" size={16} className="text-alpha" />
                Dark
              </span>
              <Badge variant="premium">Active</Badge>
            </div>
            <p className="text-small leading-relaxed text-muted">
              Dark is the only theme at the moment. The colour system is defined as tokens rather
              than fixed values, so a light theme is a matter of swapping one set of variables — but
              nothing here pretends to offer a switch that does not exist yet.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your data</CardTitle>
            <CardDescription>What is stored, and how to remove it</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3 text-small leading-relaxed text-muted">
            <p>
              We store your profile, subscription state, simulation history and daily usage
              counters. Card details are held by Stripe and never reach our servers.
            </p>
            <p>
              To export or delete everything associated with your account, write to
              privacy@sportalpha.ai. Deletion removes your profile, simulation history and usage
              records and cannot be undone.
            </p>
          </CardBody>
        </Card>
      </div>

      <Note className="mt-6">
        Changing your display name updates your identity record directly; everything else on this
        screen is read from your account and cannot be edited here.
      </Note>
    </>
  );
}
