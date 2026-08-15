import { cookies } from 'next/headers';
import { getUser, type User } from '@netlify/identity';
import { eq } from 'drizzle-orm';
import { db } from '@/../db';
import { profiles } from '@/../db/schema';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';
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

/**
 * Reads the session cookie through `next/headers`.
 *
 * The value is deliberately unused by most callers: what matters is the *call*.
 * `cookies()` is a Next.js dynamic API, so touching it marks every route that
 * resolves a user as request-time rendered. Without it Next.js is free to
 * prerender those routes at build time, where there is no request and therefore
 * no session — freezing an anonymous render, and any redirect it produces, into
 * the deployed output for every visitor.
 *
 * `@netlify/identity` does try to opt into dynamic rendering itself, but it does
 * so through a runtime `require('next/headers')` that is swallowed when it
 * fails. Doing it explicitly here makes the guarantee the app's own, and it
 * cannot silently regress.
 */
export async function getSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Whether this request carried a session cookie at all. */
export async function hasSessionCookie(): Promise<boolean> {
  return (await getSessionCookie()) !== null;
}

export async function getSessionUser(): Promise<User | null> {
  await getSessionCookie();
  return getUser();
}

export async function getProfile(): Promise<AppProfile | null> {
  const user = await getSessionUser();
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
