import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await getProfile();

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody>
            <ProfileForm
              initialName={profile?.full_name ?? ''}
              email={profile?.email ?? ''}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your data</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4 text-sm text-muted">
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
    </>
  );
}
