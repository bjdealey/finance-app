import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

interface DbBundle {
  db: Db;
  kind: 'pglite' | 'pg';
  close: () => Promise<void>;
}

function create(): DbBundle {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url });
    return { db: drizzlePg(pool, { schema }) as unknown as Db, kind: 'pg', close: () => pool.end() };
  }
  // Dev default: embedded Postgres persisted to ./.pglite (single-process; stop `dev` before seeding).
  const client = new PGlite('./.pglite');
  return { db: drizzlePglite(client, { schema }), kind: 'pglite', close: () => client.close() };
}

// Singleton across Next HMR / route handlers.
const g = globalThis as unknown as { __dbBundle?: DbBundle };
const bundle = (g.__dbBundle ??= create());

export const db = bundle.db;
export const dbKind = bundle.kind;
export const closeDb = bundle.close;
