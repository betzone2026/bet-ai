import { getUser, type User } from '@netlify/identity';
import { eq } from 'drizzle-orm';
import { db } from '@/../db';
import { profiles } from '@/../db/schema';
import type { PlanId } from '@/lib/config/plans';

export interface AppProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: PlanId;
  subscription_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  is_admin: boolean;
}

function metadataString(user: User, key: string): string | null {
  const value = user.userMetadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function getSessionUser() {
  return getUser();
}

export async function getProfile(): Promise<AppProfile | null> {
  const user = await getUser();
  if (!user) return null;

  const email = user.email ?? '';
  const fullName = metadataString(user, 'full_name') ?? user.name ?? null;
  const avatarUrl = metadataString(user, 'avatar_url');

  await db
    .insert(profiles)
    .values({ id: user.id, email, fullName, avatarUrl })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { email, fullName, avatarUrl, updatedAt: new Date() },
    });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    avatar_url: profile.avatarUrl,
    plan: profile.plan,
    subscription_status: profile.subscriptionStatus,
    is_admin: user.roles?.includes('admin') ?? false,
  };
}

export async function requireProfile(): Promise<AppProfile> {
  const profile = await getProfile();
  if (!profile) throw new Error('AUTH_REQUIRED');
  return profile;
}

