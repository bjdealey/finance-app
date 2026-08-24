'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { seedUserDefaults } from '@/server/db/defaults';
import { hashPassword, verifyPassword } from './password';
import { createSession, destroySession } from './session';
import { hitRateLimit, clearRateLimit, clientIpFrom } from './rate-limit';

// A lazily-computed argon2 hash to verify against when the email is unknown, so a missing account
// takes the same time to reject as a real one (closes a user-enumeration timing oracle).
let dummyHashPromise: Promise<string> | undefined;
const dummyHash = () => (dummyHashPromise ??= hashPassword('timing-equaliser-not-a-real-secret'));

export interface AuthState {
  error?: string;
}

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const { name, email, password } = parsed.data;

  // Throttle by client IP so the "already exists" reply can't be used to enumerate accounts at scale.
  // (Full fix is a "check your email" flow, which needs email sending this MVP doesn't have.)
  const h = await headers();
  if (hitRateLimit(`register:${clientIpFrom((n) => h.get(n))}`)) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return { error: 'An account with that email already exists.' };

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  // Seed the default category taxonomy + rules so the new user can categorise and analyse from day one.
  await seedUserDefaults(user.id);
  await createSession(user.id);
  redirect('/dashboard');
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details' };
  const { email, password } = parsed.data;

  if (hitRateLimit(email)) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' };
  }

  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];

  // Always pay one argon2 verify — real hash if the user exists, a dummy otherwise — so timing can't
  // reveal whether the email is registered. Same generic message either way (no account enumeration).
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user) await verifyPassword(await dummyHash(), password);
  if (!user || !ok) {
    return { error: 'Incorrect email or password.' };
  }

  clearRateLimit(email);
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
