import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { sessions, users } from '@/server/db/schema';

const COOKIE = 'session';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The cookie holds the raw token; the DB stores only its SHA-256, so a DB leak can't be replayed.
function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({ id: tokenHash(token), userId, expiresAt });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, tokenHash(token)));
  store.delete(COOKIE);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  baseCurrency: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, baseCurrency: users.baseCurrency })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

// Use in any authenticated page/action. Redirects to /login when there is no valid session.
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
