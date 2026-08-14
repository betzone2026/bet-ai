import type { Metadata } from 'next';
import { AuthCard } from '../form-shell';
import { UpdatePasswordForm } from './update-password-form';

export const metadata: Metadata = { title: 'Set a new password' };

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Set a new password" subtitle="Choose something you haven't used here before.">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
