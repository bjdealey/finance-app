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
  // No DATABASE_URL → embedded pglite, the zero-config dev/build default. But pglite is dev-only:
  // on a host its data is ephemeral (wiped each deploy) and it loads a WASM engine into the server's
  // own memory. So refuse it at production RUNTIME — fail loud with the fix, rather than silently
  // serving an empty, memory-heavy database (which just OOM-crash-loops with no explanation). The
  // build phase is exempt so `next build` still needs no database.
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error(
      'DATABASE_URL is required in production — point it at your Postgres connection string. ' +
        'pglite is a dev-only embedded database and cannot back a hosted deploy.',
    );
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
